"""
AI内容版本控制服务

提供版本管理、比较、回滚等功能
"""
import uuid
import json
import difflib
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy import desc, asc
from sqlalchemy.exc import SQLAlchemyError

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.content_version import (
    AIContentVersion,
    ContentVersionHistory,
    ContentVersionComparison,
    db
)


class VersionControlService:
    """
    版本控制服务
    
    提供完整的版本管理功能
    """
    
    def __init__(self):
        self.db = db
    
    # ==================== 版本CRUD ====================
    
    def create_version(self, content_id: Optional[str] = None,
                      content_type: str = '',
                      title: Optional[str] = None,
                      content_data: Dict[str, Any] = None,
                      generation_params: Dict[str, Any] = None,
                      prompt_used: Optional[str] = None,
                      created_by: int = 0,
                      change_summary: Optional[str] = None,
                      change_type: str = 'create',
                      parent_version_id: Optional[int] = None,
                      version_tag: Optional[str] = None) -> AIContentVersion:
        """
        创建新版本
        
        Args:
            content_id: 内容ID（为空则自动生成）
            content_type: 内容类型
            title: 标题
            content_data: 内容数据
            generation_params: 生成参数
            prompt_used: 使用的提示词
            created_by: 创建者ID
            change_summary: 变更摘要
            change_type: 变更类型
            parent_version_id: 父版本ID
            version_tag: 版本标签
            
        Returns:
            创建的版本对象
        """
        try:
            # 生成内容ID
            if not content_id:
                content_id = str(uuid.uuid4())
            
            # 获取下一个版本号
            latest_version = AIContentVersion.query.filter_by(
                content_id=content_id,
                is_deleted=False
            ).order_by(desc(AIContentVersion.version_number)).first()
            
            version_number = (latest_version.version_number + 1) if latest_version else 1
            
            # 创建版本
            version = AIContentVersion(
                content_id=content_id,
                version_number=version_number,
                version_tag=version_tag,
                content_type=content_type,
                title=title,
                content=content_data or {},
                generation_params_dict=generation_params or {},
                prompt_used=prompt_used,
                created_by=created_by,
                change_summary=change_summary,
                change_type=change_type,
                parent_version_id=parent_version_id
            )
            
            self.db.session.add(version)
            self.db.session.commit()
            
            # 记录历史
            self._record_history(
                content_id=content_id,
                version_id=version.id,
                action='create',
                action_by=created_by,
                details={'version_number': version_number}
            )
            
            return version
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"创建版本失败: {str(e)}")
    
    def get_version(self, version_id: int) -> Optional[AIContentVersion]:
        """
        获取单个版本
        
        Args:
            version_id: 版本ID
            
        Returns:
            版本对象或None
        """
        return AIContentVersion.query.filter_by(
            id=version_id,
            is_deleted=False
        ).first()
    
    def get_version_by_number(self, content_id: str,
                             version_number: int) -> Optional[AIContentVersion]:
        """
        通过版本号获取版本
        
        Args:
            content_id: 内容ID
            version_number: 版本号
            
        Returns:
            版本对象或None
        """
        return AIContentVersion.query.filter_by(
            content_id=content_id,
            version_number=version_number,
            is_deleted=False
        ).first()
    
    def get_versions(self, content_id: str,
                    limit: int = 50,
                    offset: int = 0) -> Tuple[List[AIContentVersion], int]:
        """
        获取内容的所有版本
        
        Args:
            content_id: 内容ID
            limit: 数量限制
            offset: 偏移量
            
        Returns:
            (版本列表, 总数)
        """
        query = AIContentVersion.query.filter_by(
            content_id=content_id,
            is_deleted=False
        )
        
        total = query.count()
        
        versions = query.order_by(
            desc(AIContentVersion.version_number)
        ).offset(offset).limit(limit).all()
        
        return versions, total
    
    def get_user_versions(self, user_id: int,
                         content_type: Optional[str] = None,
                         limit: int = 50,
                         offset: int = 0) -> Tuple[List[AIContentVersion], int]:
        """
        获取用户的所有版本
        
        Args:
            user_id: 用户ID
            content_type: 内容类型筛选
            limit: 数量限制
            offset: 偏移量
            
        Returns:
            (版本列表, 总数)
        """
        query = AIContentVersion.query.filter_by(
            created_by=user_id,
            is_deleted=False
        )
        
        if content_type:
            query = query.filter_by(content_type=content_type)
        
        total = query.count()
        
        versions = query.order_by(
            desc(AIContentVersion.created_at)
        ).offset(offset).limit(limit).all()
        
        return versions, total
    
    def update_version(self, version_id: int,
                      title: Optional[str] = None,
                      version_tag: Optional[str] = None,
                      change_summary: Optional[str] = None,
                      metadata: Optional[Dict[str, Any]] = None) -> AIContentVersion:
        """
        更新版本信息（不修改内容）
        
        Args:
            version_id: 版本ID
            title: 标题
            version_tag: 版本标签
            change_summary: 变更摘要
            metadata: 元数据
            
        Returns:
            更新后的版本对象
        """
        try:
            version = self.get_version(version_id)
            if not version:
                raise Exception("版本不存在")
            
            if title is not None:
                version.title = title
            if version_tag is not None:
                version.version_tag = version_tag
            if change_summary is not None:
                version.change_summary = change_summary
            if metadata is not None:
                version.metadata = metadata
            
            self.db.session.commit()
            
            return version
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"更新版本失败: {str(e)}")
    
    def delete_version(self, version_id: int,
                      soft_delete: bool = True) -> bool:
        """
        删除版本
        
        Args:
            version_id: 版本ID
            soft_delete: 是否软删除
            
        Returns:
            是否成功
        """
        try:
            version = self.get_version(version_id)
            if not version:
                return False
            
            if soft_delete:
                version.soft_delete()
            else:
                self.db.session.delete(version)
            
            self.db.session.commit()
            
            # 记录历史
            self._record_history(
                content_id=version.content_id,
                version_id=version_id,
                action='delete',
                action_by=version.created_by,
                details={'soft_delete': soft_delete}
            )
            
            return True
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"删除版本失败: {str(e)}")
    
    # ==================== 版本比较 ====================
    
    def compare_versions(self, base_version_id: int,
                        compare_version_id: int,
                        created_by: int = 0) -> ContentVersionComparison:
        """
        比较两个版本
        
        Args:
            base_version_id: 基础版本ID
            compare_version_id: 比较版本ID
            created_by: 创建者ID
            
        Returns:
            比较结果对象
        """
        try:
            base_version = self.get_version(base_version_id)
            compare_version = self.get_version(compare_version_id)
            
            if not base_version or not compare_version:
                raise Exception("版本不存在")
            
            # 确保是同一内容
            if base_version.content_id != compare_version.content_id:
                raise Exception("只能比较同一内容的不同版本")
            
            # 执行比较
            diff_result = self._compute_diff(
                base_version.content,
                compare_version.content
            )
            
            # 创建比较记录
            comparison = ContentVersionComparison(
                content_id=base_version.content_id,
                base_version_id=base_version_id,
                compare_version_id=compare_version_id,
                result=diff_result,
                diff_summary=self._generate_diff_summary(diff_result),
                additions_count=diff_result.get('additions', 0),
                deletions_count=diff_result.get('deletions', 0),
                modifications_count=diff_result.get('modifications', 0),
                created_by=created_by
            )
            
            self.db.session.add(comparison)
            self.db.session.commit()
            
            # 记录历史
            self._record_history(
                content_id=base_version.content_id,
                version_id=compare_version_id,
                action='compare',
                action_by=created_by,
                details={
                    'base_version_id': base_version_id,
                    'compare_version_id': compare_version_id
                }
            )
            
            return comparison
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"版本比较失败: {str(e)}")
    
    def _compute_diff(self, base_content: Dict[str, Any],
                     compare_content: Dict[str, Any]) -> Dict[str, Any]:
        """
        计算两个内容的差异
        
        Args:
            base_content: 基础内容
            compare_content: 比较内容
            
        Returns:
            差异结果
        """
        result = {
            'additions': 0,
            'deletions': 0,
            'modifications': 0,
            'details': []
        }
        
        # 将内容转为字符串进行比较
        base_text = json.dumps(base_content, ensure_ascii=False, indent=2)
        compare_text = json.dumps(compare_content, ensure_ascii=False, indent=2)
        
        # 使用difflib计算差异
        diff = list(difflib.unified_diff(
            base_text.splitlines(keepends=True),
            compare_text.splitlines(keepends=True),
            fromfile='base',
            tofile='compare'
        ))
        
        # 分析差异
        for line in diff:
            if line.startswith('+') and not line.startswith('+++'):
                result['additions'] += 1
                result['details'].append({
                    'type': 'add',
                    'content': line[1:].strip()
                })
            elif line.startswith('-') and not line.startswith('---'):
                result['deletions'] += 1
                result['details'].append({
                    'type': 'delete',
                    'content': line[1:].strip()
                })
        
        # 计算修改数（简化计算）
        result['modifications'] = min(result['additions'], result['deletions'])
        
        return result
    
    def _generate_diff_summary(self, diff_result: Dict[str, Any]) -> str:
        """生成差异摘要"""
        additions = diff_result.get('additions', 0)
        deletions = diff_result.get('deletions', 0)
        modifications = diff_result.get('modifications', 0)
        
        parts = []
        if additions > 0:
            parts.append(f"新增 {additions} 处")
        if deletions > 0:
            parts.append(f"删除 {deletions} 处")
        if modifications > 0:
            parts.append(f"修改 {modifications} 处")
        
        return '，'.join(parts) if parts else "无变化"
    
    # ==================== 版本回滚 ====================
    
    def rollback_to_version(self, version_id: int,
                           created_by: int = 0,
                           change_summary: Optional[str] = None) -> AIContentVersion:
        """
        回滚到指定版本
        
        Args:
            version_id: 目标版本ID
            created_by: 操作者ID
            change_summary: 变更摘要
            
        Returns:
            新版本对象（回滚后的版本）
        """
        try:
            target_version = self.get_version(version_id)
            if not target_version:
                raise Exception("目标版本不存在")
            
            # 创建新版本，复制目标版本的内容
            new_version = self.create_version(
                content_id=target_version.content_id,
                content_type=target_version.content_type,
                title=target_version.title,
                content_data=target_version.content,
                generation_params=target_version.generation_params_dict,
                prompt_used=target_version.prompt_used,
                created_by=created_by,
                change_summary=change_summary or f"回滚到版本 {target_version.version_number}",
                change_type='rollback',
                parent_version_id=target_version.id,
                version_tag='rollback'
            )
            
            # 记录历史
            self._record_history(
                content_id=target_version.content_id,
                version_id=new_version.id,
                action='rollback',
                action_by=created_by,
                details={
                    'rollback_to_version_id': version_id,
                    'rollback_to_version_number': target_version.version_number
                }
            )
            
            return new_version
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"版本回滚失败: {str(e)}")
    
    # ==================== 版本历史 ====================
    
    def get_version_history(self, content_id: str,
                           limit: int = 100,
                           offset: int = 0) -> Tuple[List[ContentVersionHistory], int]:
        """
        获取版本历史
        
        Args:
            content_id: 内容ID
            limit: 数量限制
            offset: 偏移量
            
        Returns:
            (历史记录列表, 总数)
        """
        query = ContentVersionHistory.query.filter_by(
            content_id=content_id
        )
        
        total = query.count()
        
        history = query.order_by(
            desc(ContentVersionHistory.action_at)
        ).offset(offset).limit(limit).all()
        
        return history, total
    
    def _record_history(self, content_id: str,
                       version_id: int,
                       action: str,
                       action_by: int,
                       details: Dict[str, Any] = None):
        """记录版本操作历史"""
        try:
            history = ContentVersionHistory(
                content_id=content_id,
                version_id=version_id,
                action=action,
                action_by=action_by,
                details=details or {}
            )
            
            self.db.session.add(history)
            self.db.session.commit()
            
        except SQLAlchemyError:
            self.db.session.rollback()
            # 历史记录失败不影响主流程
    
    # ==================== 辅助功能 ====================
    
    def get_latest_version(self, content_id: str) -> Optional[AIContentVersion]:
        """获取最新版本"""
        return AIContentVersion.query.filter_by(
            content_id=content_id,
            is_deleted=False
        ).order_by(desc(AIContentVersion.version_number)).first()
    
    def get_version_tree(self, content_id: str) -> Dict[str, Any]:
        """
        获取版本树
        
        Args:
            content_id: 内容ID
            
        Returns:
            版本树结构
        """
        versions = AIContentVersion.query.filter_by(
            content_id=content_id,
            is_deleted=False
        ).order_by(asc(AIContentVersion.version_number)).all()
        
        # 构建树结构
        version_map = {v.id: v for v in versions}
        tree = {'root': None, 'nodes': {}}
        
        for version in versions:
            node = {
                'id': version.id,
                'version_number': version.version_number,
                'parent_id': version.parent_version_id,
                'children': []
            }
            
            tree['nodes'][version.id] = node
            
            if version.parent_version_id:
                parent = tree['nodes'].get(version.parent_version_id)
                if parent:
                    parent['children'].append(version.id)
            else:
                tree['root'] = version.id
        
        return tree
    
    def tag_version(self, version_id: int,
                   tag: str,
                   created_by: int = 0) -> AIContentVersion:
        """
        为版本添加标签
        
        Args:
            version_id: 版本ID
            tag: 标签
            created_by: 操作者ID
            
        Returns:
            更新后的版本对象
        """
        return self.update_version(
            version_id=version_id,
            version_tag=tag
        )


# 全局服务实例
version_control_service = VersionControlService()
