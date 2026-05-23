# Elasticsearch 搜索引擎配置

## 概述

本项目使用 Elasticsearch 8.11.0 作为搜索引擎，为智能教学系统提供全文检索、自动补全、智能推荐等功能。

## 目录结构

```
elasticsearch/
├── config/                 # 配置文件
│   ├── elasticsearch.yml  # Elasticsearch 主配置
│   └── jvm.options        # JVM 配置
├── mappings/              # 索引映射定义
│   ├── courses.json       # 课程索引映射
│   ├── contents.json      # 内容索引映射
│   └── knowledge.json     # 知识库索引映射
├── scripts/               # 管理脚本
│   ├── init_indices.py    # 索引初始化脚本
│   └── setup.sh           # 一键安装脚本
└── README.md             # 说明文档
```

## 快速开始

### 1. 一键安装

```bash
# 执行安装脚本
bash elasticsearch/scripts/setup.sh
```

### 2. 手动安装

```bash
# 启动 Elasticsearch
docker-compose -f docker-compose.elasticsearch.yml up -d

# 等待服务启动（约30秒）
sleep 30

# 初始化索引
python elasticsearch/scripts/init_indices.py --action init
```

## 索引说明

### 1. courses (课程索引)

用于存储课程信息，支持课程搜索、筛选、排序。

**主要字段:**
- `title`: 课程标题 (ik_max_word 分词，boost: 3.0)
- `subtitle`: 副标题 (boost: 2.0)
- `description`: 课程描述 (boost: 1.5)
- `category`: 分类
- `tags`: 标签
- `instructor`: 讲师信息
- `price`: 价格
- `rating`: 评分
- `syllabus`: 课程大纲 (nested 类型)

**特性:**
- IK 中文分词
- 拼音搜索支持
- 多字段搜索权重
- 嵌套文档支持

### 2. contents (内容索引)

用于存储课程内容、文章、文档等。

**主要字段:**
- `title`: 标题 (boost: 3.0)
- `content`: 内容正文
- `content_type`: 内容类型
- `course`: 所属课程信息
- `author`: 作者信息
- `media`: 媒体文件 (nested)
- `attachments`: 附件 (nested)
- `code_snippets`: 代码片段 (nested)

**特性:**
- HTML 标签过滤
- 代码片段分析器
- 高亮显示支持

### 3. knowledge (知识库索引)

用于存储知识库问答、概念解释等。

**主要字段:**
- `title`: 标题 (boost: 3.0)
- `question`: 问题 (boost: 3.5)
- `answer`: 答案
- `entities`: 实体 (nested)
- `concepts`: 概念 (nested)
- `related_questions`: 相关问题 (nested)
- `ai_metadata.embedding_vector`: AI 向量 (dense_vector)

**特性:**
- 同义词扩展
- 语义向量搜索
- 实体识别支持
- BM25 相似度算法

## 分词器配置

### IK 分词器

```json
{
  "analyzer": "ik_max_word_custom",
  "search_analyzer": "ik_smart_custom"
}
```

- `ik_max_word`: 细粒度分词，用于索引
- `ik_smart`: 智能分词，用于搜索

### 拼音分词器

```json
{
  "analyzer": "pinyin_analyzer"
}
```

支持拼音首字母和全拼搜索。

### 同义词分词器

```json
{
  "analyzer": "synonym_analyzer"
}
```

支持同义词扩展，提升搜索召回率。

## 常用操作

### 查看集群健康

```bash
curl -u elastic:changeme http://localhost:9200/_cluster/health
```

### 查看所有索引

```bash
curl -u elastic:changeme http://localhost:9200/_cat/indices
```

### 查看索引映射

```bash
curl -u elastic:changeme http://localhost:9200/courses/_mapping
```

### 搜索测试

```bash
# 课程搜索
curl -u elastic:changeme \
  -X POST "http://localhost:9200/courses/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "multi_match": {
        "query": "Python 编程",
        "fields": ["title^3", "subtitle^2", "description", "tags"]
      }
    },
    "highlight": {
      "fields": {
        "title": {},
        "description": {}
      }
    }
  }'
```

### 自动补全

```bash
curl -u elastic:changeme \
  -X POST "http://localhost:9200/courses/_search" \
  -H "Content-Type: application/json" \
  -d '{
    "suggest": {
      "course-suggest": {
        "prefix": "Pyth",
        "completion": {
          "field": "title.suggest"
        }
      }
    }
  }'
```

## 管理脚本

### 初始化所有索引

```bash
python elasticsearch/scripts/init_indices.py --action init
```

### 创建单个索引

```bash
python elasticsearch/scripts/init_indices.py \
  --action create \
  --index courses
```

### 删除索引

```bash
python elasticsearch/scripts/init_indices.py \
  --action delete \
  --index courses
```

### 更新映射

```bash
python elasticsearch/scripts/init_indices.py \
  --action update \
  --index courses
```

### 查看索引统计

```bash
python elasticsearch/scripts/init_indices.py --action stats
```

## 访问地址

- **Elasticsearch**: http://localhost:9200
- **Kibana**: http://localhost:5601
- **Cerebro**: http://localhost:9000

**默认认证:**
- 用户名: `elastic`
- 密码: `changeme` (可通过环境变量 `ELASTICSEARCH_PASSWORD` 修改)

## 性能优化

### JVM 配置

```
-Xms2g
-Xmx2g
```

根据服务器内存调整，建议设置为物理内存的 50%。

### 索引配置

```json
{
  "index": {
    "number_of_shards": 1,
    "number_of_replicas": 1,
    "refresh_interval": "5s"
  }
}
```

### 缓存配置

```json
{
  "indices.memory.index_buffer_size": "20%",
  "indices.queries.cache.size": "20%",
  "indices.fielddata.cache.size": "30%"
}
```

## 监控

Elasticsearch 已集成到 Prometheus + Grafana 监控体系中。

- **Exporter 端口**: 9114
- **Grafana 仪表板**: 导入 Elasticsearch 官方仪表板

## 故障排除

### 1. 内存锁定失败

```bash
# 宿主机执行
sudo sysctl -w vm.max_map_count=262144
```

### 2. 权限问题

```bash
# 设置目录权限
chmod -R 777 elasticsearch/data
chmod -R 777 elasticsearch/logs
```

### 3. 插件安装失败

```bash
# 手动安装 IK 分词器
docker exec -it zhijiaoxing-elasticsearch bin/elasticsearch-plugin install \
  https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v8.11.0/elasticsearch-analysis-ik-8.11.0.zip

# 重启服务
docker-compose -f docker-compose.elasticsearch.yml restart elasticsearch
```

## 参考文档

- [Elasticsearch 官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [IK 分词器文档](https://github.com/medcl/elasticsearch-analysis-ik)
- [Elasticsearch Python 客户端](https://elasticsearch-py.readthedocs.io/)
