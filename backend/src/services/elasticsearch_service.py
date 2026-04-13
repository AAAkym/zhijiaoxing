"""
Elasticsearch搜索引擎服务

提供课程、内容、知识库搜索功能
支持全文搜索、自动补全、高亮显示
"""
import os
import time
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import json

from dotenv import load_dotenv
load_dotenv()

from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import NotFoundError, ConnectionError, TransportError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ES_HOST = os.environ.get('ELASTICSEARCH_HOST', 'localhost')
ES_PORT = int(os.environ.get('ELASTICSEARCH_PORT', 9200))
ES_USERNAME = os.environ.get('ELASTICSEARCH_USERNAME', '')
ES_PASSWORD = os.environ.get('ELASTICSEARCH_PASSWORD', '')
ES_ENABLED = os.environ.get('ELASTICSEARCH_ENABLED', 'true').lower() in ('true', '1', 'yes')
ES_RETRY_COUNT = int(os.environ.get('ELASTICSEARCH_RETRY_COUNT', 3))
ES_RETRY_DELAY = int(os.environ.get('ELASTICSEARCH_RETRY_DELAY', 5))
ES_CONNECTION_TIMEOUT = int(os.environ.get('ELASTICSEARCH_CONNECTION_TIMEOUT', 10))

INDEX_COURSES = 'courses'
INDEX_CONTENTS = 'contents'
INDEX_KNOWLEDGE = 'knowledge'


class ElasticsearchService:
    """Elasticsearch服务类 - 支持可选启用和重试机制"""
    
    def __init__(self):
        self.client = None
        self._connected = False
        self._enabled = ES_ENABLED
        self._last_error = None
        
        if self._enabled:
            self._connect_with_retry()
        else:
            logger.info("Elasticsearch服务已禁用 (ELASTICSEARCH_ENABLED=false)")
    
    def _connect_with_retry(self, max_retries: int = None, retry_delay: int = None):
        """带重试机制的连接"""
        max_retries = max_retries or ES_RETRY_COUNT
        retry_delay = retry_delay or ES_RETRY_DELAY
        
        for attempt in range(1, max_retries + 1):
            try:
                self._connect()
                if self._connected:
                    return True
            except Exception as e:
                self._last_error = str(e)
                logger.warning(f"Elasticsearch连接尝试 {attempt}/{max_retries} 失败: {e}")
            
            if attempt < max_retries:
                logger.info(f"将在 {retry_delay} 秒后重试...")
                time.sleep(retry_delay)
        
        logger.error(f"Elasticsearch连接失败，已重试 {max_retries} 次")
        return False
    
    def _connect(self):
        """连接到Elasticsearch - 兼容8.x版本API"""
        try:
            hosts = f"http://{ES_HOST}:{ES_PORT}"
            
            connection_params = {
                'hosts': [hosts],
                'request_timeout': ES_CONNECTION_TIMEOUT,
                'max_retries': 3,
                'retry_on_timeout': True,
            }
            
            if ES_USERNAME and ES_PASSWORD:
                connection_params['basic_auth'] = (ES_USERNAME, ES_PASSWORD)
            
            self.client = Elasticsearch(**connection_params)
            
            if self.client.ping():
                self._connected = True
                info = self.client.info()
                es_version = info.get('version', {}).get('number', 'unknown')
                cluster_name = info.get('cluster_name', 'unknown')
                logger.info(f"✓ Elasticsearch连接成功")
                logger.info(f"  集群名称: {cluster_name}")
                logger.info(f"  版本: {es_version}")
                logger.info(f"  主机: {hosts}")
                return True
            else:
                self._connected = False
                logger.error("✗ Elasticsearch ping失败")
                return False
                
        except ImportError as e:
            self._connected = False
            self._last_error = f"Elasticsearch库导入错误: {e}"
            logger.error(f"✗ {self._last_error}")
            return False
        except ConnectionError as e:
            self._connected = False
            self._last_error = f"连接被拒绝: {e}"
            logger.error(f"✗ Elasticsearch连接错误: {e}")
            logger.error(f"  请确保Elasticsearch服务正在运行于 {ES_HOST}:{ES_PORT}")
            return False
        except TransportError as e:
            self._connected = False
            self._last_error = f"传输错误: {e}"
            logger.error(f"✗ Elasticsearch传输错误: {e}")
            if "401" in str(e):
                logger.error("  认证失败，请检查ELASTICSEARCH_USERNAME和ELASTICSEARCH_PASSWORD")
            return False
        except Exception as e:
            self._connected = False
            self._last_error = str(e)
            logger.error(f"✗ Elasticsearch连接错误: {e}")
            return False
    
    def is_connected(self) -> bool:
        """检查是否已连接"""
        if not self._enabled:
            return False
        if not self.client:
            return False
        try:
            return self.client.ping()
        except Exception:
            return False
    
    def is_enabled(self) -> bool:
        """检查Elasticsearch是否启用"""
        return self._enabled
    
    def get_status(self) -> Dict[str, Any]:
        """获取服务状态"""
        return {
            'enabled': self._enabled,
            'connected': self._connected,
            'host': f"{ES_HOST}:{ES_PORT}" if self._enabled else None,
            'last_error': self._last_error
        }
    
    def reconnect(self) -> bool:
        """重新连接"""
        if not self._enabled:
            logger.warning("Elasticsearch已禁用，无法重新连接")
            return False
        return self._connect_with_retry()
    
    # ==================== 索引管理 ====================
    
    def create_indices(self):
        """创建所有索引"""
        if not self.is_connected():
            logger.warning("Elasticsearch未连接，跳过索引创建")
            return False
        
        self._create_courses_index()
        self._create_contents_index()
        self._create_knowledge_index()
        logger.info("✓ 所有索引创建完成")
        return True
    
    def _create_courses_index(self):
        """创建课程索引"""
        mapping = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "ik_smart": {
                            "type": "custom",
                            "tokenizer": "ik_smart"
                        },
                        "ik_max_word": {
                            "type": "custom",
                            "tokenizer": "ik_max_word"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "title": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        },
                        "boost": 3.0
                    },
                    "description": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "boost": 2.0
                    },
                    "content": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart"
                    },
                    "category": {"type": "keyword"},
                    "tags": {"type": "keyword"},
                    "instructor": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "keyword"},
                            "name": {"type": "text", "analyzer": "ik_smart"}
                        }
                    },
                    "difficulty": {"type": "keyword"},
                    "duration": {"type": "integer"},
                    "price": {"type": "float"},
                    "rating": {"type": "float"},
                    "students_count": {"type": "integer"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        }
        
        self._create_index(INDEX_COURSES, mapping)
    
    def _create_contents_index(self):
        """创建内容索引"""
        mapping = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "ik_smart": {
                            "type": "custom",
                            "tokenizer": "ik_smart"
                        },
                        "ik_max_word": {
                            "type": "custom",
                            "tokenizer": "ik_max_word"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "course_id": {"type": "keyword"},
                    "chapter_id": {"type": "keyword"},
                    "title": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "boost": 2.0
                    },
                    "content": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "boost": 1.5
                    },
                    "content_type": {"type": "keyword"},
                    "order": {"type": "integer"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        }
        
        self._create_index(INDEX_CONTENTS, mapping)
    
    def _create_knowledge_index(self):
        """创建知识库索引"""
        mapping = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "ik_smart": {
                            "type": "custom",
                            "tokenizer": "ik_smart"
                        },
                        "ik_max_word": {
                            "type": "custom",
                            "tokenizer": "ik_max_word"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "title": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "boost": 2.5
                    },
                    "question": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "boost": 2.0
                    },
                    "answer": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "boost": 1.5
                    },
                    "category": {"type": "keyword"},
                    "tags": {"type": "keyword"},
                    "related_courses": {"type": "keyword"},
                    "view_count": {"type": "integer"},
                    "helpful_count": {"type": "integer"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        }
        
        self._create_index(INDEX_KNOWLEDGE, mapping)
    
    def _create_index(self, index_name: str, mapping: Dict):
        """创建单个索引"""
        if not self.is_connected():
            logger.warning(f"无法创建索引 {index_name}: Elasticsearch未连接")
            return False
        
        try:
            if self.client.indices.exists(index=index_name):
                logger.info(f"索引 {index_name} 已存在")
                return True
            
            self.client.indices.create(index=index_name, body=mapping)
            logger.info(f"✓ 索引 {index_name} 创建成功")
            return True
            
        except Exception as e:
            logger.error(f"✗ 创建索引 {index_name} 失败: {e}")
            return False
    
    def delete_index(self, index_name: str):
        """删除索引"""
        if not self.is_connected():
            return False
        
        try:
            self.client.indices.delete(index=index_name)
            logger.info(f"✓ 索引 {index_name} 已删除")
            return True
        except NotFoundError:
            logger.warning(f"索引 {index_name} 不存在")
            return False
        except Exception as e:
            logger.error(f"✗ 删除索引失败: {e}")
            return False
    
    # ==================== 文档操作 ====================
    
    def index_document(self, index_name: str, doc_id: str, document: Dict) -> bool:
        """索引单个文档"""
        if not self.is_connected():
            logger.warning("Elasticsearch未连接，无法索引文档")
            return False
        
        try:
            document['updated_at'] = datetime.now().isoformat()
            if 'created_at' not in document:
                document['created_at'] = document['updated_at']
            
            self.client.index(index=index_name, id=doc_id, body=document)
            return True
        except Exception as e:
            logger.error(f"✗ 索引文档失败: {e}")
            return False
    
    def bulk_index(self, index_name: str, documents: List[Dict]) -> Tuple[int, int]:
        """批量索引文档"""
        if not self.is_connected():
            logger.warning("Elasticsearch未连接，无法批量索引")
            return 0, len(documents)
        
        actions = []
        for doc in documents:
            doc_id = doc.get('id')
            if doc_id:
                action = {
                    "_index": index_name,
                    "_id": doc_id,
                    "_source": doc
                }
                actions.append(action)
        
        if not actions:
            return 0, 0
        
        try:
            success, errors = helpers.bulk(self.client, actions)
            logger.info(f"✓ 批量索引完成: 成功 {success}, 失败 {len(errors) if errors else 0}")
            return success, len(errors) if errors else 0
        except Exception as e:
            logger.error(f"✗ 批量索引失败: {e}")
            return 0, len(documents)
    
    def delete_document(self, index_name: str, doc_id: str) -> bool:
        """删除文档"""
        if not self.is_connected():
            return False
        
        try:
            self.client.delete(index=index_name, id=doc_id)
            return True
        except NotFoundError:
            return False
        except Exception as e:
            logger.error(f"✗ 删除文档失败: {e}")
            return False
    
    # ==================== 搜索功能 ====================
    
    def search(self, index_name: str, query: str, 
               filters: Dict = None,
               page: int = 1,
               per_page: int = 20,
               highlight: bool = True) -> Dict:
        """
        全文搜索
        
        Args:
            index_name: 索引名称
            query: 搜索关键词
            filters: 过滤条件
            page: 页码
            per_page: 每页数量
            highlight: 是否高亮
        """
        if not self.is_connected():
            return {"error": "Elasticsearch未连接", "results": [], "total": 0}
        
        try:
            must_clauses = []
            
            if query:
                must_clauses.append({
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "description^2", "content", "question^2", "answer"],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                })
            
            filter_clauses = []
            if filters:
                for key, value in filters.items():
                    if isinstance(value, list):
                        filter_clauses.append({"terms": {key: value}})
                    else:
                        filter_clauses.append({"term": {key: value}})
            
            search_body = {
                "query": {
                    "bool": {
                        "must": must_clauses,
                        "filter": filter_clauses
                    }
                },
                "from": (page - 1) * per_page,
                "size": per_page,
                "sort": [
                    {"_score": {"order": "desc"}},
                    {"created_at": {"order": "desc"}}
                ]
            }
            
            if highlight and query:
                search_body["highlight"] = {
                    "pre_tags": ["<mark>"],
                    "post_tags": ["</mark>"],
                    "fields": {
                        "title": {"fragment_size": 150, "number_of_fragments": 1},
                        "description": {"fragment_size": 200, "number_of_fragments": 2},
                        "content": {"fragment_size": 200, "number_of_fragments": 2},
                        "question": {"fragment_size": 200, "number_of_fragments": 1},
                        "answer": {"fragment_size": 300, "number_of_fragments": 2}
                    }
                }
            
            response = self.client.search(index=index_name, body=search_body)
            
            hits = response["hits"]["hits"]
            total = response["hits"]["total"]["value"]
            
            results = []
            for hit in hits:
                item = hit["_source"]
                item["_id"] = hit["_id"]
                item["_score"] = hit["_score"]
                
                if "highlight" in hit:
                    item["highlight"] = hit["highlight"]
                
                results.append(item)
            
            return {
                "results": results,
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page
            }
            
        except Exception as e:
            logger.error(f"✗ 搜索失败: {e}")
            return {"error": str(e), "results": [], "total": 0}
    
    def autocomplete(self, index_name: str, prefix: str, 
                     field: str = "title",
                     size: int = 10) -> List[str]:
        """
        自动补全建议
        
        Args:
            index_name: 索引名称
            prefix: 输入前缀
            field: 搜索字段
            size: 返回数量
        """
        if not self.is_connected() or not prefix:
            return []
        
        try:
            search_body = {
                "query": {
                    "match_phrase_prefix": {
                        field: {
                            "query": prefix,
                            "max_expansions": 50
                        }
                    }
                },
                "size": size,
                "_source": [field],
                "sort": [{"_score": {"order": "desc"}}]
            }
            
            response = self.client.search(index=index_name, body=search_body)
            
            suggestions = []
            for hit in response["hits"]["hits"]:
                text = hit["_source"].get(field, "")
                if text and text not in suggestions:
                    suggestions.append(text)
            
            return suggestions[:size]
            
        except Exception as e:
            logger.error(f"✗ 自动补全失败: {e}")
            return []
    
    def multi_search(self, query: str, 
                     indices: List[str] = None,
                     page: int = 1,
                     per_page: int = 20) -> Dict:
        """
        多索引搜索
        
        Args:
            query: 搜索关键词
            indices: 索引列表（默认搜索所有）
            page: 页码
            per_page: 每页数量
        """
        if not indices:
            indices = [INDEX_COURSES, INDEX_CONTENTS, INDEX_KNOWLEDGE]
        
        index_str = ",".join(indices)
        return self.search(index_str, query, page=page, per_page=per_page)
    
    # ==================== 课程搜索专用方法 ====================
    
    def search_courses(self, query: str, 
                       category: str = None,
                       difficulty: str = None,
                       min_rating: float = None,
                       page: int = 1,
                       per_page: int = 20) -> Dict:
        """搜索课程"""
        filters = {}
        if category:
            filters["category"] = category
        if difficulty:
            filters["difficulty"] = difficulty
        if min_rating:
            filters["rating"] = {"gte": min_rating}
        
        return self.search(INDEX_COURSES, query, filters, page, per_page)
    
    def search_contents(self, query: str,
                       course_id: str = None,
                       page: int = 1,
                       per_page: int = 20) -> Dict:
        """搜索课程内容"""
        filters = {}
        if course_id:
            filters["course_id"] = course_id
        
        return self.search(INDEX_CONTENTS, query, filters, page, per_page)
    
    def search_knowledge(self, query: str,
                        category: str = None,
                        page: int = 1,
                        per_page: int = 20) -> Dict:
        """搜索知识库"""
        filters = {}
        if category:
            filters["category"] = category
        
        return self.search(INDEX_KNOWLEDGE, query, filters, page, per_page)
    
    # ==================== 热门搜索 ====================
    
    def get_popular_searches(self, index_name: str, size: int = 10) -> List[str]:
        """获取热门搜索词"""
        # 这里可以实现基于搜索日志的统计
        # 简化版本返回空列表
        return []
    
    def record_search(self, query: str, index_name: str, results_count: int):
        """记录搜索日志"""
        # 可以存储到单独的索引用于分析
        pass


# 全局服务实例
es_service = ElasticsearchService()


# 便捷函数
def init_elasticsearch():
    """初始化Elasticsearch"""
    es_service.create_indices()


def search_all(query: str, page: int = 1, per_page: int = 20):
    """全局搜索"""
    return es_service.multi_search(query, page=page, per_page=per_page)


def get_autocomplete_suggestions(prefix: str, index: str = "courses"):
    """获取自动补全建议"""
    return es_service.autocomplete(index, prefix)
