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
        with self._lock:
            if name in self._agents:
                self._agents[name]["status"] = status
                self._agents[name]["last_heartbeat"] = datetime.utcnow().isoformat()
                if status == AgentStatus.RUNNING:
                    self._agents[name]["task_count"] += 1
                    self._agents[name]["current_task"] = task_info
                    self._agents[name]["started_at"] = datetime.utcnow().isoformat()
                elif status == AgentStatus.SUCCESS:
                    self._agents[name]["success_count"] += 1
                    self._agents[name]["current_task"] = None
                    self._agents[name]["started_at"] = None
                elif status == AgentStatus.FAILED:
                    self._agents[name]["fail_count"] += 1
                    self._agents[name]["current_task"] = None
                    self._agents[name]["started_at"] = None

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
