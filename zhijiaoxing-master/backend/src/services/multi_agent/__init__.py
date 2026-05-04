import logging
import json
from abc import ABC, abstractmethod
from datetime import datetime

logger = logging.getLogger(__name__)


class AgentBase(ABC):
    agent_name = "base"
    agent_role = "通用智能体"
    agent_description = ""

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

    def _call_llm(self, prompt, system_prompt=None, temperature=0.7):
        if not self.spark_service:
            raise RuntimeError("Spark service not configured")
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return self.spark_service.chat(messages, temperature=temperature)

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
