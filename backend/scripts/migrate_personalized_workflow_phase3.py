"""Safe, standalone schema upgrade for personalized workflow phase 3."""

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
TARGET_TABLES = (
    "personalized_task_deliveries",
    "personalized_delivery_events",
    "personalized_learning_cycles",
)


def configured_database_url():
    from dotenv import load_dotenv

    load_dotenv(BACKEND_DIR / ".env")
    return os.environ.get("DATABASE_URL", "sqlite:///dev.db")


def normalize_database_url(raw_url):
    url = make_url(raw_url)
    backup_path = None
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        database_path = Path(url.database)
        if not database_path.is_absolute():
            database_path = BACKEND_DIR / "instance" / database_path
        database_path = database_path.resolve()
        database_path.parent.mkdir(parents=True, exist_ok=True)
        backup_path = database_path
        url = URL.create("sqlite", database=str(database_path))
    return url, backup_path


def backup_sqlite(database_path):
    if not database_path or not database_path.exists():
        return None
    backup_dir = BACKEND_DIR / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    backup_path = backup_dir / f"{database_path.stem}.before_phase3_{stamp}{database_path.suffix}"
    shutil.copy2(database_path, backup_path)
    return backup_path


def load_tables():
    from src.models.user import User, ClassGroup  # noqa: F401
    from src.models.course import Course  # noqa: F401
    from src.models.personalized_workflow import PersonalizedWorkflow  # noqa: F401
    from src.models.personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent, PersonalizedLearningCycle

    return PersonalizedTaskDelivery.__table__, PersonalizedDeliveryEvent.__table__, PersonalizedLearningCycle.__table__


def main():
    parser = argparse.ArgumentParser(description="个性化教学工作流第三阶段安全升级器")
    parser.add_argument("--database-url", help="覆盖 .env 中的 DATABASE_URL")
    parser.add_argument("--apply", action="store_true", help="实际执行；不传时只检查")
    parser.add_argument("--rollback", action="store_true", help="只回滚本阶段新增的三张表")
    args = parser.parse_args()

    url, sqlite_path = normalize_database_url(args.database_url or configured_database_url())
    engine = create_engine(url)
    before = set(inspect(engine).get_table_names())
    action = "回滚" if args.rollback else "升级"
    print(f"[Phase3] {action}目标: {url.render_as_string(hide_password=True)}")
    print(f"[Phase3] 当前状态: {[name for name in TARGET_TABLES if name in before] or '三张表均不存在'}")
    if not args.apply:
        print("[Phase3] 检查完成；传入 --apply 后才会修改数据库。")
        return 0

    backup_path = backup_sqlite(sqlite_path)
    if backup_path:
        print(f"[Phase3] SQLite备份: {backup_path}")

    delivery_table, event_table, cycle_table = load_tables()
    if args.rollback:
        cycle_table.drop(engine, checkfirst=True)
        event_table.drop(engine, checkfirst=True)
        delivery_table.drop(engine, checkfirst=True)
    else:
        delivery_table.create(engine, checkfirst=True)
        event_table.create(engine, checkfirst=True)
        cycle_table.create(engine, checkfirst=True)

    after = set(inspect(engine).get_table_names())
    present = [name for name in TARGET_TABLES if name in after]
    expected = [] if args.rollback else list(TARGET_TABLES)
    if present != expected:
        raise RuntimeError(f"升级校验失败，期望{expected}，实际{present}")
    print(f"[Phase3] {action}完成: {present or '三张阶段三表已移除'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
