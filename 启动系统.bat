@echo off
chcp 65001 >nul
echo ========================================
echo     智教星智能教学管理系统
echo     基于大模型的个性化资源生成与学习多智能体系统
echo ========================================
echo.

setlocal
set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%~dp0backend"
set "FRONTEND_DIR=%~dp0frontend"

set "BOOTSTRAP_PYTHON=python"
py -3.11 --version >nul 2>&1
if not errorlevel 1 set "BOOTSTRAP_PYTHON=py -3.11"

%BOOTSTRAP_PYTHON% --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python。请安装 Python 3.11 或更高版本，并勾选 Add Python to PATH。
    goto :failed
)

%BOOTSTRAP_PYTHON% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
    echo [错误] Python 版本过低，本项目需要 Python 3.11 或更高版本。
    %BOOTSTRAP_PYTHON% --version
    goto :failed
)

if not exist "%BACKEND_DIR%\requirements.txt" (
    echo [错误] 找不到后端依赖文件：%BACKEND_DIR%\requirements.txt
    goto :failed
)
if not exist "%BACKEND_DIR%\src\main.py" (
    echo [错误] 找不到后端入口文件：%BACKEND_DIR%\src\main.py
    goto :failed
)
if not exist "%FRONTEND_DIR%\package.json" (
    echo [错误] 找不到前端配置文件：%FRONTEND_DIR%\package.json
    goto :failed
)
if not exist "%FRONTEND_DIR%\pnpm-lock.yaml" (
    echo [错误] 找不到前端锁文件：%FRONTEND_DIR%\pnpm-lock.yaml
    goto :failed
)

where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js。请先安装 Node.js 20 或更高版本。
    goto :failed
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
    echo [错误] Node.js 版本过低，本项目需要 Node.js 20 或更高版本。
    node --version
    goto :failed
)

where pnpm.cmd >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 pnpm。请先安装 Node.js，再执行：npm install -g pnpm
    goto :failed
)

set "BACKEND_RUNNING=0"
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $response=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/api/sse/health' -TimeoutSec 3; if ($response.StatusCode -eq 200 -and $response.Content -match '\"service\"\s*:\s*\"sse\"') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
    set "BACKEND_RUNNING=1"
    echo [检查] 后端服务已在运行，将直接复用
) else (
    powershell -NoProfile -Command "try { $client=[Net.Sockets.TcpClient]::new('127.0.0.1',5000); $client.Dispose(); exit 0 } catch { exit 1 }"
    if not errorlevel 1 (
        echo [错误] 端口 5000 被其他程序占用，请先释放该端口。
        goto :failed
    )
)

set "FRONTEND_RUNNING=0"
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $vite=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/@vite/client' -TimeoutSec 3; $entry=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/src/main.jsx' -TimeoutSec 3; if ($vite.StatusCode -eq 200 -and $entry.StatusCode -eq 200 -and $entry.Content -match '/src/App.jsx') { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
    set "FRONTEND_RUNNING=1"
    echo [检查] 前端服务已在运行，将直接复用
) else (
    powershell -NoProfile -Command "try { $client=[Net.Sockets.TcpClient]::new('127.0.0.1',5173); $client.Dispose(); exit 0 } catch { exit 1 }"
    if not errorlevel 1 (
        echo [错误] 端口 5173 被其他程序占用，请先释放该端口。
        goto :failed
    )
)

if "%BACKEND_RUNNING%"=="1" goto :backend_ready

echo ========================================
echo       正在准备后端环境...
echo ========================================
pushd "%BACKEND_DIR%"
if errorlevel 1 (
    echo [错误] 找不到后端目录：%BACKEND_DIR%
    goto :failed
)

if not exist "venv\Scripts\python.exe" (
    echo [安装] 正在创建 Python 虚拟环境...
    %BOOTSTRAP_PYTHON% -m venv venv
    if errorlevel 1 (
        popd
        echo [错误] Python 虚拟环境创建失败。
        goto :failed
    )
) else (
    echo [检查] Python 虚拟环境已存在
)

call venv\Scripts\activate.bat
if errorlevel 1 (
    popd
    echo [错误] Python 虚拟环境激活失败，请删除 backend\venv 后重试。
    goto :failed
)

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)"
if errorlevel 1 (
    popd
    echo [错误] backend\venv 的 Python 版本过低，请删除该目录后重试。
    goto :failed
)

echo [安装] 正在同步 Python 依赖，请勿关闭窗口...
python -m pip install -r requirements.txt
if errorlevel 1 (
    popd
    echo [错误] Python 依赖安装失败，请查看上方第一条 ERROR。
    goto :failed
)

python -m pip check
if errorlevel 1 (
    popd
    echo [错误] Python 依赖存在版本冲突，请查看上方提示。
    goto :failed
)
popd

echo ========================================
echo       正在启动后端服务...
echo ========================================
powershell -NoProfile -Command "try { $client=[Net.Sockets.TcpClient]::new('127.0.0.1',5000); $client.Dispose(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
    echo [错误] 端口 5000 已被占用。请先关闭已有后端服务，再重新启动。
    goto :failed
)

start "智教星后端" /D "%BACKEND_DIR%" cmd /k "call venv\Scripts\activate.bat && python src\main.py"

echo 等待后端启动...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); do { try { $client=[Net.Sockets.TcpClient]::new('127.0.0.1',5000); $client.Dispose(); exit 0 } catch { Start-Sleep -Seconds 1 } } while ((Get-Date) -lt $deadline); exit 1"
set "BACKEND_WAIT_EXIT=%errorlevel%"
if not "%BACKEND_WAIT_EXIT%"=="0" (
    echo [错误] 后端未能在 60 秒内启动，请查看“智教星后端”窗口中的报错。
    goto :failed
)

:backend_ready
if "%FRONTEND_RUNNING%"=="1" goto :frontend_ready

echo ========================================
echo       正在准备前端环境...
echo ========================================
pushd "%FRONTEND_DIR%"
if errorlevel 1 (
    echo [错误] 找不到前端目录：%FRONTEND_DIR%
    goto :failed
)

node -e "import('@vitejs/plugin-react')" >nul 2>&1
if not errorlevel 1 (
    echo [检查] 前端依赖完整，跳过安装
    goto :frontend_dependencies_ready
)

echo [安装] 前端依赖缺失，正在安装...
call pnpm.cmd install --frozen-lockfile
if errorlevel 1 (
    popd
    echo [错误] 前端依赖安装失败，请查看上方错误。
    goto :failed
)

node -e "import('@vitejs/plugin-react')" >nul 2>&1
if errorlevel 1 (
    echo [修复] 检测到前端依赖文件不完整，正在强制重建...
    call pnpm.cmd install --force --frozen-lockfile
    if errorlevel 1 (
        popd
        echo [错误] 前端依赖重建失败，请查看上方错误。
        goto :failed
    )

    node -e "import('@vitejs/plugin-react')" >nul 2>&1
    if errorlevel 1 (
        popd
        echo [错误] 前端依赖重建后仍不完整，请检查磁盘或杀毒软件拦截。
        goto :failed
    )
)

:frontend_dependencies_ready
popd

echo ========================================
echo       正在启动前端服务...
echo ========================================
powershell -NoProfile -Command "try { $client=[Net.Sockets.TcpClient]::new('127.0.0.1',5173); $client.Dispose(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
    echo [错误] 端口 5173 已被占用。请先关闭已有前端服务，再重新启动。
    goto :failed
)

start "智教星前端" /D "%FRONTEND_DIR%" cmd /k "call pnpm.cmd run dev"

echo 等待前端启动...
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(60); do { try { $client=[Net.Sockets.TcpClient]::new('127.0.0.1',5173); $client.Dispose(); exit 0 } catch { Start-Sleep -Seconds 1 } } while ((Get-Date) -lt $deadline); exit 1"
set "FRONTEND_WAIT_EXIT=%errorlevel%"
if not "%FRONTEND_WAIT_EXIT%"=="0" (
    echo [错误] 前端未能在 60 秒内启动，请查看“智教星前端”窗口中的报错。
    goto :failed
)

:frontend_ready
echo ========================================
echo       正在打开项目页面...
echo ========================================
start "" "http://localhost:5173"

echo 系统已就绪！请保留已启动的服务窗口。
pause
exit /b 0

:failed
echo.
echo 系统启动失败，请根据上方提示或服务窗口中的第一条错误进行处理。
pause
exit /b 1
