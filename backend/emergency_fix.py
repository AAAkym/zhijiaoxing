#!/usr/bin/env python3
"""
🚨 AI功能紧急修复脚本
用于诊断和修复讯飞星火API集成问题

运行方式: python emergency_fix.py
"""
import os
import sys
from pathlib import Path

def print_header(title):
    """打印标题"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def check_env_file():
    """检查.env文件"""
    print_header("1️⃣  检查 .env 配置文件")

    env_file = Path(__file__).parent / '.env'

    if not env_file.exists():
        print("  ❌ .env 文件不存在！")
        return False

    print(f"  ✅ .env 文件存在: {env_file}")

    # 检查文件内容
    content = env_file.read_text(encoding='utf-8')
    if len(content) < 10:
        print("  ❌ .env 文件内容为空或过短！")
        return False

    required_vars = ['SPARK_API_PASSWORD', 'SPARK_APP_ID', 'SPARK_API_URL']
    missing_vars = []

    for var in required_vars:
        if var not in content:
            missing_vars.append(var)

    if missing_vars:
        print(f"  ❌ 缺少必要配置项: {', '.join(missing_vars)}")
        return False

    print("  ✅ 所有必要配置项都存在")

    # 显示配置（隐藏敏感信息）
    print("\n  📋 当前配置（敏感信息已隐藏）:")
    for line in content.split('\n'):
        line = line.strip()
        if line and not line.startswith('#'):
            if any(s in line.upper() for s in ['PASSWORD', 'SECRET']):
                key, _, value = line.partition('=')
                masked = value[:8] + '...' + value[-4:] if len(value) > 12 else '***'
                print(f"     {key} = {masked}")
            elif '=' in line:
                key, _, value = line.partition('=')
                print(f"     {key} = {value}")

    return True

def test_spark_service():
    """测试spark_service模块"""
    print_header("2️⃣  测试 Spark 服务模块")

    try:
        # 手动加载环境变量
        from dotenv import load_dotenv
        env_path = Path(__file__).parent / '.env'
        load_dotenv(env_path)
        print(f"  ✅ 环境变量已从 .env 加载")

        # 导入spark_service
        sys.path.insert(0, str(Path(__file__).parent))
        from src.services.spark_service import is_configured, _resolve_api_password

        configured = is_configured()
        print(f"  📊 API配置状态: {'✅ 已配置' if configured else '❌ 未配置'}")

        if configured:
            password = _resolve_api_password()
            print(f"  🔑 API凭证长度: {len(password)} 字符")
            print(f"  ✅ Spark服务模块正常")
            return True
        else:
            print("  ❌ Spark服务未配置")
            return False

    except Exception as e:
        print(f"  ❌ 导入失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_all_ai_modules():
    """检查所有AI相关模块"""
    print_header("3️⃣  检查所有AI功能模块")

    modules_to_check = [
        ('教师端-内容生成', 'src/services/spark_service.py', 'generate_teaching_content'),
        ('教师端-题目生成', 'src/services/spark_service.py', 'generate_assessment'),
        ('学生端-错题分析', 'src/routes/mistake_book.py', 'analyze_mistake_stream'),
        ('学生端-AI助手(SSE)', 'src/services/sse_chat_service.py', 'stream_chat'),
        ('学生端-AI助手(旧)', 'src/routes/ai_assistant.py', 'ai_chat_stream'),
    ]

    all_ok = True
    for name, file_path, func_name in modules_to_check:
        full_path = Path(__file__).parent / file_path
        if full_path.exists():
            content = full_path.read_text(encoding='utf-8')
            if func_name in content:
                print(f"  ✅ {name}: {func_name}() 已实现")
            else:
                print(f"  ⚠️  {name}: 未找到 {func_name}()")
                all_ok = False
        else:
            print(f"  ❌ {name}: 文件不存在 {file_path}")
            all_ok = False

    return all_ok

def show_restart_instructions():
    """显示重启说明"""
    print_header("4️⃣  ⭐ 关键步骤 - 重启后端服务 ⭐")

    instructions = """
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🚨 必须执行以下步骤才能让修复生效！                         │
│                                                             │
│   步骤1: 停止当前运行的Flask服务                             │
│          - 在运行Flask的终端按 Ctrl+C                        │
│          - 或关闭运行Flask的终端窗口                        │
│                                                             │
│   步骤2: 重新启动Flask后端                                  │
│          cd C:\\Users\\33552\\Desktop\\project_code\\backend      │
│          python -m src.main                                 │
│                                                             │
│   步骤3: 验证启动成功                                        │
│          - 应该看到 "Running on http://127.0.0.1:5000"       │
│          - 控制台应该有日志输出                               │
│                                                             │
│   步骤4: 刷新前端页面                                        │
│          - 在浏览器按 F5 或 Ctrl+F5                          │
│                                                             │
│   步骤5: 测试AI功能                                          │
│          - 教师端: 内容生成、题目生成                        │
│          - 学生端: 错题本AI分析、AI学习助手对话              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
"""
    print(instructions)

def main():
    """主函数"""
    print("\n" + "🔥" * 35)
    print("  🤖 讯飞星火API紧急修复工具")
    print("  🔧 自动诊断 + 修复指引")
    print("🔥" * 35)

    results = {}

    results['环境配置'] = check_env_file()
    results['Spark服务'] = test_spark_service() if results['环境配置'] else False
    results['AI模块'] = check_all_ai_modules()

    print_header("📊 诊断结果汇总")

    all_passed = True
    for test_name, passed in results.items():
        status = "✅ 正常" if passed else "❌ 异常"
        symbol = "✅" if passed else "❌"
        print(f"  {symbol} {test_name}: {status}")
        if not passed:
            all_passed = False

    if all_passed:
        show_restart_instructions()
        print("\n" + "🎉" * 35)
        print("  所有检查通过！现在请重启后端服务。")
        print("🎉" * 35 + "\n")
        return 0
    else:
        print("\n" + "⚠️ " * 35)
        print("  发现问题，请根据上述提示进行修复。")
        print("⚠️ " * 35 + "\n")
        return 1

if __name__ == '__main__':
    exit_code = main()
    input("\n按回车键退出...")
    sys.exit(exit_code)
