"""
高性能搜索服务

提供全文搜索、模糊搜索、自动补全、搜索建议等功能
支持缓存优化，确保毫秒级响应
"""
import os
import time
import json
import hashlib
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from functools import lru_cache

from dotenv import load_dotenv
load_dotenv()

from elasticsearch import Elasticsearch, helpers
from elasticsearch.exceptions import NotFoundError, ConnectionError
from flask import current_app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ES_HOST = os.environ.get('ELASTICSEARCH_HOST', 'localhost')
ES_PORT = int(os.environ.get('ELASTICSEARCH_PORT', 9200))
ES_USERNAME = os.environ.get('ELASTICSEARCH_USERNAME', '')
ES_PASSWORD = os.environ.get('ELASTICSEARCH_PASSWORD', '')
ES_ENABLED = os.environ.get('ELASTICSEARCH_ENABLED', 'true').lower() in ('true', '1', 'yes')

INDEX_COURSES = 'courses'
INDEX_CONTENTS = 'contents'
INDEX_KNOWLEDGE = 'knowledge'
INDEX_SUGGESTIONS = 'search_suggestions'

HIGHLIGHT_PRE_TAG = '<mark class="highlight">'
HIGHLIGHT_POST_TAG = '</mark>'


class SearchService:
    """高性能搜索服务"""
    
    _instance = None
    _client = None
    _connected = False
    _enabled = True
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not ES_ENABLED:
            self._enabled = False
            logger.info("SearchService: Elasticsearch服务已禁用")
            return
            
        if self._client is None:
            self._connect()
    
    def _connect(self):
        """连接Elasticsearch - 兼容8.x版本API"""
        try:
            hosts = f"http://{ES_HOST}:{ES_PORT}"
            
            connection_params = {
                'hosts': [hosts],
                'request_timeout': 10,
                'max_retries': 3,
                'retry_on_timeout': True
            }
            
            if ES_USERNAME and ES_PASSWORD:
                self._client = Elasticsearch(
                    hosts=hosts,
                    basic_auth=(ES_USERNAME, ES_PASSWORD),
                    timeout=10,
                    max_retries=3,
                    retry_on_timeout=True
                )
            else:
                self._client = Elasticsearch(
                    hosts=hosts,
                    timeout=10,
                    max_retries=3,
                    retry_on_timeout=True
                )
            
            if self._client.ping():
                self._connected = True
                logger.info("✓ SearchService: Elasticsearch连接成功")
            else:
                self._connected = False
                logger.warning("✗ SearchService: Elasticsearch连接失败")
                self._client = None
                
        except Exception as e:
            self._connected = False
            logger.warning(f"✗ SearchService: Elasticsearch连接错误: {e}")
            self._client = None
    
    @property
    def client(self) -> Optional[Elasticsearch]:
        return self._client
    
    def is_connected(self) -> bool:
        """检查连接状态"""
        if not self._enabled:
            return False
        if not self._client:
            return False
        try:
            return self._client.ping()
        except:
            return False
    
    def is_enabled(self) -> bool:
        """检查服务是否启用"""
        return self._enabled
    
    def _get_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """生成缓存键"""
        key_parts = [prefix]
        if args:
            key_parts.extend(str(arg) for arg in args)
        if kwargs:
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
        key = ':'.join(key_parts)
        if len(key) > 200:
            key = f"{prefix}:hash:{hashlib.md5(key.encode()).hexdigest()}"
        return key
    
    def _get_from_cache(self, key: str) -> Tuple[Optional[Any], bool]:
        """从缓存获取数据"""
        try:
            if hasattr(current_app, 'extensions') and 'cache' in current_app.extensions:
                cache = current_app.extensions['cache']
                value = cache.get(key)
                return value, value is not None
        except:
            pass
        return None, False
    
    def _set_to_cache(self, key: str, value: Any, timeout: int = 300):
        """设置缓存"""
        try:
            if hasattr(current_app, 'extensions') and 'cache' in current_app.extensions:
                cache = current_app.extensions['cache']
                cache.set(key, value, timeout=timeout)
        except:
            pass
    
    def search(
        self,
        query: str,
        indices: List[str] = None,
        filters: Dict = None,
        page: int = 1,
        per_page: int = 20,
        highlight: bool = True,
        fuzzy: bool = True,
        use_cache: bool = True,
        cache_timeout: int = 300
    ) -> Dict:
        """
        全文搜索
        
        Args:
            query: 搜索关键词
            indices: 搜索索引列表
            filters: 过滤条件
            page: 页码
            per_page: 每页数量
            highlight: 是否高亮
            fuzzy: 是否启用模糊搜索
            use_cache: 是否使用缓存
            cache_timeout: 缓存超时时间
            
        Returns:
            搜索结果字典
        """
        start_time = time.time()
        
        if not indices:
            indices = [INDEX_COURSES, INDEX_CONTENTS, INDEX_KNOWLEDGE]
        
        cache_key = self._get_cache_key(
            'search', query, ','.join(indices), 
            json.dumps(filters or {}, sort_keys=True),
            page, per_page, fuzzy
        ) if use_cache else None
        
        if use_cache:
            cached_result, found = self._get_from_cache(cache_key)
            if found:
                cached_result['from_cache'] = True
                return cached_result
        
        if not self.is_connected():
            return {"error": "Elasticsearch未连接", "results": [], "total": 0}
        
        try:
            must_clauses = []
            
            if query:
                multi_match = {
                    "query": query,
                    "fields": [
                        "title^3.0",
                        "title.pinyin^2.0",
                        "description^2.0",
                        "content^1.0",
                        "question^2.5",
                        "answer^1.5",
                        "tags^1.5",
                        "keywords^2.0"
                    ],
                    "type": "best_fields",
                    "operator": "or",
                    "minimum_should_match": "30%"
                }
                
                if fuzzy:
                    multi_match["fuzziness"] = "AUTO"
                    multi_match["prefix_length"] = 1
                    multi_match["max_expansions"] = 50
                
                must_clauses.append({"multi_match": multi_match})
            
            filter_clauses = []
            if filters:
                for key, value in filters.items():
                    if value is None:
                        continue
                    if isinstance(value, list):
                        filter_clauses.append({"terms": {key: value}})
                    elif isinstance(value, dict):
                        if 'range' in str(value).lower() or 'gte' in value or 'lte' in value:
                            filter_clauses.append({"range": {key: value}})
                        else:
                            filter_clauses.append({"term": {key: value}})
                    else:
                        filter_clauses.append({"term": {key: value}})
            
            search_body = {
                "query": {
                    "bool": {
                        "must": must_clauses if must_clauses else [{"match_all": {}}],
                        "filter": filter_clauses,
                        "should": [
                            {"term": {"is_published": {"value": True, "boost": 1.5}}},
                            {"term": {"status": {"value": "published", "boost": 1.3}}}
                        ],
                        "minimum_should_match": 0
                    }
                },
                "from": (page - 1) * per_page,
                "size": per_page,
                "track_total_hits": True,
                "track_scores": True,
                "sort": [
                    {"_score": {"order": "desc"}},
                    {"rating": {"order": "desc", "missing": 0}},
                    {"view_count": {"order": "desc", "missing": 0}},
                    {"created_at": {"order": "desc"}}
                ]
            }
            
            if highlight and query:
                search_body["highlight"] = {
                    "pre_tags": [HIGHLIGHT_PRE_TAG],
                    "post_tags": [HIGHLIGHT_POST_TAG],
                    "fragment_size": 200,
                    "number_of_fragments": 3,
                    "fields": {
                        "title": {
                            "fragment_size": 150,
                            "number_of_fragments": 1,
                            "no_match_size": 150
                        },
                        "description": {
                            "fragment_size": 200,
                            "number_of_fragments": 2
                        },
                        "content": {
                            "fragment_size": 200,
                            "number_of_fragments": 2
                        },
                        "question": {
                            "fragment_size": 200,
                            "number_of_fragments": 1
                        },
                        "answer": {
                            "fragment_size": 300,
                            "number_of_fragments": 2
                        }
                    },
                    "require_field_match": False
                }
            
            index_str = ','.join(indices)
            response = self._client.search(index=index_str, body=search_body)
            
            hits = response["hits"]["hits"]
            total = response["hits"]["total"]["value"]
            
            results = []
            for hit in hits:
                item = hit["_source"]
                item["_id"] = hit["_id"]
                item["_score"] = hit["_score"]
                item["_index"] = hit["_index"]
                
                if "highlight" in hit:
                    item["highlight"] = hit["highlight"]
                
                results.append(item)
            
            response_time_ms = int((time.time() - start_time) * 1000)
            
            result = {
                "results": results,
                "total": total,
                "page": page,
                "per_page": per_page,
                "total_pages": (total + per_page - 1) // per_page,
                "response_time_ms": response_time_ms,
                "query": query,
                "from_cache": False
            }
            
            if use_cache and total > 0:
                self._set_to_cache(cache_key, result, cache_timeout)
            
            return result
            
        except Exception as e:
            print(f"✗ 搜索失败: {e}")
            return {"error": str(e), "results": [], "total": 0}
    
    def autocomplete(
        self,
        prefix: str,
        index: str = None,
        size: int = 10,
        use_cache: bool = True
    ) -> List[Dict]:
        """
        自动补全建议
        
        Args:
            prefix: 输入前缀
            index: 搜索索引
            size: 返回数量
            use_cache: 是否使用缓存
            
        Returns:
            补全建议列表
        """
        if not prefix or len(prefix) < 1:
            return []
        
        prefix = prefix.strip()
        cache_key = self._get_cache_key('autocomplete', prefix, index, size)
        
        if use_cache:
            cached, found = self._get_from_cache(cache_key)
            if found:
                return cached
        
        if not self.is_connected():
            return []
        
        try:
            search_body = {
                "query": {
                    "bool": {
                        "should": [
                            {
                                "match_phrase_prefix": {
                                    "title": {
                                        "query": prefix,
                                        "max_expansions": 50,
                                        "boost": 3.0
                                    }
                                }
                            },
                            {
                                "prefix": {
                                    "title.pinyin": {
                                        "value": prefix.lower(),
                                        "boost": 2.0
                                    }
                                }
                            },
                            {
                                "wildcard": {
                                    "title": {
                                        "value": f"*{prefix}*",
                                        "boost": 1.0
                                    }
                                }
                            }
                        ],
                        "minimum_should_match": 1
                    }
                },
                "size": size,
                "_source": ["title", "category", "tags"],
                "sort": [
                    {"_score": {"order": "desc"}},
                    {"view_count": {"order": "desc", "missing": 0}}
                ]
            }
            
            indices = index if index else f"{INDEX_COURSES},{INDEX_KNOWLEDGE}"
            response = self._client.search(index=indices, body=search_body)
            
            suggestions = []
            seen_titles = set()
            
            for hit in response["hits"]["hits"]:
                title = hit["_source"].get("title", "")
                if title and title not in seen_titles:
                    seen_titles.add(title)
                    suggestions.append({
                        "text": title,
                        "type": hit["_index"],
                        "score": hit["_score"],
                        "category": hit["_source"].get("category"),
                        "tags": hit["_source"].get("tags", [])
                    })
            
            if use_cache:
                self._set_to_cache(cache_key, suggestions, 60)
            
            return suggestions[:size]
            
        except Exception as e:
            print(f"✗ 自动补全失败: {e}")
            return []
    
    def get_search_suggestions(self, size: int = 10) -> List[Dict]:
        """
        获取热门搜索建议
        
        Args:
            size: 返回数量
            
        Returns:
            热门搜索建议列表
        """
        cache_key = self._get_cache_key('hot_searches', size)
        cached, found = self._get_from_cache(cache_key)
        if found:
            return cached
        
        try:
            from src.models.search_log import SearchSuggestion
            suggestions = SearchSuggestion.query.order_by(
                SearchSuggestion.search_count.desc()
            ).limit(size).all()
            
            result = [s.to_dict() for s in suggestions]
            
            self._set_to_cache(cache_key, result, 300)
            
            return result
            
        except Exception as e:
            print(f"✗ 获取热门搜索失败: {e}")
            return []
    
    def search_courses(
        self,
        query: str,
        category: str = None,
        difficulty: str = None,
        min_rating: float = None,
        is_free: bool = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict:
        """搜索课程"""
        filters = {}
        if category:
            filters["category"] = category
        if difficulty:
            filters["difficulty"] = difficulty
        if is_free is not None:
            filters["is_free"] = is_free
        if min_rating:
            filters["rating"] = {"gte": min_rating}
        
        return self.search(
            query=query,
            indices=[INDEX_COURSES],
            filters=filters,
            page=page,
            per_page=per_page
        )
    
    def search_knowledge(
        self,
        query: str,
        category: str = None,
        knowledge_type: str = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict:
        """搜索知识库"""
        filters = {}
        if category:
            filters["category"] = category
        if knowledge_type:
            filters["knowledge_type"] = knowledge_type
        
        return self.search(
            query=query,
            indices=[INDEX_KNOWLEDGE],
            filters=filters,
            page=page,
            per_page=per_page
        )
    
    def search_contents(
        self,
        query: str,
        course_id: str = None,
        content_type: str = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict:
        """搜索课程内容"""
        filters = {}
        if course_id:
            filters["course_id"] = course_id
        if content_type:
            filters["content_type"] = content_type
        
        return self.search(
            query=query,
            indices=[INDEX_CONTENTS],
            filters=filters,
            page=page,
            per_page=per_page
        )
    
    def advanced_search(
        self,
        query: str,
        must_have: List[str] = None,
        must_not_have: List[str] = None,
        exact_phrase: str = None,
        date_range: Dict = None,
        indices: List[str] = None,
        page: int = 1,
        per_page: int = 20
    ) -> Dict:
        """
        高级搜索
        
        Args:
            query: 主要搜索词
            must_have: 必须包含的词
            must_not_have: 必须不包含的词
            exact_phrase: 精确短语
            date_range: 日期范围 {"from": "2024-01-01", "to": "2024-12-31"}
            indices: 搜索索引
            page: 页码
            per_page: 每页数量
        """
        if not indices:
            indices = [INDEX_COURSES, INDEX_CONTENTS, INDEX_KNOWLEDGE]
        
        if not self.is_connected():
            return {"error": "Elasticsearch未连接", "results": [], "total": 0}
        
        try:
            must_clauses = []
            must_not_clauses = []
            
            if query:
                must_clauses.append({
                    "multi_match": {
                        "query": query,
                        "fields": ["title^3", "description^2", "content", "question^2", "answer"],
                        "type": "best_fields",
                        "fuzziness": "AUTO"
                    }
                })
            
            if exact_phrase:
                must_clauses.append({
                    "match_phrase": {
                        "content": exact_phrase
                    }
                })
            
            if must_have:
                for term in must_have:
                    must_clauses.append({
                        "term": {"_all": term}
                    })
            
            if must_not_have:
                for term in must_not_have:
                    must_not_clauses.append({
                        "term": {"_all": term}
                    })
            
            filter_clauses = []
            if date_range:
                filter_clauses.append({
                    "range": {
                        "created_at": date_range
                    }
                })
            
            search_body = {
                "query": {
                    "bool": {
                        "must": must_clauses if must_clauses else [{"match_all": {}}],
                        "must_not": must_not_clauses,
                        "filter": filter_clauses
                    }
                },
                "from": (page - 1) * per_page,
                "size": per_page,
                "highlight": {
                    "pre_tags": [HIGHLIGHT_PRE_TAG],
                    "post_tags": [HIGHLIGHT_POST_TAG],
                    "fields": {
                        "title": {},
                        "description": {},
                        "content": {},
                        "question": {},
                        "answer": {}
                    }
                }
            }
            
            index_str = ','.join(indices)
            response = self._client.search(index=index_str, body=search_body)
            
            hits = response["hits"]["hits"]
            total = response["hits"]["total"]["value"]
            
            results = []
            for hit in hits:
                item = hit["_source"]
                item["_id"] = hit["_id"]
                item["_score"] = hit["_score"]
                item["_index"] = hit["_index"]
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
            print(f"✗ 高级搜索失败: {e}")
            return {"error": str(e), "results": [], "total": 0}
    
    def index_document(self, index: str, doc_id: str, document: Dict) -> bool:
        """索引单个文档"""
        if not self.is_connected():
            return False
        
        try:
            document['updated_at'] = datetime.now().isoformat()
            if 'created_at' not in document:
                document['created_at'] = document['updated_at']
            
            self._client.index(index=index, id=doc_id, body=document)
            return True
        except Exception as e:
            print(f"✗ 索引文档失败: {e}")
            return False
    
    def bulk_index(self, index: str, documents: List[Dict]) -> Tuple[int, int]:
        """批量索引文档"""
        if not self.is_connected():
            return 0, len(documents)
        
        actions = []
        for doc in documents:
            doc_id = doc.get('id')
            if doc_id:
                action = {
                    "_index": index,
                    "_id": doc_id,
                    "_source": doc
                }
                actions.append(action)
        
        if not actions:
            return 0, 0
        
        try:
            success, errors = helpers.bulk(self._client, actions)
            return success, len(errors) if errors else 0
        except Exception as e:
            print(f"✗ 批量索引失败: {e}")
            return 0, len(documents)
    
    def delete_document(self, index: str, doc_id: str) -> bool:
        """删除文档"""
        if not self.is_connected():
            return False
        
        try:
            self._client.delete(index=index, id=doc_id)
            return True
        except NotFoundError:
            return False
        except Exception as e:
            print(f"✗ 删除文档失败: {e}")
            return False
    
    def create_suggestions_index(self):
        """创建搜索建议索引"""
        if not self.is_connected():
            return False
        
        mapping = {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": {
                    "analyzer": {
                        "keyword_analyzer": {
                            "type": "custom",
                            "tokenizer": "keyword",
                            "filter": ["lowercase"]
                        }
                    }
                }
            },
            "mappings": {
                "properties": {
                    "keyword": {
                        "type": "text",
                        "analyzer": "keyword_analyzer",
                        "fields": {
                            "keyword": {"type": "keyword"}
                        }
                    },
                    "search_count": {"type": "integer"},
                    "last_searched": {"type": "date"},
                    "category": {"type": "keyword"}
                }
            }
        }
        
        try:
            if not self._client.indices.exists(index=INDEX_SUGGESTIONS):
                self._client.indices.create(index=INDEX_SUGGESTIONS, body=mapping)
                print(f"✓ 索引 {INDEX_SUGGESTIONS} 创建成功")
            return True
        except Exception as e:
            print(f"✗ 创建建议索引失败: {e}")
            return False


search_service = SearchService()
