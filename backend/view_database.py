

#!/usr/bin/env python3
"""查看 SQLite 数据库内容的脚本"""
import sqlite3
from pathlib import Path

# 数据库文件路径
db_path = Path(__file__).parent / 'instance' / 'dev.db'

print("=" * 60)
print("📊 数据库查看器 - 智教星")
print("=" * 60)
print(f"\n数据库路径：{db_path.absolute()}")
print(f"数据库存在：{db_path.exists()}\n")

if not db_path.exists():
    print("❌ 数据库文件不存在！")
    exit(1)

# 连接数据库
conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# 获取所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = cursor.fetchall()

print(f"📋 数据库表列表 (共{len(tables)}个表):")
print("-" * 60)

for table in tables:
    table_name = table[0]
    print(f"\n📁 表名：{table_name}")
    
    # 获取表结构
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    print(f"   列信息:")
    for col in columns:
        print(f"      - {col[1]} ({col[2]})")
    
    # 获取数据条数
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"   数据条数：{count}")
    
    # 显示前 3 条数据
    if count > 0:
        cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
        rows = cursor.fetchall()
        print(f"   前 3 条数据:")
        for i, row in enumerate(rows, 1):
            print(f"      {i}. {row}")

conn.close()

print("\n" + "=" * 60)
print("✅ 数据库查看完成")
print("=" * 60)