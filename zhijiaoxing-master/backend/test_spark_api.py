#!/usr/bin/env python3
"""讯飞星火API连接测试脚本 - 诊断版本"""
import sys
import os
import time
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).parent / '.env'
print(f"📂 加载.env文件: {env_path.absolute()}")
print(f"   文件是否存在: {env_path.exists()}")
load_dotenv(env_path)
print("✅ .env文件加载完成\n")


def test_env_loading():
    """测试1: 环境变量加载"""
    print("=" * 60)
    print("🔍 测试1: 环境变量加载检查")
    print("=" * 60)

    vars_to_check = [
        'SPARK_API_PASSWORD',
        'SPARK_API_KEY',
        'SPARK_API_SECRET',
        'SPARK_APP_ID',
        'SPARK_API_URL',
        'SPARK_MODEL',
        'SPARK_TIMEOUT'
    ]

    all_loaded = True
    for var_name in vars_to_check:
        value = os.environ.get(var_name)
        if value:
            if 'PASSWORD' in var_name or 'SECRET' in var_name or 'KEY' in var_name:
                display_value = f"{value[:8]}...{value[-4:]}" if len(value) > 12 else "***"
            else:
                display_value = value
            print(f"  ✅ {var_name}: {display_value}")
        else:
            print(f"  ❌ {var_name}: 未设置")
            all_loaded = False

    return all_loaded


def test_spark_service_import():
    """测试2: 导入spark_service模块"""
    print("\n" + "=" * 60)
    print("🔍 测试2: Spark服务模块导入")
    print("=" * 60)

    try:
        from src.services.spark_service import (
            is_configured,
            _resolve_api_password,
            chat,
            chat_stream,
            spark_service
        )
        print("  ✅ 模块导入成功")

        configured = is_configured()
        print(f"  📊 is_configured(): {configured}")

        if configured:
            try:
                password = _resolve_api_password()
                print(f"  🔑 API凭证已解析 (长度: {len(password)})")
            except Exception as e:
                print(f"  ❌ 解析凭证失败: {e}")
                return False

        return True
    except Exception as e:
        print(f"  ❌ 模块导入失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_connection():
    """测试3: 实际API连接测试"""
    print("\n" + "=" * 60)
    print("🔍 测试3: API连接性测试")
    print("=" * 60)

    try:
        from src.services.spark_service import chat, _get_headers, _env

        url = _env("SPARK_API_URL")
        print(f"  🌐 API端点: {url}")

        headers = _get_headers()
        print(f"  📋 请求头包含: {list(headers.keys())}")

        print("\n  🚀 发送测试请求: '你好'")
        start_time = time.time()

        response = chat("你好，这是一个测试消息。请回复'测试成功'。")

        elapsed_time = time.time() - start_time
        print(f"  ⏱️  响应时间: {elapsed_time:.2f}秒")
        print(f"  📨 响应内容: {response[:100]}...")

        return True

    except Exception as e:
        print(f"  ❌ API连接失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_stream_connection():
    """测试4: 流式API连接测试"""
    print("\n" + "=" * 60)
    print("🔍 测试4: 流式API连接测试")
    print("=" * 60)

    try:
        from src.services.spark_service import chat_stream

        print("  🚀 发送流式测试请求...")
        start_time = time.time()

        chunks = []
        for chunk in chat_stream("请用一句话介绍你自己"):
            chunks.append(chunk)
            print(f"  📦 收到数据块: {chunk[:20]}...", end='\r')

        elapsed_time = time.time() - start_time
        full_response = ''.join(chunks)

        print(f"\n  ⏱️  总响应时间: {elapsed_time:.2f}秒")
        print(f"  📊 数据块数量: {len(chunks)}")
        print(f"  📨 完整响应: {full_response[:150]}...")

        return True

    except Exception as e:
        print(f"\n  ❌ 流式API连接失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """主测试函数"""
    print("\n" + "🎯" * 30)
    print("🤖 讯飞星火API集成诊断工具")
    print("🎯" * 30 + "\n")

    results = {}

    results['环境变量'] = test_env_loading()
    results['模块导入'] = test_spark_service_import()

    if results['模块导入']:
        results['同步API'] = test_api_connection()
        results['流式API'] = test_stream_connection()
    else:
        results['同步API'] = False
        results['流式API'] = False

    print("\n" + "=" * 60)
    print("📊 测试结果汇总")
    print("=" * 60)

    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {test_name}: {status}")

    all_passed = all(results.values())

    if all_passed:
        print("\n🎉 所有测试通过！讯飞星火API已成功集成。")
        print("\n下一步操作:")
        print("  1. 重启Flask后端服务: python -m src.main")
        print("  2. 刷新前端页面")
        print("  3. 测试各个AI功能模块")
        return 0
    else:
        failed_tests = [k for k, v in results.items() if not v]
        print(f"\n⚠️  有 {len(failed_tests)} 个测试未通过: {', '.join(failed_tests)}")
        print("\n常见问题排查:")
        print("  1. 确认.env文件在backend目录下")
        print("  2. 确认SPARK_API_PASSWORD已正确配置")
        print("  3. 重启后端Flask服务")
        print("  4. 检查网络连接和防火墙设置")
        return 1


if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
