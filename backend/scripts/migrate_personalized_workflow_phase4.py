"""Safe schema upgrade for phase 4 notifications. Only adds a new table."""

import argparse
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import URL, make_url


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
TABLE_NAME = "personalized_task_notifications"


def configured_database_url():
    from dotenv import load_dotenv
    load_dotenv(BACKEND_DIR / ".env")
    return os.environ.get("DATABASE_URL", "sqlite:///dev.db")


def normalize_database_url(raw_url):
    url = make_url(raw_url)
    path = None
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        path = Path(url.database)
        if not path.is_absolute():
            path = BACKEND_DIR / "instance" / path
        path = path.resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        url = URL.create("sqlite", database=str(path))
    return url, path


def backup_sqlite(source):
    if not source or not source.exists():
        return None
    target_dir = BACKEND_DIR / "backups"
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{source.stem}.before_phase4_{datetime.now():%Y%m%d_%H%M%S_%f}{source.suffix}"
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    with sqlite3.connect(target) as check:
        if check.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("SQLite备份完整性校验失败")
    return target


def main():
    parser = argparse.ArgumentParser(description="第四阶段通知表安全升级器")
    parser.add_argument("--database-url")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url, sqlite_path = normalize_database_url(args.database_url or configured_database_url())
    engine = create_engine(url)
    before = set(inspect(engine).get_table_names())
    print(f"[Phase4] 目标: {url.render_as_string(hide_password=True)}")
    print(f"[Phase4] 通知表: {'已存在' if TABLE_NAME in before else '不存在'}")
    if not args.apply:
        print("[Phase4] 仅检查；传入 --apply 才会新增通知表。")
        return 0
    backup = backup_sqlite(sqlite_path)
    if backup:
        print(f"[Phase4] 已验证备份: {backup}")
    from src.models.user import User  # noqa: F401
    from src.models.personalized_learning import PersonalizedTaskDelivery  # noqa: F401
    from src.models.personalized_notification import PersonalizedTaskNotification
    PersonalizedTaskNotification.__table__.create(engine, checkfirst=True)
    if TABLE_NAME not in inspect(engine).get_table_names():
        raise RuntimeError("通知表创建后校验失败")
    print(f"[Phase4] 升级完成: {TABLE_NAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
