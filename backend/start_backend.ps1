# 智教星后端服务启动脚本
# Windows PowerShell

$pythonPath = "D:\Program Files\Python314\python.exe"
$scriptPath = "src/main.py"
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "正在启动智教星后端服务..." -ForegroundColor Green
Write-Host "Python: $pythonPath" -ForegroundColor Yellow
Write-Host "工作目录：$backendDir" -ForegroundColor Yellow

Set-Location $backendDir
& $pythonPath $scriptPath
