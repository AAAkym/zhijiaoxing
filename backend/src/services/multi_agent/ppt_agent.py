"""PPT生成智能体。

继承 AgentBase，复刻 document_agent.py 的结构：
- system_prompt 定义角色与输出格式
- process(task) 接收主题，调用讯飞智能PPT生成服务
- get_capabilities() 声明能力

与 document_agent 的区别：PPT 生成不调用 LLM 生成文本，
而是直接调用讯飞 PPT 生成 API（zwapi.xfyun.cn）生成 .pptx 文件。
LLM 仅在需要将用户简短描述扩展为结构化大纲时使用。
"""
import json
import logging
import os

from src.services.multi_agent import AgentBase
from src.services.multi_agent.shared_state import (
    AgentStatus,
    shared_state,
    message_bus,
    agent_monitor,
)
from src.services.xfyun_ppt_service import xfyun_ppt_service, is_configured as ppt_is_configured

logger = logging.getLogger(__name__)


PPT_AGENT_SYSTEM_PROMPT = """你是一位专业的PPT大纲设计智能体，负责根据课程章节主题生成结构清晰的PPT生成描述。

## 你的职责
接收课程章节标题与核心知识点，将其扩展为适合讯飞智能PPT接口生成的主题描述文本（query）。
讯飞接口会基于该描述自动生成含模板、配图、演讲备注的完整PPT。

## 描述生成原则
1. 描述需包含：主题、目标受众、核心知识点列表、期望的章节结构
2. 长度控制在200-500字，过短会导致大纲单薄，过长会超出接口处理范围
3. 明确列出要覆盖的3-5个核心知识点
4. 指明适用场景（如：课堂教学、入门讲解、复习总结）

## 输出格式
严格返回以下JSON格式，不要添加任何markdown代码块标记：
{
  "ppt_query": "<填写用于提交给讯飞PPT接口的主题描述文本>",
  "title": "<填写PPT标题>",
  "estimated_slides": <预估幻灯片数量，整数>
}"""


class PPTAgent(AgentBase):
    """PPT生成智能体。

    复刻 AgentBase 的抽象接口，process() 接收任务并调用讯飞PPT服务。
    """
    agent_name = "ppt_agent"
    agent_role = "PPT生成专家"
    agent_description = "调用讯飞智能PPT生成接口，根据课程章节主题生成含模板与配图的完整PPT"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        # 注册到消息总线和监控（复刻 coordinator_agent.py 的注册流程）
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

    def get_capabilities(self):
        return ['ppt_generation', 'outline_design', 'slide_rendering']

    def process(self, task):
        """处理PPT生成任务。

        Args:
            task: dict，需包含:
                - query: PPT主题描述（必需）
                - save_dir: .pptx保存目录（必需）
                - title: PPT标题（可选，用于命名）
                - template_id: 讯飞模板ID（可选）

        Returns:
            dict 含 sid / ppt_url / file_path / file_name / outline / status
        """
        if not isinstance(task, dict):
            return {'error': '任务参数必须是字典'}

        query = task.get('query') or task.get('topic') or task.get('description')
        save_dir = task.get('save_dir')
        if not query:
            return {'error': '缺少PPT主题描述(query)'}
        if not save_dir:
            return {'error': '缺少PPT保存目录(save_dir)'}

        if not ppt_is_configured():
            return {'error': '讯飞PPT凭证未配置，请检查 XFYUN_PPT_APP_ID / XFYUN_PPT_API_SECRET 环境变量'}

        # 发布任务开始状态（复刻 shared_state 消息机制）
        try:
            shared_state.update_agent_status(self.agent_name, AgentStatus.WORKING, {
                'task': 'generate_ppt',
                'query_preview': query[:80],
            })
        except Exception as e:
            logger.debug("更新agent状态失败(非关键): %s", e)

        try:
            result = xfyun_ppt_service.generate(
                query=query,
                save_dir=save_dir,
                template_id=task.get('template_id'),
            )
            result['status'] = 'success'

            try:
                shared_state.update_agent_status(self.agent_name, AgentStatus.IDLE, {
                    'task': 'generate_ppt',
                    'file_name': result.get('file_name'),
                })
            except Exception:
                pass
            return result

        except Exception as e:
            logger.error("PPTAgent 生成失败: %s", e, exc_info=True)
            try:
                shared_state.update_agent_status(self.agent_name, AgentStatus.ERROR, {
                    'task': 'generate_ppt',
                    'error': str(e),
                })
            except Exception:
                pass
            return {'error': f'PPT生成失败: {str(e)}', 'status': 'failed'}

    def design_query_via_llm(self, chapter_title: str, knowledge_points: list,
                              audience: str = '高校学生') -> dict:
        """通过LLM将章节标题扩展为适合讯飞接口的PPT主题描述。

        当用户只提供简短章节标题时调用此方法丰富描述。

        Args:
            chapter_title: 章节标题
            knowledge_points: 核心知识点列表
            audience: 目标受众描述

        Returns:
            dict 含 ppt_query / title / estimated_slides
        """
        kp_text = '、'.join(knowledge_points) if knowledge_points else '由你根据章节标题提炼'
        prompt = (
            f"章节标题：{chapter_title}\n"
            f"核心知识点：{kp_text}\n"
            f"目标受众：{audience}\n\n"
            f"请生成适合提交给讯飞智能PPT接口的主题描述文本。"
        )
        raw = self._call_llm(prompt, system_prompt=PPT_AGENT_SYSTEM_PROMPT, temperature=0.7)
        try:
            # 复刻 document_agent 的JSON解析容错：先直接解析，失败则剥离代码块
            cleaned = raw.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('```', 2)[1] if cleaned.count('```') >= 2 else cleaned
                if cleaned.startswith('json'):
                    cleaned = cleaned[4:]
            return json.loads(cleaned)
        except (json.JSONDecodeError, TypeError) as e:
            logger.warning("PPT query LLM输出解析失败，使用原始文本: %s", e)
            return {
                'ppt_query': f"{chapter_title}。面向{audience}，重点讲解：{kp_text}。",
                'title': chapter_title,
                'estimated_slides': 10,
            }
