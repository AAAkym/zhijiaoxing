# 智教星 · 一键验证脚本
# Windows PowerShell
#
# 为什么需要它：
#   本仓库的构建链路曾经长期"看起来是绿的"——前端 jest 配置里有一份硬编码的
#   testPathIgnorePatterns，把 6 个测试文件、共 102 个用例整体排除在外，
#   被排除的套件既不算通过也不算失败，所以一直显示全绿。
#   同一时期 pnpm run build 其实是失败的（组件引用了不存在的导出），
#   但因为测试里用了 mock 把它盖住了，谁也没发现。
#
#   结论是：只跑测试不足以判断健康。本脚本把"测试"和"构建"绑定成一次动作，
#   任何一项失败即整体失败，避免再次出现"测试过 = 代码没问题"的错觉。
#
# 用法：
#   .\verify_all.ps1              # 前端测试 + 前端构建 + 后端测试
#   .\verify_all.ps1 -SkipBackend # 只跑前端（后端较慢，约 8 分钟）
#   .\verify_all.ps1 -SkipBuild   # 跳过构建（仅做快速回归时用）

param(
    [switch]$SkipBackend,
    [switch]$SkipBuild
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$failed = New-Object System.Collections.ArrayList

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Write-Pass($text) {
    Write-Host "[通过] $text" -ForegroundColor Green
}

function Write-Fail($text) {
    Write-Host "[失败] $text" -ForegroundColor Red
}

# --- 1. 前端测试 ---
Write-Step "前端测试 (jest)"
Push-Location (Join-Path $root "frontend")
& npx jest
$testExit = $LASTEXITCODE
Pop-Location
if ($testExit -ne 0) {
    Write-Fail "前端测试未通过"
    [void]$failed.Add("前端测试")
} else {
    Write-Pass "前端测试"
}

# --- 2. 前端构建 ---
# 单独保留这一步：测试用 mock 替换了服务层，跑得过并不代表真的能构建。
if (-not $SkipBuild) {
    Write-Step "前端构建 (vite build)"
    Push-Location (Join-Path $root "frontend")
    & pnpm run build
    $buildExit = $LASTEXITCODE
    Pop-Location
    if ($buildExit -ne 0) {
        Write-Fail "前端构建未通过"
        [void]$failed.Add("前端构建")
    } else {
        Write-Pass "前端构建"
    }

    # 构建会改写被 git 跟踪的 dist/index.html，跑完还原，避免污染工作区。
    Push-Location $root
    & git checkout -- frontend/dist/index.html
    Pop-Location
}

# --- 3. 后端测试 ---
if (-not $SkipBackend) {
    Write-Step "后端测试 (pytest)"
    $backendDir = Join-Path $root "backend"
    $python = Join-Path $backendDir "venv\Scripts\python.exe"

    if (-not (Test-Path $python)) {
        Write-Fail "找不到后端虚拟环境：$python"
        [void]$failed.Add("后端测试（环境缺失）")
    } else {
        Push-Location $backendDir
        & $python -X utf8 -m pytest -q
        $pytestExit = $LASTEXITCODE
        Pop-Location
        if ($pytestExit -ne 0) {
            Write-Fail "后端测试未通过"
            [void]$failed.Add("后端测试")
        } else {
            Write-Pass "后端测试"
        }
    }
}

# --- 汇总 ---
Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "验证未通过，失败项：" -ForegroundColor Red
    foreach ($f in $failed) {
        Write-Host "  - $f" -ForegroundColor Red
    }
    exit 1
}

Write-Host "全部验证通过。" -ForegroundColor Green
exit 0
