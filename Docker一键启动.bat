﻿﻿﻿﻿﻿@echo off
chcp 65001 >nul
title 智教星 Docker 一键启动

echo ========================================
echo     智教星系统 Docker 一键启动
echo ========================================
echo.

:: 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: 检查 Docker Compose
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo [错误] 未检测到 Docker Compose
        pause
        exit /b 1
    )
    set COMPOSE_CMD=docker compose
) else (
    set COMPOSE_CMD=docker-compose
)

echo [检查] Docker 环境检测通过
echo.

:: 检查 .env 配置
if not exist ".env" (
    echo [提示] 未找到 .env 配置文件
    echo [提示] 正在从 .env.docker.example 创建配置文件...
    copy ".env.docker.example" ".env" >nul
    echo.
    echo [重要] 请编辑 .env 文件，填入 Spark API 密钥：
    echo        SPARK_API_PASSWORD=your_api_password_here
    echo.
    echo 按任意键继续启动（未配置 API 密钥时 AI 功能将无法使用）...
    pause >nul
)

:: 构建并启动容器
echo.
echo [构建] 正在构建 Docker 镜像...
%COMPOSE_CMD% build

echo.
echo [启动] 正在启动服务...
%COMPOSE_CMD% up -d

:: 等待服务启动
echo [等待] 服务启动中，请稍候...
timeout /t 10 /nobreak >nul

:: 检查服务状态
echo.
echo [状态] 检查服务运行状态...
%COMPOSE_CMD% ps

:: 完成
echo.
echo ========================================
echo     系统启动完成！
echo ========================================
echo.
echo 访问地址: http://localhost
echo.
echo 默认账号:
echo   管理员: admin / admin123
echo   教师:   teacher / teacher123
echo   学生:   student / student123
echo.
echo [提示] 按任意键打开浏览器访问系统...
pause >nul

:: 打开浏览器
start http://localhost

echo.
echo 系统已在浏览器中打开。
echo.
echo 常用命令:
echo   查看日志: %COMPOSE_CMD% logs -f
echo   停止服务: %COMPOSE_CMD% down
echo   重启服务: %COMPOSE_CMD% restart
echo.
pause
