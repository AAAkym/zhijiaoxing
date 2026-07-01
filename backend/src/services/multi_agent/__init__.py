import logging
import json
import time
from abc import ABC, abstractmethod
from datetime import datetime

logger = logging.getLogger(__name__)


class AgentBase(ABC):
    agent_name = "base"
    agent_role = "通用智能体"
    agent_description = ""

    # LLM调用重试配置：应对并发场景下Spark API bulkhead/circuit breaker/QPS/并发限流瞬时拒绝
    LLM_MAX_RETRIES = 4
    LLM_RETRY_BASE_DELAY = 2.0

    def __init__(self, spark_service=None):
        self.spark_service = spark_service
        self.context = {}

    def set_context(self, context):
        self.context = context

    def update_context(self, key, value):
        self.context[key] = value

    @abstractmethod
    def process(self, task):
        pass

    @abstractmethod
    def get_capabilities(self):
        return []

    def _call_llm(self, prompt, system_prompt=None, temperature=0.7, user_id=None, user_role=None):
        if not self.spark_service:
            raise RuntimeError("AI服务未配置，请在环境变量中设置SPARK_API_PASSWORD")
        if hasattr(self.spark_service, 'is_configured') and not self.spark_service.is_configured():
            raise RuntimeError("AI服务凭证未配置，请检查SPARK_API_PASSWORD环境变量")
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        last_error = None
        for attempt in range(1, self.LLM_MAX_RETRIES + 2):
            try:
                try:
                    return self.spark_service.chat(messages, user_id=user_id, user_role=user_role, call_type='multi_agent')
                except TypeError:
                    return self.spark_service.chat(messages)
            except Exception as exc:
                last_error = exc
                error_msg = str(exc).lower()
                # 检测瞬时错误：bulkhead忙/熔断器开启/超时/QPS限流/并发限流/500服务端错误
                is_transient = any(keyword in error_msg for keyword in (
                    "busy", "circuit", "timeout", "timed out", "connection",
                    "rate limit", "too many requests", "service unavailable",
                    "500", "internal server error",
                    "qpsoverflow", "concurrencyoverflow", "overflow", "concurrency",
                ))
                if not is_transient or attempt > self.LLM_MAX_RETRIES:
                    raise
                # QPS/并发限流错误需要更长退避时间，给API更多恢复时间
                is_rate_limited = any(k in error_msg for k in ("qps", "overflow", "concurrency", "busy"))
                delay = self.LLM_RETRY_BASE_DELAY * attempt * (2.5 if is_rate_limited else 1)
                logger.warning(
                    "Agent %s LLM调用第%d次失败(瞬时错误%s)，%.1fs后重试: %s",
                    self.agent_name, attempt,
                    "·限流" if is_rate_limited else "", delay, exc,
                )
                time.sleep(delay)
        raise last_error

    def to_dict(self):
        return {
            'agent_name': self.agent_name,
            'agent_role': self.agent_role,
            'agent_description': self.agent_description,
            'capabilities': self.get_capabilities(),
        }


class Orchestrator:
    def __init__(self, spark_service=None):
        self.spark_service = spark_service
        self.agents = {}
        self.task_history = []

    def register_agent(self, agent):
        if not isinstance(agent, AgentBase):
            raise TypeError(f"Agent must be instance of AgentBase, got {type(agent)}")
        self.agents[agent.agent_name] = agent
        logger.info(f"Registered agent: {agent.agent_name} ({agent.agent_role})")

    def get_agent(self, name):
        return self.agents.get(name)

    def dispatch(self, task_type, task_data):
        agent_map = {
            'profile': 'profiler',
            'resource': 'coordinator',
            'exercise': 'exercise_agent',
            'document': 'document_agent',
            'media': 'media_agent',
            'recommendation': 'recommendation_agent',
            'project': 'project_agent',
            'path': 'recommender',
            'evaluation': 'evaluator',
            'tutor': 'tutor',
        }
        agent_name = agent_map.get(task_type)
        if not agent_name or agent_name not in self.agents:
            return {'error': f'No agent available for task type: {task_type}'}

        agent = self.agents[agent_name]
        try:
            result = agent.process(task_data)
            self.task_history.append({
                'agent': agent_name,
                'task_type': task_type,
                'timestamp': datetime.utcnow().isoformat(),
                'status': 'success',
            })
            return result
        except Exception as e:
            logger.error(f"Agent {agent_name} failed: {e}")
            self.task_history.append({
                'agent': agent_name,
                'task_type': task_type,
                'timestamp': datetime.utcnow().isoformat(),
                'status': 'failed',
                'error': str(e),
            })
            return {'error': str(e)}

    def get_status(self):
        return {
            'registered_agents': [a.to_dict() for a in self.agents.values()],
            'task_count': len(self.task_history),
        }
