#!/bin/bash
# Elasticsearch 安装和初始化脚本
# 用于一键部署 Elasticsearch 和创建索引

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
ES_VERSION="8.11.0"
ES_PASSWORD="${ELASTICSEARCH_PASSWORD:-changeme}"
KIBANA_PASSWORD="${KIBANA_PASSWORD:-changeme}"

# 打印信息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker
check_docker() {
    print_info "检查 Docker 环境..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    print_info "Docker 环境检查通过"
}

# 创建目录结构
create_directories() {
    print_info "创建目录结构..."
    
    mkdir -p elasticsearch/data
    mkdir -p elasticsearch/logs
    mkdir -p elasticsearch/config
    mkdir -p elasticsearch/mappings
    mkdir -p elasticsearch/scripts
    
    # 设置权限
    chmod -R 777 elasticsearch/data
    chmod -R 777 elasticsearch/logs
    
    print_info "目录结构创建完成"
}

# 启动 Elasticsearch
start_elasticsearch() {
    print_info "启动 Elasticsearch 服务..."
    
    # 检查是否已运行
    if docker ps | grep -q "zhijiaoxing-elasticsearch"; then
        print_warn "Elasticsearch 已在运行"
        return 0
    fi
    
    # 启动服务
    docker-compose -f docker-compose.elasticsearch.yml up -d
    
    # 等待服务启动
    print_info "等待 Elasticsearch 启动..."
    sleep 30
    
    # 检查健康状态
    max_attempts=30
    attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -u "elastic:${ES_PASSWORD}" http://localhost:9200/_cluster/health | grep -q '"status":"green"\|"status":"yellow"'; then
            print_info "Elasticsearch 启动成功"
            return 0
        fi
        print_info "等待 Elasticsearch 就绪... ($attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_error "Elasticsearch 启动超时"
    return 1
}

# 安装 IK 分词器
install_ik_plugin() {
    print_info "安装 IK 分词器插件..."
    
    # 检查插件是否已安装
    if docker exec zhijiaoxing-elasticsearch bin/elasticsearch-plugin list | grep -q "analysis-ik"; then
        print_warn "IK 分词器已安装"
        return 0
    fi
    
    # 安装插件
    docker exec -it zhijiaoxing-elasticsearch bin/elasticsearch-plugin install \
        https://github.com/medcl/elasticsearch-analysis-ik/releases/download/v${ES_VERSION}/elasticsearch-analysis-ik-${ES_VERSION}.zip
    
    # 重启 Elasticsearch
    print_info "重启 Elasticsearch 以应用插件..."
    docker-compose -f docker-compose.elasticsearch.yml restart elasticsearch
    sleep 30
    
    print_info "IK 分词器安装完成"
}

# 安装拼音插件
install_pinyin_plugin() {
    print_info "安装拼音分词器插件..."
    
    # 检查插件是否已安装
    if docker exec zhijiaoxing-elasticsearch bin/elasticsearch-plugin list | grep -q "analysis-pinyin"; then
        print_warn "拼音分词器已安装"
        return 0
    fi
    
    # 安装插件
    docker exec -it zhijiaoxing-elasticsearch bin/elasticsearch-plugin install \
        https://github.com/medcl/elasticsearch-analysis-pinyin/releases/download/v${ES_VERSION}/elasticsearch-analysis-pinyin-${ES_VERSION}.zip
    
    # 重启 Elasticsearch
    print_info "重启 Elasticsearch 以应用插件..."
    docker-compose -f docker-compose.elasticsearch.yml restart elasticsearch
    sleep 30
    
    print_info "拼音分词器安装完成"
}

# 初始化索引
init_indices() {
    print_info "初始化 Elasticsearch 索引..."
    
    # 检查 Python 环境
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 未安装"
        exit 1
    fi
    
    # 安装依赖
    pip3 install elasticsearch -q
    
    # 运行初始化脚本
    python3 elasticsearch/scripts/init_indices.py \
        --host http://localhost:9200 \
        --username elastic \
        --password "${ES_PASSWORD}" \
        --action init
    
    print_info "索引初始化完成"
}

# 创建同义词文件
create_synonyms_file() {
    print_info "创建同义词文件..."
    
    # 创建同义词目录
    docker exec zhijiaoxing-elasticsearch mkdir -p /usr/share/elasticsearch/config/analysis
    
    # 创建同义词文件
    cat > /tmp/synonyms.txt << 'EOF'
# 教育相关同义词
教学,授课,讲课,教课
学习,研习,进修,研学
课程,课件,教程,课程资料
考试,测验,考核,测评
作业,习题,练习,任务
学生,学员,学习者,受教育者
老师,教师,讲师,导师,教员
学校,院校,学院,学府
专业,学科,领域,方向
知识,学问,学识,认知

# 技术相关同义词
编程,程序设计,编码,开发
算法,计算方法,演算法
数据库,资料库,数据存储
网络,互联网,因特网,网路
人工智能,AI,机器学习,深度学习
前端,客户端,用户端
后端,服务端,服务器端
框架,架构,结构
接口,API,应用程序接口
部署,发布,上线,投产
EOF
    
    # 复制到容器
    docker cp /tmp/synonyms.txt zhijiaoxing-elasticsearch:/usr/share/elasticsearch/config/analysis/synonyms.txt
    
    print_info "同义词文件创建完成"
}

# 验证安装
verify_installation() {
    print_info "验证 Elasticsearch 安装..."
    
    # 检查集群健康状态
    health=$(curl -s -u "elastic:${ES_PASSWORD}" http://localhost:9200/_cluster/health)
    status=$(echo $health | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    
    print_info "集群状态: $status"
    
    # 列出所有索引
    print_info "已创建的索引:"
    curl -s -u "elastic:${ES_PASSWORD}" http://localhost:9200/_cat/indices?v
    
    # 测试搜索
    print_info "测试搜索功能..."
    curl -s -u "elastic:${ES_PASSWORD}" \
        -X POST "http://localhost:9200/courses/_search" \
        -H "Content-Type: application/json" \
        -d '{"query": {"match_all": {}}, "size": 0}' | grep -o '"hits":{[^}]*}'
    
    print_info "验证完成"
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "=========================================="
    echo "Elasticsearch 安装完成"
    echo "=========================================="
    echo ""
    echo "访问地址:"
    echo "  - Elasticsearch: http://localhost:9200"
    echo "  - Kibana:        http://localhost:5601"
    echo "  - Cerebro:       http://localhost:9000"
    echo ""
    echo "认证信息:"
    echo "  - 用户名: elastic"
    echo "  - 密码:   ${ES_PASSWORD}"
    echo ""
    echo "索引列表:"
    echo "  - courses   (课程索引)"
    echo "  - contents  (内容索引)"
    echo "  - knowledge (知识库索引)"
    echo ""
    echo "常用命令:"
    echo "  查看集群健康: curl -u elastic:${ES_PASSWORD} http://localhost:9200/_cluster/health"
    echo "  查看所有索引: curl -u elastic:${ES_PASSWORD} http://localhost:9200/_cat/indices"
    echo "  查看索引映射: curl -u elastic:${ES_PASSWORD} http://localhost:9200/courses/_mapping"
    echo ""
    echo "=========================================="
}

# 主函数
main() {
    echo "=========================================="
    echo "Elasticsearch 安装脚本"
    echo "版本: ${ES_VERSION}"
    echo "=========================================="
    echo ""
    
    # 执行安装步骤
    check_docker
    create_directories
    start_elasticsearch
    install_ik_plugin
    install_pinyin_plugin
    create_synonyms_file
    init_indices
    verify_installation
    show_access_info
    
    print_info "Elasticsearch 安装和配置完成！"
}

# 处理参数
case "${1:-}" in
    start)
        start_elasticsearch
        ;;
    stop)
        docker-compose -f docker-compose.elasticsearch.yml down
        ;;
    restart)
        docker-compose -f docker-compose.elasticsearch.yml restart
        ;;
    init)
        init_indices
        ;;
    verify)
        verify_installation
        ;;
    *)
        main
        ;;
esac
