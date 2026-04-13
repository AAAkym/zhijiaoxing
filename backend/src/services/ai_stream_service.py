"""
AI流式输出服务

提供符合SSE协议的AI内容流式生成功能
"""
import time
import json
from typing import Generator, Dict, Any, Optional
from datetime import datetime


class AIStreamService:
    """
    AI流式输出服务
    
    模拟AI模型的流式输出，支持逐字/逐句输出
    """
    
    def __init__(self):
        self.chunk_delay = 0.1  # 每个字符之间的延迟（秒）
    
    def generate_content_stream(self, prompt: str, 
                               params: Optional[Dict[str, Any]] = None) -> Generator[str, None, None]:
        """
        生成AI内容的流式输出
        
        Args:
            prompt: 用户输入的提示词
            params: 生成参数（如temperature, max_tokens等）
            
        Yields:
            生成的内容片段
        """
        # 模拟AI思考过程
        yield from self._generate_thinking_phase()
        
        # 根据prompt生成内容
        content = self._generate_content_by_prompt(prompt)
        
        # 流式输出内容
        yield from self._stream_content(content)
        
        # 输出完成标记
        yield '[DONE]'
    
    def generate_course_outline_stream(self, course_title: str, 
                                      course_description: str,
                                      num_chapters: int = 5) -> Generator[str, None, None]:
        """
        流式生成课程大纲
        
        Args:
            course_title: 课程标题
            course_description: 课程描述
            num_chapters: 章节数量
            
        Yields:
            大纲内容片段
        """
        # 发送开始标记
        yield json.dumps({
            'type': 'start',
            'message': f'开始生成《{course_title}》课程大纲...'
        }, ensure_ascii=False)
        
        time.sleep(0.5)
        
        # 生成课程概述
        yield json.dumps({
            'type': 'overview',
            'content': f'本课程《{course_title}》旨在帮助学员掌握核心知识和技能。'
        }, ensure_ascii=False)
        
        time.sleep(0.3)
        
        # 逐章生成
        for i in range(1, num_chapters + 1):
            chapter_data = {
                'type': 'chapter',
                'chapter_num': i,
                'title': f'第{i}章：{self._get_chapter_title(i, course_title)}',
                'content': self._get_chapter_content(i),
                'objectives': [
                    f'掌握第{i}章的核心概念',
                    f'理解第{i}章的关键知识点',
                    f'能够应用第{i}章的内容解决实际问题'
                ]
            }
            
            yield json.dumps(chapter_data, ensure_ascii=False)
            time.sleep(0.5)
        
        # 发送总结
        yield json.dumps({
            'type': 'summary',
            'content': f'课程大纲生成完成！共{num_chapters}章，祝您学习愉快！'
        }, ensure_ascii=False)
        
        yield '[DONE]'
    
    def generate_explanation_stream(self, topic: str, 
                                   detail_level: str = 'medium') -> Generator[str, None, None]:
        """
        流式生成知识点解释
        
        Args:
            topic: 知识点主题
            detail_level: 详细程度（brief, medium, detailed）
            
        Yields:
            解释内容片段
        """
        # 发送开始标记
        yield json.dumps({
            'type': 'start',
            'topic': topic
        }, ensure_ascii=False)
        
        # 生成解释内容
        explanations = {
            'brief': [
                f'{topic}是一个重要的概念。',
                '它在实际应用中有广泛用途。',
                '理解这个概念对学习后续内容很有帮助。'
            ],
            'medium': [
                f'{topic}是一个重要的概念，值得我们深入学习。',
                '首先，让我们了解它的基本定义和核心原理。',
                '其次，我们需要掌握它的主要特点和应用场景。',
                '最后，通过实践来加深对这个概念的理解。'
            ],
            'detailed': [
                f'{topic}是一个重要的概念，在计算机科学和相关领域有着广泛的应用。',
                '**定义**：' + topic + '指的是...',
                '**核心原理**：其工作原理基于...',
                '**主要特点**：',
                '1. 高效性：能够快速处理大量数据',
                '2. 可靠性：在各种环境下都能稳定运行',
                '3. 可扩展性：易于扩展和维护',
                '**应用场景**：',
                '- Web开发',
                '- 数据分析',
                '- 人工智能',
                '**实践建议**：建议通过实际项目来加深理解。'
            ]
        }
        
        content_list = explanations.get(detail_level, explanations['medium'])
        
        for content in content_list:
            yield json.dumps({
                'type': 'content',
                'content': content
            }, ensure_ascii=False)
            time.sleep(0.3)
        
        yield '[DONE]'
    
    def _generate_thinking_phase(self) -> Generator[str, None, None]:
        """生成AI思考阶段的内容"""
        thinking_steps = [
            {'type': 'thinking', 'message': '正在分析问题...'},
            {'type': 'thinking', 'message': '检索相关知识...'},
            {'type': 'thinking', 'message': '组织回答内容...'},
        ]
        
        for step in thinking_steps:
            yield json.dumps(step, ensure_ascii=False)
            time.sleep(0.2)
    
    def _generate_content_by_prompt(self, prompt: str) -> str:
        """根据prompt生成内容"""
        # 这里模拟AI生成内容
        # 实际项目中应调用真实的AI API
        
        responses = {
            '你好': '你好！很高兴为您服务。请问有什么可以帮助您的吗？',
            'python': 'Python是一种高级编程语言，以其简洁和易读性著称。它广泛应用于Web开发、数据分析、人工智能等领域。',
            '课程': '我们的课程涵盖了从基础到高级的各个层次，包括编程、数据分析、人工智能等热门领域。',
        }
        
        # 尝试匹配关键词
        for keyword, response in responses.items():
            if keyword in prompt.lower():
                return response
        
        # 默认回复
        return f'关于"{prompt}"的问题，我来为您详细解答。这是一个很好的问题，涉及到多个方面的知识点。'
    
    def _stream_content(self, content: str) -> Generator[str, None, None]:
        """将内容流式输出"""
        # 按句子分割
        sentences = content.split('。')
        
        for sentence in sentences:
            if sentence.strip():
                yield json.dumps({
                    'type': 'content',
                    'content': sentence + '。'
                }, ensure_ascii=False)
                time.sleep(self.chunk_delay)
    
    def _get_chapter_title(self, chapter_num: int, course_title: str) -> str:
        """获取章节标题"""
        titles = [
            '基础概念与原理',
            '核心技术与方法',
            '实践应用与案例',
            '进阶技巧与优化',
            '综合项目实战',
            '前沿趋势与展望'
        ]
        return titles[(chapter_num - 1) % len(titles)]
    
    def _get_chapter_content(self, chapter_num: int) -> str:
        """获取章节内容描述"""
        contents = [
            '本章将介绍基础概念，帮助您建立扎实的理论基础。',
            '本章深入讲解核心技术，让您掌握关键技能。',
            '本章通过实际案例，展示如何应用所学知识。',
            '本章分享进阶技巧，帮助您提升专业水平。',
            '本章通过综合项目，检验和提升您的实战能力。',
            '本章探讨前沿趋势，拓展您的视野和思路。'
        ]
        return contents[(chapter_num - 1) % len(contents)]


# 全局服务实例
ai_stream_service = AIStreamService()


def generate_ai_stream(prompt: str, params: Optional[Dict[str, Any]] = None) -> Generator[str, None, None]:
    """
    便捷函数：生成AI内容流
    
    Args:
        prompt: 提示词
        params: 参数
        
    Yields:
        内容片段
    """
    yield from ai_stream_service.generate_content_stream(prompt, params)


def generate_course_outline_stream(course_title: str, course_description: str,
                                   num_chapters: int = 5) -> Generator[str, None, None]:
    """
    便捷函数：生成课程大纲流
    
    Args:
        course_title: 课程标题
        course_description: 课程描述
        num_chapters: 章节数
        
    Yields:
        大纲内容片段
    """
    yield from ai_stream_service.generate_course_outline_stream(
        course_title, course_description, num_chapters
    )


def generate_explanation_stream(topic: str, detail_level: str = 'medium') -> Generator[str, None, None]:
    """
    便捷函数：生成知识点解释流
    
    Args:
        topic: 知识点
        detail_level: 详细程度
        
    Yields:
        解释内容片段
    """
    yield from ai_stream_service.generate_explanation_stream(topic, detail_level)
