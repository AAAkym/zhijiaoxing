"""
AI内容生成任务

处理AI相关的内容生成任务，包括：
- 教学内容生成
- 练习题生成
- 课程大纲生成
- 批量内容生成
"""
import time
import json
from typing import Dict, Any, Optional, List
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from src.services.spark_service import spark_service


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_ai_content(self, prompt: str, params: Optional[Dict[str, Any]] = None, user_id: int = None, user_role: str = None) -> Dict[str, Any]:
    """
    生成AI内容任务
    
    Args:
        prompt: 文本提示/指令
        params: 生成参数（如temperature、max_tokens等）
        
    Returns:
        包含生成结果的字典
        {
            'status': 'success' | 'error',
            'content': str,
            'metadata': dict,
            'task_id': str
        }
    """
    try:
        # 更新任务状态
        self.update_state(state='PROGRESS', meta={'progress': 10, 'message': '准备生成内容'})
        
        # 调用真实 AI 模型生成内容（Spark）
        self.update_state(state='PROGRESS', meta={'progress': 50, 'message': '正在生成内容'})
        content = spark_service.chat(prompt, user_id=user_id, user_role=user_role)
        
        self.update_state(state='PROGRESS', meta={'progress': 90, 'message': '处理生成结果'})
        
        # 模拟后处理
        time.sleep(1)
        
        result = {
            'status': 'success',
            'content': content,
            'metadata': {
                'prompt': prompt,
                'params': params or {},
                'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                'task_id': self.request.id,
            }
        }
        
        self.update_state(state='SUCCESS', meta={'progress': 100, 'message': '生成完成'})
        return result
        
    except SoftTimeLimitExceeded:
        # 软超时处理
        return {
            'status': 'error',
            'error': '任务执行超时',
            'task_id': self.request.id
        }
    except Exception as exc:
        # 重试机制
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
        
        return {
            'status': 'error',
            'error': str(exc),
            'task_id': self.request.id
        }


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def batch_generate_content(self, prompts: List[str], params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    批量生成AI内容任务
    
    Args:
        prompts: 文本提示列表
        params: 生成参数
        
    Returns:
        批量生成结果
    """
    results = []
    total = len(prompts)
    
    try:
        for i, prompt in enumerate(prompts):
            progress = int((i / total) * 100)
            self.update_state(
                state='PROGRESS',
                meta={
                    'progress': progress,
                    'message': f'正在生成第 {i+1}/{total} 个内容',
                    'current': i + 1,
                    'total': total
                }
            )
            
            # 调用单个生成任务
            result = generate_ai_content.apply_async(args=[prompt, params])
            results.append({
                'prompt': prompt,
                'task_id': result.id,
                'status': 'queued'
            })
            
            # 避免请求过快
            time.sleep(0.5)
        
        return {
            'status': 'success',
            'total': total,
            'results': results,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        
        return {
            'status': 'error',
            'error': str(exc),
            'task_id': self.request.id
        }


@shared_task(bind=True, max_retries=3)
def generate_course_outline(self, course_title: str, course_description: str,
                           num_chapters: int = 5, user_id: int = None, user_role: str = None) -> Dict[str, Any]:
    """
    生成课程大纲任务
    
    Args:
        course_title: 课程标题
        course_description: 课程描述
        num_chapters: 章节数量
        
    Returns:
        课程大纲
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 20, 'message': '分析课程信息'})
        
        # 构建提示
        prompt = f"""请为以下课程生成详细大纲：

课程标题：{course_title}
课程描述：{course_description}
章节数量：{num_chapters}章

请生成包含以下内容的课程大纲：
1. 每章的标题
2. 每章的学习目标
3. 每章的主要内容要点
4. 建议的学习时长
"""
        
        self.update_state(state='PROGRESS', meta={'progress': 50, 'message': '生成课程大纲'})
        
        # 调用 AI 生成课程大纲（Spark）
        outline_prompt = f"""请为以下课程生成详细大纲，输出 JSON：
课程标题：{course_title}
课程描述：{course_description}
章节数量：{num_chapters}

要求：
1. 返回 JSON，字段包含 title、description、chapters
2. chapters 为数组，每项包含 chapter_num、title、objectives、key_points、duration
3. objectives、key_points 为字符串数组
"""
        outline_text = spark_service.chat(outline_prompt, user_id=user_id, user_role=user_role)
        try:
            outline = json.loads(outline_text)
        except Exception:
            outline = {
                'title': course_title,
                'description': course_description,
                'chapters': []
            }
        
        self.update_state(state='PROGRESS', meta={'progress': 90, 'message': '格式化大纲'})
        
        return {
            'status': 'success',
            'outline': outline,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        
        return {
            'status': 'error',
            'error': str(exc),
            'task_id': self.request.id
        }


@shared_task(bind=True, max_retries=3)
def generate_exercise_questions(self, topic: str, question_type: str = 'multiple_choice',
                               num_questions: int = 5, difficulty: str = 'medium',
                               user_id: int = None, user_role: str = None) -> Dict[str, Any]:
    """
    生成练习题任务
    
    Args:
        topic: 题目主题
        question_type: 题目类型（multiple_choice, fill_blank, essay等）
        num_questions: 题目数量
        difficulty: 难度（easy, medium, hard）
        
    Returns:
        练习题列表
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 30, 'message': '准备生成题目'})
        
        # 调用 AI 生成练习题（Spark）
        q_prompt = f"""请生成练习题，输出 JSON 数组：
主题：{topic}
题型：{question_type}
数量：{num_questions}
难度：{difficulty}

要求：
1. 返回 JSON 数组
2. 每题字段包含：id, type, difficulty, question, options(如适用), answer, explanation
"""
        questions_text = spark_service.chat(q_prompt, user_id=user_id, user_role=user_role)
        try:
            questions = json.loads(questions_text)
        except Exception:
            questions = []
        
        self.update_state(state='PROGRESS', meta={'progress': 90, 'message': '整理题目格式'})
        
        return {
            'status': 'success',
            'topic': topic,
            'questions': questions,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        
        return {
            'status': 'error',
            'error': str(exc),
            'task_id': self.request.id
        }
