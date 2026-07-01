#!/bin/bash

# 智教星 Docker 一键启动脚本 - Linux/macOS

echo "========================================"
echo "    智教星系统 Docker 一键启动"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Docker，请先安装 Docker${NC}"
    echo "安装指南: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo -e "${RED}[错误] 未检测到 Docker Compose${NC}"
    exit 1
fi

echo -e "${GREEN}[检查] Docker 环境检测通过${NC}"
echo ""

# 检查 .env 配置
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[提示] 未找到 .env 配置文件${NC}"
    echo "[提示] 正在从 .env.docker.example 创建配置文件..."
    cp .env.docker.example .env
    echo ""
    echo -e "${YELLOW}[重要] 请编辑 .env 文件，填入 Spark API 密钥：${NC}"
    echo "       SPARK_API_PASSWORD=your_api_password_here"
    echo ""
    read -p "按 Enter 继续（未配置 API 密钥时 AI 功能将无法使用）..."
fi

# 构建并启动容器
echo ""
echo "[构建] 正在构建 Docker 镜像..."
$COMPOSE_CMD build

echo ""
echo "[启动] 正在启动服务..."
$COMPOSE_CMD up -d

# 等待服务启动
echo "[等待] 服务启动中，请稍候..."
sleep 10

# 检查服务状态
echo ""
echo "[状态] 检查服务运行状态..."
$COMPOSE_CMD ps

# 完成
echo ""
echo -e "${GREEN}========================================"
echo "     系统启动完成！"
echo "========================================${NC}"
echo ""
echo "访问地址: http://localhost"
echo ""
echo "默认账号:"
echo "   管理员: admin / admin123"
echo "   教师:   teacher / teacher123"
echo "   学生:   student / student123"
echo ""

# 打开浏览器
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost
elif command -v open &> /dev/null; then
    open http://localhost
fi

echo "常用命令:"
echo "   查看日志: $COMPOSE_CMD logs -f"
echo "   停止服务: $COMPOSE_CMD down"
echo "   重启服务: $COMPOSE_CMD restart"
echo ""