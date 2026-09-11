"""Safe schema upgrade for class-wide personalized generation."""

import argparse
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import URL, make_url

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
TARGET_TABLES = ("personalized_class_batches", "personalized_class_batch_items")


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


def backup_sqlite(path):
    if not path or not path.exists():
        return None
    target = BACKEND_DIR / "backups" / f"{path.stem}.before_class_batches_{datetime.now():%Y%m%d_%H%M%S_%f}{path.suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    return target


def load_tables():
    from src.models.user import User, ClassGroup  # noqa: F401
    from src.models.course import Course  # noqa: F401
    from src.models.personalized_workflow import PersonalizedWorkflow  # noqa: F401
    from src.models.personalized_learning import PersonalizedTaskDelivery  # noqa: F401
    from src.models.personalized_class_batch import PersonalizedClassBatch, PersonalizedClassBatchItem
    return PersonalizedClassBatch.__table__, PersonalizedClassBatchItem.__table__


def main():
    parser = argparse.ArgumentParser(description="班级个性化生成安全升级器")
    parser.add_argument("--database-url")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    url, sqlite_path = normalize_database_url(args.database_url or configured_database_url())
    engine = create_engine(url)
    before = set(inspect(engine).get_table_names())
    print(f"[ClassBatch] 目标: {url.render_as_string(hide_password=True)}")
    print(f"[ClassBatch] 当前状态: {[name for name in TARGET_TABLES if name in before] or '均不存在'}")
    if not args.apply:
        print("[ClassBatch] 仅检查；传入 --apply 才会新增表。")
        return 0
    backup = backup_sqlite(sqlite_path)
    if backup:
        print(f"[ClassBatch] 已备份: {backup}")
    batch_table, item_table = load_tables()
    batch_table.create(engine, checkfirst=True)
    item_table.create(engine, checkfirst=True)
    after = set(inspect(engine).get_table_names())
    missing = [name for name in TARGET_TABLES if name not in after]
    if missing:
        raise RuntimeError(f"升级校验失败，缺少: {missing}")
    print(f"[ClassBatch] 升级完成: {list(TARGET_TABLES)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
