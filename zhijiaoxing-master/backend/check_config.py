#!/usr/bin/env python3
"""简易API凭证验证脚本 - 不依赖外部模块"""
import os
import sys
from pathlib import Path

print("=" * 60)
print("🔍 讯飞星火API配置快速诊断")
print("=" * 60)

env_file = Path(__file__).parent / '.env'
print(f"\n📂 .env文件路径: {env_file}")
print(f"   文件存在: {env_file.exists()}")

if env_file.exists():
    print("\n📄 .env文件内容 (隐藏敏感信息):")
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if any(sensitive in line.upper() for sensitive in ['PASSWORD', 'SECRET', 'KEY']):
                    key, _, value = line.partition('=')
                    masked = value[:6] + '...' + value[-4:] if len(value) > 10 else '***'
                    print(f"   {key}= {masked}")
                else:
                    print(f"   {line}")

print("\n" + "=" * 60)
print("⚠️  重要提示")
print("=" * 60)
print("""
✅ 配置文件已就绪！现在需要执行以下步骤：

1️⃣  重启Flask后端服务（必须！）：
    - 如果后端正在运行，请先停止它（Ctrl+C）
    - 然后重新启动：
      cd backend
      python -m src.main

2️⃣  刷新前端页面（F5 或 Ctrl+F5）

3️⃣  测试AI功能：
    - 教师端：内容生成、题目生成
    - 学生端：错题本AI分析、AI学习助手

📌 为什么需要重启？
   Flask在启动时加载环境变量到内存中。
   修改.env文件后，已运行的进程不会自动读取新配置。
   必须重启才能让新的API凭证生效！

🔧 如果仍然报错，请检查：
   - 后端控制台日志是否有 "✅ 使用SPARK_API_PASSWORD进行认证"
   - 是否看到 "🚀 发送同步/流式API请求到: ..."
   - 网络连接是否正常（可以访问外网）
""")
