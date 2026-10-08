"""vector_search_service（T8 语义检索）测试

覆盖策略：
  - 不下载真实 BGE 模型：用 FakeEmbedder 注入确定性 512 维向量；
  - 用真实 QdrantClient(local path=tmp_path) 验证 reindex → search 全链路，
    排序由向量构造控制（含"递归"的文本向量对齐查询向量）；
  - 禁用路径（VECTOR_SEARCH_ENABLED=false）与鉴权走常规断言。
"""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.services import vector_search_service as vsm


class FakeEmbedder:
    """确定性假嵌入：含关键词的文本对齐基向量，否则给正交向量。"""

    def embed(self, texts):
        vecs = []
        for t in texts:
            if '递归' in t:
                vecs.append([1.0] + [0.0] * 511)
            elif '排序' in t:
                vecs.append([0.0, 1.0] + [0.0] * 510)
            else:
                vecs.append([0.0, 0.0, 1.0] + [0.0] * 509)
        return vecs


@pytest.fixture
def vs_service(tmp_path):
    """注入假 embedder + tmp 目录真实 qdrant local 的服务单例。"""
    from qdrant_client import QdrantClient
    client = QdrantClient(path=str(tmp_path / 'qdrant'))
    vsm.vector_search_service.inject_for_test(FakeEmbedder(), client)
    yield vsm.vector_search_service
    # 复位，避免污染其他用例的单例状态
    vsm.vector_search_service._embedder = None
    vsm.vector_search_service._client = None


def _make_kps(db_session, course):
    from src.models.knowledge_base import KnowledgePoint, CourseChapter
    course = db_session.session.merge(course)  # sample_course fixture 出上下文后已 detach
    ch = CourseChapter(course_id=course.id, title='第1章')
    db_session.session.add(ch)
    db_session.session.flush()
    kp1 = KnowledgePoint(course_id=course.id, chapter_id=ch.id, title='递归函数',
                         definition='函数在自身定义中调用自身', status='published')
    kp2 = KnowledgePoint(course_id=course.id, chapter_id=ch.id, title='列表排序',
                         definition='sort 方法原地排序', status='published')
    kp3 = KnowledgePoint(course_id=course.id, chapter_id=ch.id, title='草稿点',
                         definition='未发布', status='draft')
    db_session.session.add_all([kp1, kp2, kp3])
    db_session.session.commit()
    return kp1, kp2, kp3


class TestVectorSearchService:
    def test_reindex_published_only(self, app, db_session, sample_course, vs_service):
        kp1, kp2, kp3 = _make_kps(db_session, sample_course)
        with app.app_context():
            res = vs_service.reindex()
        assert res['ok'] is True
        assert res['indexed'] == 2  # draft 不入索引

    def test_search_ranking(self, app, db_session, sample_course, vs_service):
        _make_kps(db_session, sample_course)
        with app.app_context():
            vs_service.reindex()
            res = vs_service.search('递归是什么', top_k=5)
        assert res['ok'] is True
        assert res['total'] >= 1
        assert res['results'][0]['title'] == '递归函数'
        assert res['results'][0]['score'] > 0.9

    def test_course_filter(self, app, db_session, sample_course, vs_service):
        _make_kps(db_session, sample_course)
        with app.app_context():
            vs_service.reindex()
            res = vs_service.search('递归是什么', top_k=5, course_id=999999)
        assert res['ok'] is True
        assert res['total'] == 0

    def test_empty_query(self, app, vs_service):
        res = vs_service.search('   ')
        assert res['ok'] is True
        assert res['results'] == []

    def test_disabled(self, monkeypatch):
        monkeypatch.setattr(vsm, 'VS_ENABLED', False)
        vsm.vector_search_service._embedder = None
        vsm.vector_search_service._client = None
        res = vsm.vector_search_service.search('任意')
        assert res['ok'] is False
        assert res['enabled'] is False
        assert 'error' in res


class TestSemanticRoutes:
    def test_semantic_requires_auth(self, client):
        resp = client.post('/api/search/semantic', json={'query': '递归'})
        assert resp.status_code == 401

    def test_semantic_empty_query_400(self, client, auth_session):
        resp = client.post('/api/search/semantic', json={'query': ''})
        assert resp.status_code == 400

    def test_semantic_search_flow(self, app, client, auth_session, db_session, sample_course, vs_service):
        _make_kps(db_session, sample_course)
        with app.app_context():
            vs_service.reindex()
        resp = client.post('/api/search/semantic', json={'query': '递归是什么', 'top_k': 5})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['ok'] is True
        assert data['results'][0]['title'] == '递归函数'

    def test_reindex_route(self, app, client, auth_session, db_session, sample_course, vs_service):
        _make_kps(db_session, sample_course)
        resp = client.post('/api/search/semantic/reindex', json={})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['ok'] is True
        assert data['indexed'] == 2
