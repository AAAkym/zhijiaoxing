@echo off
chcp 65001 >nul
echo ========================================
echo     智教星智能教学管理系统
echo     基于大模型的个性化资源生成与学习多智能体系统
echo ========================================
echo.

echo ========================================
echo       正在准备后端环境...
echo ========================================
cd /d "%~dp0backend"
if not exist "venv" (
    echo [安装] 正在创建 Python 虚拟环境...
    python -m venv venv
    call venv\Scripts\activate.bat
    if exist "requirements.txt" (
        echo [安装] 正在安装 Python 依赖...
        pip install -r requirements.txt --quiet
    )
) else (
    echo [检查] Python 虚拟环境已存在，跳过安装
)
cd /d "%~dp0"

echo ========================================
echo       正在启动后端服务...
echo ========================================
start cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate.bat && python src/main.py"

echo 等待后端启动...
timeout /t 5 /nobreak >nul

echo ========================================
echo       正在准备前端环境...
echo ========================================
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [安装] 正在安装前端依赖...
    pnpm install
) else (
    echo [检查] 前端依赖已存在，跳过安装
)
cd /d "%~dp0"

echo ========================================
echo       正在启动前端服务...
echo ========================================
start cmd /k "cd /d "%~dp0frontend" && pnpm run dev"

echo 等待前端启动...
timeout /t 5 /nobreak >nul

echo ========================================
echo       正在打开项目页面...
echo ========================================
start http://localhost:5173

echo 系统启动完成！两个窗口不要关闭！
pause
