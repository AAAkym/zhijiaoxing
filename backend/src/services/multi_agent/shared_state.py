import json
import logging
import threading
import time
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    WAITING = "waiting"


class MessageType(str, Enum):
    TASK_ASSIGN = "task_assign"
    TASK_RESULT = "task_result"
    QUERY = "query"
    RESPONSE = "response"
    BROADCAST = "broadcast"
    ERROR = "error"
    HEARTBEAT = "heartbeat"


class AgentMessage:
    def __init__(self, sender, receiver, msg_type, payload, parent_id=None):
        self.id = f"msg_{int(time.time() * 1000)}_{threading.get_ident()}"
        self.sender = sender
        self.receiver = receiver
        self.msg_type = msg_type
        self.payload = payload
        self.parent_id = parent_id
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self):
        return {
            "id": self.id,
            "sender": self.sender,
            "receiver": self.receiver,
            "msg_type": self.msg_type,
            "payload": self.payload,
            "parent_id": self.parent_id,
            "timestamp": self.timestamp,
        }


class SharedState:
    def __init__(self):
        self._state = {}
        self._lock = threading.Lock()
        self._history = []
        self._max_history = 200

    def set(self, key, value, agent_name=None):
        with self._lock:
            old_value = self._state.get(key)
            self._state[key] = value
            self._history.append({
                "action": "set",
                "key": key,
                "old_value": old_value,
                "new_value": value,
                "agent": agent_name,
                "timestamp": datetime.utcnow().isoformat(),
            })
            if len(self._history) > self._max_history:
                self._history = self._history[-self._max_history:]

    def get(self, key, default=None):
        with self._lock:
            return self._state.get(key, default)

    def update(self, data, agent_name=None):
        with self._lock:
            for key, value in data.items():
                old_value = self._state.get(key)
                self._state[key] = value
                self._history.append({
                    "action": "update",
                    "key": key,
                    "old_value": old_value,
                    "new_value": value,
                    "agent": agent_name,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            if len(self._history) > self._max_history:
                self._history = self._history[-self._max_history:]

    def snapshot(self):
        with self._lock:
            return dict(self._state)

    def get_history(self, limit=50):
        with self._lock:
            return self._history[-limit:]


class MessageBus:
    def __init__(self):
        self._queues = {}
        self._lock = threading.Lock()
        self._log = []
        self._max_log = 500

    def register(self, agent_name):
        with self._lock:
            if agent_name not in self._queues:
                self._queues[agent_name] = []

    def send(self, message):
        with self._lock:
            receiver = message.receiver
            if receiver == "broadcast":
                for name, queue in self._queues.items():
                    if name != message.sender:
                        queue.append(message)
            elif receiver in self._queues:
                self._queues[receiver].append(message)
            else:
                logger.warning(f"Message target not found: {receiver}")
            self._log.append(message.to_dict())
            if len(self._log) > self._max_log:
                self._log = self._log[-self._max_log:]

    def receive(self, agent_name, block=False, timeout=5):
        with self._lock:
            queue = self._queues.get(agent_name, [])
            if queue:
                return queue.pop(0)
        return None

    def get_log(self, limit=100):
        with self._lock:
            return self._log[-limit:]


class AgentMonitor:
    def __init__(self):
        self._agents = {}
        self._lock = threading.Lock()

    def register_agent(self, name, role, capabilities):
        with self._lock:
            self._agents[name] = {
                "name": name,
                "role": role,
                "capabilities": capabilities,
                "status": AgentStatus.IDLE,
                "last_heartbeat": datetime.utcnow().isoformat(),
                "task_count": 0,
                "success_count": 0,
                "fail_count": 0,
                "current_task": None,
                "started_at": None,
            }

    def update_status(self, name, status, task_info=None):
        persist_payload = None
        with self._lock:
            if name not in self._agents:
                return
            agent_state = self._agents[name]
            agent_state["status"] = status
            agent_state["last_heartbeat"] = datetime.utcnow().isoformat()
            if status == AgentStatus.RUNNING:
                agent_state["task_count"] += 1
                agent_state["current_task"] = task_info
                agent_state["started_at"] = datetime.utcnow().isoformat()
            elif status in (AgentStatus.SUCCESS, AgentStatus.FAILED):
                # 终态：先计算耗时并准备持久化数据，再清理内存态
                started_iso = agent_state.get("started_at")
                duration_ms = None
                if started_iso:
                    try:
                        started_dt = datetime.fromisoformat(started_iso)
                        duration_ms = int((datetime.utcnow() - started_dt).total_seconds() * 1000)
                    except (ValueError, TypeError):
                        duration_ms = None
                if status == AgentStatus.SUCCESS:
                    agent_state["success_count"] += 1
                else:
                    agent_state["fail_count"] += 1
                agent_state["current_task"] = None
                agent_state["started_at"] = None
                # 从 task_info 提取任务类型/错误/用户
                task_type = None
                error_message = None
                user_id = None
                if isinstance(task_info, dict):
                    task_type = (task_info.get("task_type") or task_info.get("description")
                                 or task_info.get("title"))
                    error_message = task_info.get("error") or task_info.get("error_message")
                    user_id = task_info.get("user_id")
                elif isinstance(task_info, str):
                    task_type = task_info
                persist_payload = {
                    "agent_name": name,
                    "task_type": task_type,
                    "status": status.value,
                    "duration_ms": duration_ms,
                    "error_message": error_message,
                    "user_id": user_id,
                }
        # 落库放在锁外，避免持锁等待 DB IO；best-effort，失败不影响 agent 执行
        if persist_payload:
            self._persist_execution(persist_payload)

    def _persist_execution(self, payload):
        """将一次 agent 终态执行记录持久化到数据库（best-effort）。"""
        try:
            from src.models.agent_execution_log import AgentExecutionLog
            from src.models.user import db as _db
            from flask import current_app

            def _do_persist():
                try:
                    record = AgentExecutionLog(
                        agent_name=payload["agent_name"],
                        task_type=payload["task_type"],
                        status=payload["status"],
                        duration_ms=payload["duration_ms"],
                        error_message=payload["error_message"],
                        user_id=payload["user_id"],
                    )
                    _db.session.add(record)
                    _db.session.commit()
                except Exception as exc:
                    try:
                        _db.session.rollback()
                    except Exception:
                        pass
                    logger.warning("智能体执行记录落库失败 agent=%s status=%s: %s",
                                   payload.get("agent_name"), payload.get("status"), exc)

            # 多 Agent 在后台线程执行，可能缺少 Flask app context，需主动获取
            # 使用 with 语句确保 context 在持久化完成后自动释放，避免 context 泄露
            has_app_context = False
            try:
                current_app._get_current_object()
                has_app_context = True
            except RuntimeError:
                has_app_context = False

            if has_app_context:
                _do_persist()
            else:
                try:
                    from src.main import app as _flask_app
                    with _flask_app.app_context():
                        _do_persist()
                except Exception:
                    logger.debug("无法获取 Flask app context，跳过智能体执行记录落库")
                    return
        except Exception as exc:
            logger.warning("智能体执行记录持久化异常: %s", exc)

    def update_citation_coverage(self, agent_name, coverage_score):
        """更新智能体的引用覆盖率"""
        with self._lock:
            if agent_name in self._agents:
                self._agents[agent_name]["citation_coverage"] = coverage_score

    def update_output_summary(self, agent_name, summary):
        """更新智能体的产物摘要"""
        with self._lock:
            if agent_name in self._agents:
                self._agents[agent_name]["output_summary"] = summary

    def get_status(self, name=None):
        with self._lock:
            if name:
                return self._agents.get(name)
            return dict(self._agents)

    def get_summary(self):
        with self._lock:
            total = len(self._agents)
            running = sum(1 for a in self._agents.values() if a["status"] == AgentStatus.RUNNING)
            idle = sum(1 for a in self._agents.values() if a["status"] == AgentStatus.IDLE)
            total_tasks = sum(a["task_count"] for a in self._agents.values())
            total_success = sum(a["success_count"] for a in self._agents.values())
            total_fail = sum(a["fail_count"] for a in self._agents.values())
            return {
                "total_agents": total,
                "running": running,
                "idle": idle,
                "total_tasks": total_tasks,
                "total_success": total_success,
                "total_fail": total_fail,
                "success_rate": round(total_success / total_tasks, 2) if total_tasks > 0 else 0,
            }


shared_state = SharedState()
message_bus = MessageBus()
agent_monitor = AgentMonitor()
