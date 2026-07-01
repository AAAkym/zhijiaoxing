#!/bin/bash

# 智教星系统启动脚本 - Linux/macOS
# 基于大模型的个性化资源生成与学习多智能体系统

echo "========================================"
echo "    智教星智能教学管理系统"
echo "    基于大模型的个性化资源生成与学习多智能体系统"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Python，请先安装 Python 3.11+${NC}"
    echo "安装命令: sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Node.js，请先安装 Node.js 18+${NC}"
    echo "安装命令: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install nodejs"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}[提示] 未检测到 pnpm，正在安装...${NC}"
    npm install -g pnpm
fi

echo -e "${GREEN}[检查] 环境检测通过${NC}"
echo ""

# 检查 .env 配置
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}[提示] 未找到 backend/.env 配置文件${NC}"
    echo "[提示] 正在从 .env.example 创建配置文件..."
    cp backend/.env.example backend/.env
    echo ""
    echo -e "${YELLOW}[重要] 请编辑 backend/.env 文件，填入 Spark API 密钥：${NC}"
    echo "       SPARK_API_PASSWORD=your_api_password_here"
    echo ""
    read -p "按 Enter 继续（未配置 API 密钥时 AI 功能将无法使用）..."
fi

# 启动后端
echo ""
echo "[启动] 正在启动后端服务..."
cd backend

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo "[安装] 正在创建 Python 虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境并安装依赖
source venv/bin/activate
pip install -r requirements.txt --quiet

# 启动后端（后台运行）
echo "[启动] 后端服务启动中..."
python src/main.py &
BACKEND_PID=$!

cd ..

# 等待后端启动
echo "[等待] 后端服务启动中，请稍候..."
sleep 5

# 启动前端
echo ""
echo "[启动] 正在启动前端服务..."
cd frontend

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "[安装] 正在安装前端依赖..."
    pnpm install
fi

# 启动前端（后台运行）
pnpm run dev &
FRONTEND_PID=$!

cd ..

# 等待前端启动
echo "[等待] 前端服务启动中，请稍候..."
sleep 3

# 完成
echo ""
echo -e "${GREEN}[完成] 系统启动完成！${NC}"
echo ""
echo "========================================"
echo "     访问地址: http://localhost:5173"
echo "========================================"
echo ""
echo "默认账号:"
echo "   管理员: admin / admin123"
echo "   教师:   teacher / teacher123"
echo "   学生:   student / student123"
echo ""
echo "[提示] 系统已在后台运行"
echo "[提示] 后端 PID: $BACKEND_PID"
echo "[提示] 前端 PID: $FRONTEND_PID"
echo ""
echo "停止服务命令:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""

# 打开浏览器（如果支持）
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173
elif command -v open &> /dev/null; then
    open http://localhost:5173
fi

# 保持脚本运行，显示日志
echo "按 Ctrl+C 停止服务..."
trap "kill $BACKEND_PID $FRONTEND_PID; echo '服务已停止'; exit" INT
wait