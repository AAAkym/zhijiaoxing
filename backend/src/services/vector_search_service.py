"""
向量语义搜索服务（BGE 中文 embedding + Qdrant local 模式）

设计约束（丰富化第二梯队 T8）：
  - 基础设施零新增：Qdrant 用 qdrant-client 本地模式（写文件持久化到
    backend/instance/qdrant/），不起服务端、不改数据库；
  - 模型用 BAAI/bge-small-zh-v1.5（ONNX，fastembed 推理，512 维，
    权重首次经 hf-mirror 下载后落 ~/.cache/fastembed，离线可复用）；
  - 语料=KnowledgePoint（title+definition+content+tags），
    一次 reindex 全量重建（单课程量级秒级完成，无需增量）；
  - 懒加载：import 本模块不碰模型/文件系统，首次调用才初始化，
    测试环境可整体禁用（VECTOR_SEARCH_ENABLED=false）；
  - 可注入 embedder/client：单测用假向量覆盖排序逻辑，不下载模型。
"""
import os
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

VS_ENABLED = os.environ.get('VECTOR_SEARCH_ENABLED', 'true').lower() in ('true', '1', 'yes')
EMBED_MODEL = os.environ.get('VECTOR_EMBED_MODEL', 'BAAI/bge-small-zh-v1.5')
VECTOR_DIM = 512  # bge-small-zh-v1.5 输出维度
COLLECTION = 'knowledge_semantic'


class VectorSearchService:
    """语义检索服务：BGE 编码 → Qdrant local 最近邻 → 返回知识点命中"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._embedder = None
            cls._instance._client = None
            cls._instance._qdrant_path = None
            cls._instance._last_error = None
        return cls._instance

    def is_enabled(self) -> bool:
        return VS_ENABLED

    def _ensure_init(self) -> bool:
        """首次使用时初始化 embedder + Qdrant client；失败置 _last_error。"""
        if not VS_ENABLED:
            self._last_error = 'VECTOR_SEARCH_ENABLED=false'
            return False
        if self._embedder is not None and self._client is not None:
            return True
        try:
            from fastembed import TextEmbedding
            from qdrant_client import QdrantClient
            self._embedder = TextEmbedding(model_name=EMBED_MODEL)
            if self._qdrant_path is None:
                backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
                self._qdrant_path = os.path.join(backend_root, 'instance', 'qdrant')
            os.makedirs(self._qdrant_path, exist_ok=True)
            self._client = QdrantClient(path=self._qdrant_path)
            self._last_error = None
            logger.info(f'VectorSearchService: 初始化完成 model={EMBED_MODEL} path={self._qdrant_path}')
            return True
        except Exception as e:
            self._last_error = f'{type(e).__name__}: {e}'
            logger.error(f'VectorSearchService 初始化失败: {self._last_error}')
            return False

    def inject_for_test(self, embedder, client) -> None:
        """测试注入假 embedder/client，绕过模型下载与文件系统。"""
        self._embedder = embedder
        self._client = client

    def _embed_texts(self, texts: List[str]):
        return [v.tolist() if hasattr(v, 'tolist') else list(v) for v in self._embedder.embed(texts)]

    def _embed_query(self, text: str) -> list:
        return self._embed_texts([text])[0]

    @staticmethod
    def _point_text(kp) -> str:
        """拼语料文本：标题+定义+正文+标签（截断防超长，BGE max_len=512 token）。"""
        import json
        try:
            tags = json.loads(kp.tags or '[]')
            if not isinstance(tags, list):
                tags = []
        except Exception:
            tags = []
        parts = [kp.title or '', kp.definition or '', (kp.content or '')[:600], ' '.join(tags[:10])]
        return '。'.join(p.strip() for p in parts if p and p.strip())[:900]

    def reindex(self, course_id: Optional[int] = None) -> Dict[str, Any]:
        """全量重建语义索引（语料=KnowledgePoint 已发布条目）。"""
        if not self._ensure_init():
            return {'ok': False, 'enabled': VS_ENABLED, 'error': self._last_error, 'indexed': 0}

        from src.models.knowledge_base import KnowledgePoint
        from qdrant_client.models import Distance, VectorParams, PointStruct

        query = KnowledgePoint.query.filter(KnowledgePoint.status == 'published')
        if course_id:
            query = query.filter(KnowledgePoint.course_id == course_id)
        kps = query.all()

        # 全量重建：语料小、秒级完成，比逐点差异比对简单可靠
        if self._client.collection_exists(COLLECTION):
            self._client.delete_collection(COLLECTION)
        self._client.create_collection(
            COLLECTION,
            vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
        )

        if kps:
            texts = [self._point_text(kp) for kp in kps]
            vectors = self._embed_texts(texts)
            points = [
                PointStruct(
                    id=kp.id,
                    vector=vec,
                    payload={
                        'knowledge_point_id': kp.id,
                        'course_id': kp.course_id,
                        'chapter_id': kp.chapter_id,
                        'title': kp.title,
                        'snippet': (kp.definition or kp.content or '')[:160],
                    },
                )
                for kp, vec in zip(kps, vectors)
            ]
            # qdrant upsert 单批即可（单课程量级，无需分批）
            self._client.upsert(COLLECTION, points=points)

        logger.info(f'VectorSearchService: reindex 完成 indexed={len(kps)} course_id={course_id}')
        return {'ok': True, 'enabled': True, 'indexed': len(kps), 'course_id': course_id}

    def search(self, query: str, top_k: int = 8, course_id: Optional[int] = None) -> Dict[str, Any]:
        """语义检索：query 编码 → 集合最近邻 → 返回带分数的知识点。"""
        if not self._ensure_init():
            return {'ok': False, 'enabled': VS_ENABLED, 'error': self._last_error, 'results': [], 'total': 0}
        if not query or not query.strip():
            return {'ok': True, 'enabled': True, 'results': [], 'total': 0}

        from qdrant_client.models import Filter, FieldCondition, MatchValue

        qfilter = None
        if course_id:
            qfilter = Filter(must=[FieldCondition(key='course_id', match=MatchValue(value=course_id))])

        try:
            vector = self._embed_query(query.strip())
            hits = self._client.query_points(
                COLLECTION, query=vector, limit=max(1, min(top_k, 50)), query_filter=qfilter
            ).points
        except Exception as e:
            # 集合不存在（还没 reindex 过）等情况：返回可读的不可用结果而非 500
            msg = str(e)
            if 'Not found' in msg or 'doesn' in msg:
                return {'ok': True, 'enabled': True, 'results': [], 'total': 0,
                        'hint': '语义索引未构建，请先调用 /api/search/semantic/reindex'}
            raise

        results = [{
            'knowledge_point_id': p.payload.get('knowledge_point_id'),
            'course_id': p.payload.get('course_id'),
            'chapter_id': p.payload.get('chapter_id'),
            'title': p.payload.get('title'),
            'snippet': p.payload.get('snippet'),
            'score': round(float(p.score), 4),
        } for p in hits]

        return {'ok': True, 'enabled': True, 'results': results, 'total': len(results),
                'engine': f'{EMBED_MODEL} + qdrant-local'}


vector_search_service = VectorSearchService()
