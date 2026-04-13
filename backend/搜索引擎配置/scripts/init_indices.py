#!/usr/bin/env python3
"""
Elasticsearch 索引初始化脚本
用于创建和管理索引映射
"""
import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# 添加项目路径
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from elasticsearch import Elasticsearch
from elasticsearch.exceptions import NotFoundError, RequestError


class ElasticsearchIndexManager:
    """Elasticsearch 索引管理器"""
    
    def __init__(
        self,
        hosts: list = None,
        username: str = "elastic",
        password: str = None,
        verify_certs: bool = False
    ):
        """
        初始化 Elasticsearch 客户端
        
        Args:
            hosts: Elasticsearch 主机列表
            username: 用户名
            password: 密码
            verify_certs: 是否验证 SSL 证书
        """
        if hosts is None:
            hosts = ["http://localhost:9200"]
        
        if password is None:
            password = os.getenv("ELASTICSEARCH_PASSWORD", "changeme")
        
        self.client = Elasticsearch(
            hosts=hosts,
            basic_auth=(username, password),
            verify_certs=verify_certs
        )
        
        self.mappings_dir = Path(__file__).parent.parent / "mappings"
    
    def check_connection(self) -> bool:
        """检查 Elasticsearch 连接"""
        try:
            return self.client.ping()
        except Exception as e:
            print(f"连接失败: {str(e)}")
            return False
    
    def load_mapping(self, index_name: str) -> Optional[Dict[str, Any]]:
        """
        加载索引映射配置
        
        Args:
            index_name: 索引名称
        
        Returns:
            映射配置字典
        """
        mapping_file = self.mappings_dir / f"{index_name}.json"
        
        if not mapping_file.exists():
            print(f"映射文件不存在: {mapping_file}")
            return None
        
        try:
            with open(mapping_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"加载映射文件失败: {str(e)}")
            return None
    
    def index_exists(self, index_name: str) -> bool:
        """检查索引是否存在"""
        return self.client.indices.exists(index=index_name)
    
    def create_index(
        self,
        index_name: str,
        mapping: Dict[str, Any] = None,
        recreate: bool = False
    ) -> bool:
        """
        创建索引
        
        Args:
            index_name: 索引名称
            mapping: 索引映射配置
            recreate: 如果索引已存在是否重新创建
        
        Returns:
            是否创建成功
        """
        if self.index_exists(index_name):
            if recreate:
                print(f"索引 {index_name} 已存在，正在删除...")
                self.delete_index(index_name)
            else:
                print(f"索引 {index_name} 已存在，跳过创建")
                return False
        
        if mapping is None:
            mapping = self.load_mapping(index_name)
            if mapping is None:
                return False
        
        try:
            self.client.indices.create(
                index=index_name,
                body=mapping
            )
            print(f"索引 {index_name} 创建成功")
            return True
        except RequestError as e:
            print(f"创建索引失败: {str(e)}")
            return False
    
    def delete_index(self, index_name: str) -> bool:
        """
        删除索引
        
        Args:
            index_name: 索引名称
        
        Returns:
            是否删除成功
        """
        try:
            self.client.indices.delete(index=index_name)
            print(f"索引 {index_name} 删除成功")
            return True
        except NotFoundError:
            print(f"索引 {index_name} 不存在")
            return False
        except Exception as e:
            print(f"删除索引失败: {str(e)}")
            return False
    
    def update_mapping(
        self,
        index_name: str,
        mapping: Dict[str, Any] = None
    ) -> bool:
        """
        更新索引映射（只能添加新字段，不能修改现有字段）
        
        Args:
            index_name: 索引名称
            mapping: 新的映射配置
        
        Returns:
            是否更新成功
        """
        if not self.index_exists(index_name):
            print(f"索引 {index_name} 不存在")
            return False
        
        if mapping is None:
            mapping = self.load_mapping(index_name)
            if mapping is None:
                return False
        
        try:
            # 只更新 mappings 部分
            self.client.indices.put_mapping(
                index=index_name,
                body=mapping.get("mappings", {})
            )
            print(f"索引 {index_name} 映射更新成功")
            return True
        except RequestError as e:
            print(f"更新映射失败: {str(e)}")
            return False
    
    def get_mapping(self, index_name: str) -> Optional[Dict[str, Any]]:
        """
        获取索引映射
        
        Args:
            index_name: 索引名称
        
        Returns:
            映射配置
        """
        try:
            response = self.client.indices.get_mapping(index=index_name)
            return response.get(index_name, {}).get("mappings", {})
        except NotFoundError:
            print(f"索引 {index_name} 不存在")
            return None
        except Exception as e:
            print(f"获取映射失败: {str(e)}")
            return None
    
    def list_indices(self) -> list:
        """列出所有索引"""
        try:
            indices = self.client.indices.get_alias(index="*")
            return list(indices.keys())
        except Exception as e:
            print(f"获取索引列表失败: {str(e)}")
            return []
    
    def get_index_stats(self, index_name: str) -> Optional[Dict[str, Any]]:
        """
        获取索引统计信息
        
        Args:
            index_name: 索引名称
        
        Returns:
            统计信息
        """
        try:
            return self.client.indices.stats(index=index_name)
        except Exception as e:
            print(f"获取索引统计信息失败: {str(e)}")
            return None
    
    def create_alias(self, index_name: str, alias_name: str) -> bool:
        """
        创建索引别名
        
        Args:
            index_name: 索引名称
            alias_name: 别名
        
        Returns:
            是否创建成功
        """
        try:
            self.client.indices.put_alias(
                index=index_name,
                name=alias_name
            )
            print(f"别名 {alias_name} -> {index_name} 创建成功")
            return True
        except Exception as e:
            print(f"创建别名失败: {str(e)}")
            return False
    
    def init_all_indices(self, recreate: bool = False) -> Dict[str, bool]:
        """
        初始化所有索引
        
        Args:
            recreate: 是否重新创建已存在的索引
        
        Returns:
            各索引创建结果
        """
        indices = ["courses", "contents", "knowledge"]
        results = {}
        
        for index_name in indices:
            print(f"\n正在创建索引: {index_name}")
            results[index_name] = self.create_index(
                index_name=index_name,
                recreate=recreate
            )
        
        return results


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Elasticsearch 索引管理工具")
    parser.add_argument(
        "--host",
        default="http://localhost:9200",
        help="Elasticsearch 主机地址"
    )
    parser.add_argument(
        "--username",
        default="elastic",
        help="用户名"
    )
    parser.add_argument(
        "--password",
        default=None,
        help="密码"
    )
    parser.add_argument(
        "--action",
        choices=["create", "delete", "update", "list", "init", "stats"],
        default="init",
        help="执行的操作"
    )
    parser.add_argument(
        "--index",
        default=None,
        help="索引名称"
    )
    parser.add_argument(
        "--recreate",
        action="store_true",
        help="重新创建已存在的索引"
    )
    
    args = parser.parse_args()
    
    # 初始化管理器
    manager = ElasticsearchIndexManager(
        hosts=[args.host],
        username=args.username,
        password=args.password
    )
    
    # 检查连接
    if not manager.check_connection():
        print("无法连接到 Elasticsearch，请检查配置")
        sys.exit(1)
    
    print("Elasticsearch 连接成功\n")
    
    # 执行操作
    if args.action == "init":
        results = manager.init_all_indices(recreate=args.recreate)
        print("\n" + "="*50)
        print("初始化结果:")
        for index_name, success in results.items():
            status = "成功" if success else "失败/跳过"
            print(f"  {index_name}: {status}")
    
    elif args.action == "create":
        if not args.index:
            print("请指定索引名称 (--index)")
            sys.exit(1)
        success = manager.create_index(
            index_name=args.index,
            recreate=args.recreate
        )
        sys.exit(0 if success else 1)
    
    elif args.action == "delete":
        if not args.index:
            print("请指定索引名称 (--index)")
            sys.exit(1)
        success = manager.delete_index(args.index)
        sys.exit(0 if success else 1)
    
    elif args.action == "update":
        if not args.index:
            print("请指定索引名称 (--index)")
            sys.exit(1)
        success = manager.update_mapping(args.index)
        sys.exit(0 if success else 1)
    
    elif args.action == "list":
        indices = manager.list_indices()
        print(f"共有 {len(indices)} 个索引:")
        for index in sorted(indices):
            print(f"  - {index}")
    
    elif args.action == "stats":
        if args.index:
            stats = manager.get_index_stats(args.index)
            if stats:
                print(json.dumps(stats, indent=2, ensure_ascii=False))
        else:
            indices = manager.list_indices()
            for index in indices:
                stats = manager.get_index_stats(index)
                if stats:
                    doc_count = stats["indices"][index]["total"]["docs"]["count"]
                    store_size = stats["indices"][index]["total"]["store"]["size_in_bytes"]
                    print(f"{index}: {doc_count} 文档, {store_size} 字节")


if __name__ == "__main__":
    main()
