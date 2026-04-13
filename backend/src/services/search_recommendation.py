"""
智能搜索推荐服务

基于用户搜索历史、热门搜索、协同过滤等算法提供智能推荐
"""
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import Counter
from flask import current_app

from src.models.search_log import SearchLog, SearchSuggestion, UserSearchHistory
from src.models.user import db


class SearchRecommendationService:
    """智能搜索推荐服务"""
    
    def __init__(self):
        self.popular_cache_timeout = 3600
        self.personalized_timeout = 300
    
    def _get_cache(self):
        """获取缓存实例"""
        try:
            if hasattr(current_app, 'extensions') and 'cache' in current_app.extensions:
                return current_app.extensions['cache']
        except:
            pass
        return None
    
    def _get_from_cache(self, key: str) -> tuple:
        """从缓存获取数据"""
        cache = self._get_cache()
        if cache:
            value = cache.get(key)
            return value, value is not None
        return None, False
    
    def _set_to_cache(self, key: str, value: Any, timeout: int = 300):
        """设置缓存"""
        cache = self._get_cache()
        if cache:
            cache.set(key, value, timeout=timeout)
    
    def get_hot_searches(self, limit: int = 10, time_range: str = 'week') -> List[Dict]:
        """
        获取热门搜索词
        
        Args:
            limit: 返回数量
            time_range: 时间范围 (day, week, month)
            
        Returns:
            热门搜索词列表
        """
        cache_key = f'hot_searches:{time_range}:{limit}'
        cached, found = self._get_from_cache(cache_key)
        if found:
            return cached
        
        time_filters = {
            'day': timedelta(days=1),
            'week': timedelta(weeks=1),
            'month': timedelta(days=30)
        }
        
        since = datetime.utcnow() - time_filters.get(time_range, timedelta(weeks=1))
        
        try:
            results = db.session.query(
                SearchLog.query,
                db.func.count(SearchLog.id).label('count')
            ).filter(
                SearchLog.created_at >= since
            ).group_by(
                SearchLog.query
            ).order_by(
                db.desc('count')
            ).limit(limit).all()
            
            hot_searches = []
            for query, count in results:
                hot_searches.append({
                    'keyword': query,
                    'count': count,
                    'trending': self._is_trending(query, count, time_range)
                })
            
            self._set_to_cache(cache_key, hot_searches, self.popular_cache_timeout)
            
            return hot_searches
            
        except Exception as e:
            print(f"✗ 获取热门搜索失败: {e}")
            return []
    
    def _is_trending(self, query: str, current_count: int, time_range: str) -> bool:
        """判断是否为趋势搜索词"""
        try:
            time_filters = {
                'day': timedelta(days=1),
                'week': timedelta(weeks=1),
                'month': timedelta(days=30)
            }
            
            current_since = datetime.utcnow() - time_filters.get(time_range, timedelta(weeks=1))
            previous_since = current_since - time_filters.get(time_range, timedelta(weeks=1))
            
            previous_count = db.session.query(
                db.func.count(SearchLog.id)
            ).filter(
                SearchLog.query == query,
                SearchLog.created_at >= previous_since,
                SearchLog.created_at < current_since
            ).scalar() or 0
            
            if previous_count == 0:
                return current_count > 5
            
            growth_rate = (current_count - previous_count) / previous_count
            return growth_rate > 0.5
            
        except:
            return False
    
    def get_user_recommendations(self, user_id: int, limit: int = 10) -> List[Dict]:
        """
        获取用户个性化推荐
        
        Args:
            user_id: 用户ID
            limit: 返回数量
            
        Returns:
            推荐搜索词列表
        """
        if not user_id:
            return self.get_hot_searches(limit)
        
        cache_key = f'user_recommendations:{user_id}:{limit}'
        cached, found = self._get_from_cache(cache_key)
        if found:
            return cached
        
        recommendations = []
        
        try:
            user_history = self._get_user_search_history(user_id, limit=50)
            
            if user_history:
                similar_users_searches = self._get_similar_users_searches(user_id, user_history)
                recommendations.extend(similar_users_searches[:5])
            
            category_recommendations = self._get_category_recommendations(user_history)
            recommendations.extend(category_recommendations[:3])
            
            hot_searches = self.get_hot_searches(limit=5)
            for item in hot_searches:
                if item['keyword'] not in [r['keyword'] for r in recommendations]:
                    recommendations.append(item)
            
            recommendations = recommendations[:limit]
            
            self._set_to_cache(cache_key, recommendations, self.personalized_timeout)
            
            return recommendations
            
        except Exception as e:
            print(f"✗ 获取用户推荐失败: {e}")
            return self.get_hot_searches(limit)
    
    def _get_user_search_history(self, user_id: int, limit: int = 50) -> List[str]:
        """获取用户搜索历史"""
        try:
            history = UserSearchHistory.query.filter_by(
                user_id=user_id
            ).order_by(
                UserSearchHistory.last_searched_at.desc()
            ).limit(limit).all()
            
            return [h.query for h in history]
        except:
            return []
    
    def _get_similar_users_searches(self, user_id: int, user_history: List[str]) -> List[Dict]:
        """获取相似用户的搜索"""
        try:
            if not user_history:
                return []
            
            similar_users = db.session.query(
                UserSearchHistory.user_id,
                db.func.count(UserSearchHistory.id).label('similarity')
            ).filter(
                UserSearchHistory.query.in_(user_history[:10]),
                UserSearchHistory.user_id != user_id
            ).group_by(
                UserSearchHistory.user_id
            ).order_by(
                db.desc('similarity')
            ).limit(10).all()
            
            if not similar_users:
                return []
            
            similar_user_ids = [u.user_id for u in similar_users]
            
            similar_searches = db.session.query(
                UserSearchHistory.query,
                db.func.count(UserSearchHistory.id).label('count')
            ).filter(
                UserSearchHistory.user_id.in_(similar_user_ids),
                ~UserSearchHistory.query.in_(user_history)
            ).group_by(
                UserSearchHistory.query
            ).order_by(
                db.desc('count')
            ).limit(5).all()
            
            return [{'keyword': s.query, 'count': s.count, 'source': 'similar_users'} for s in similar_searches]
            
        except Exception as e:
            print(f"✗ 获取相似用户搜索失败: {e}")
            return []
    
    def _get_category_recommendations(self, user_history: List[str]) -> List[Dict]:
        """基于搜索历史获取分类推荐"""
        try:
            if not user_history:
                return []
            
            category_counts = db.session.query(
                SearchLog.index_type,
                db.func.count(SearchLog.id).label('count')
            ).filter(
                SearchLog.query.in_(user_history)
            ).group_by(
                SearchLog.index_type
            ).order_by(
                db.desc('count')
            ).first()
            
            if not category_counts:
                return []
            
            preferred_category = category_counts.index_type
            
            category_searches = db.session.query(
                SearchLog.query,
                db.func.count(SearchLog.id).label('count')
            ).filter(
                SearchLog.index_type == preferred_category,
                ~SearchLog.query.in_(user_history)
            ).group_by(
                SearchLog.query
            ).order_by(
                db.desc('count')
            ).limit(3).all()
            
            return [{'keyword': s.query, 'count': s.count, 'source': 'category'} for s in category_searches]
            
        except Exception as e:
            print(f"✗ 获取分类推荐失败: {e}")
            return []
    
    def get_related_searches(self, query: str, limit: int = 10) -> List[str]:
        """
        获取相关搜索词
        
        Args:
            query: 原始搜索词
            limit: 返回数量
            
        Returns:
            相关搜索词列表
        """
        cache_key = f'related_searches:{query}:{limit}'
        cached, found = self._get_from_cache(cache_key)
        if found:
            return cached
        
        try:
            related = db.session.query(
                SearchLog.query,
                db.func.count(SearchLog.id).label('count')
            ).filter(
                SearchLog.query != query,
                SearchLog.user_id.in_(
                    db.session.query(SearchLog.user_id).filter(
                        SearchLog.query == query,
                        SearchLog.user_id.isnot(None)
                    ).distinct()
                )
            ).group_by(
                SearchLog.query
            ).order_by(
                db.desc('count')
            ).limit(limit).all()
            
            result = [r.query for r in related]
            
            self._set_to_cache(cache_key, result, 600)
            
            return result
            
        except Exception as e:
            print(f"✗ 获取相关搜索失败: {e}")
            return []
    
    def record_search(
        self,
        query: str,
        user_id: int = None,
        index_type: str = 'all',
        results_count: int = 0,
        response_time_ms: int = 0,
        filters: Dict = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> bool:
        """
        记录搜索日志
        
        Args:
            query: 搜索词
            user_id: 用户ID
            index_type: 搜索索引类型
            results_count: 结果数量
            response_time_ms: 响应时间(毫秒)
            filters: 过滤条件
            ip_address: IP地址
            user_agent: 用户代理
            
        Returns:
            是否记录成功
        """
        try:
            search_log = SearchLog(
                user_id=user_id,
                query=query,
                index_type=index_type,
                results_count=results_count,
                response_time_ms=response_time_ms,
                filters=json.dumps(filters, ensure_ascii=False) if filters else None,
                ip_address=ip_address,
                user_agent=user_agent
            )
            db.session.add(search_log)
            
            self._update_search_suggestion(query)
            
            if user_id:
                self._update_user_history(user_id, query)
            
            db.session.commit()
            return True
            
        except Exception as e:
            print(f"✗ 记录搜索日志失败: {e}")
            db.session.rollback()
            return False
    
    def _update_search_suggestion(self, query: str):
        """更新搜索建议统计"""
        try:
            suggestion = SearchSuggestion.query.filter_by(keyword=query).first()
            if suggestion:
                suggestion.search_count += 1
                suggestion.last_searched_at = datetime.utcnow()
            else:
                suggestion = SearchSuggestion(keyword=query)
                db.session.add(suggestion)
        except Exception as e:
            print(f"✗ 更新搜索建议失败: {e}")
    
    def _update_user_history(self, user_id: int, query: str):
        """更新用户搜索历史"""
        try:
            history = UserSearchHistory.query.filter_by(
                user_id=user_id,
                query=query
            ).first()
            
            if history:
                history.search_count += 1
                history.last_searched_at = datetime.utcnow()
            else:
                history = UserSearchHistory(user_id=user_id, query=query)
                db.session.add(history)
        except Exception as e:
            print(f"✗ 更新用户历史失败: {e}")
    
    def record_click(
        self,
        query: str,
        result_id: str,
        result_type: str,
        user_id: int = None
    ) -> bool:
        """
        记录搜索结果点击
        
        Args:
            query: 搜索词
            result_id: 点击结果ID
            result_type: 结果类型
            user_id: 用户ID
            
        Returns:
            是否记录成功
        """
        try:
            search_log = SearchLog.query.filter_by(
                query=query,
                user_id=user_id
            ).order_by(
                SearchLog.created_at.desc()
            ).first()
            
            if search_log:
                search_log.clicked_result_id = result_id
                search_log.clicked_result_type = result_type
                db.session.commit()
            
            return True
            
        except Exception as e:
            print(f"✗ 记录点击失败: {e}")
            return False
    
    def get_search_analytics(self, days: int = 7) -> Dict:
        """
        获取搜索分析数据
        
        Args:
            days: 统计天数
            
        Returns:
            分析数据字典
        """
        since = datetime.utcnow() - timedelta(days=days)
        
        try:
            total_searches = SearchLog.query.filter(
                SearchLog.created_at >= since
            ).count()
            
            unique_queries = db.session.query(
                db.func.count(db.distinct(SearchLog.query))
            ).filter(
                SearchLog.created_at >= since
            ).scalar() or 0
            
            avg_response_time = db.session.query(
                db.func.avg(SearchLog.response_time_ms)
            ).filter(
                SearchLog.created_at >= since,
                SearchLog.response_time_ms > 0
            ).scalar() or 0
            
            avg_results = db.session.query(
                db.func.avg(SearchLog.results_count)
            ).filter(
                SearchLog.created_at >= since
            ).scalar() or 0
            
            zero_result_rate = db.session.query(
                db.func.count(SearchLog.id)
            ).filter(
                SearchLog.created_at >= since,
                SearchLog.results_count == 0
            ).scalar() or 0
            
            zero_result_rate = (zero_result_rate / total_searches * 100) if total_searches > 0 else 0
            
            top_queries = db.session.query(
                SearchLog.query,
                db.func.count(SearchLog.id).label('count')
            ).filter(
                SearchLog.created_at >= since
            ).group_by(
                SearchLog.query
            ).order_by(
                db.desc('count')
            ).limit(10).all()
            
            daily_stats = db.session.query(
                db.func.date(SearchLog.created_at).label('date'),
                db.func.count(SearchLog.id).label('count')
            ).filter(
                SearchLog.created_at >= since
            ).group_by(
                db.func.date(SearchLog.created_at)
            ).order_by('date').all()
            
            return {
                'period_days': days,
                'total_searches': total_searches,
                'unique_queries': unique_queries,
                'avg_response_time_ms': round(avg_response_time, 2),
                'avg_results_count': round(avg_results, 2),
                'zero_result_rate': round(zero_result_rate, 2),
                'top_queries': [{'query': q.query, 'count': q.count} for q in top_queries],
                'daily_stats': [{'date': str(d.date), 'count': d.count} for d in daily_stats]
            }
            
        except Exception as e:
            print(f"✗ 获取搜索分析失败: {e}")
            return {}


import json

search_recommendation_service = SearchRecommendationService()
