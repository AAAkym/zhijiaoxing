"""Spark LLM service wrapper.

Provides `chat(...)` -> str and `chat_stream(...)` -> Iterator[str].
Supports the OpenAI-compatible HTTP interface for Spark models.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Dict, Generator, Iterable, List, Optional, Union

import requests
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(env_path)

# 配置日志
logger = logging.getLogger(__name__)


DEFAULT_SPARK_API_URL = "https://spark-api-open.xf-yun.com/v1/chat/completions"
# 如果未指定，默认用 Spark Lite（已开通的免费/低配版）
DEFAULT_SPARK_MODEL = "lite"
# 修复：增加默认超时时间到120秒，避免AI分析超时导致流中断
DEFAULT_TIMEOUT_SECONDS = 120


class SparkServiceError(Exception):
    pass


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.environ.get(name)
    return value if value is not None and value != "" else default


def _resolve_api_password() -> str:
    api_password = _env("SPARK_API_PASSWORD")
    if api_password:
        logger.info(f"✅ 使用SPARK_API_PASSWORD进行认证 (长度: {len(api_password)})")
        return api_password

    api_key = _env("SPARK_API_KEY")
    api_secret = _env("SPARK_API_SECRET")
    if api_key and api_secret:
        password = f"{api_key}:{api_secret}"
        logger.info(f"✅ 使用SPARK_API_KEY + SPARK_API_SECRET组合认证")
        return password

    if api_key:
        logger.info(f"⚠️ 仅使用SPARK_API_KEY进行认证 (不推荐)")
        return api_key

    error_msg = "Missing Spark credentials. Set SPARK_API_PASSWORD or SPARK_API_KEY/SPARK_API_SECRET."
    logger.error(f"❌ {error_msg}")
    raise SparkServiceError(error_msg)


def is_configured():
    try:
        _resolve_api_password()
        return True
    except SparkServiceError:
        return False


def _get_headers() -> Dict[str, str]:
    headers = {
        "Authorization": f"Bearer {_resolve_api_password()}",
        "Content-Type": "application/json",
    }
    app_id = _env("SPARK_APP_ID")
    if app_id:
        headers["X-Appid"] = app_id
        logger.info(f"📋 请求头设置: Authorization=Bearer *** (已隐藏), X-Appid={app_id}")
    else:
        logger.info(f"📋 请求头设置: Authorization=Bearer *** (已隐藏), 无X-Appid")
    return headers


def _normalize_messages(messages: Union[str, List[Dict[str, str]]]) -> List[Dict[str, str]]:
    if isinstance(messages, str):
        return [{"role": "user", "content": messages}]
    return messages


def _build_payload(
    messages: Union[str, List[Dict[str, str]]],
    stream: bool = False,
    user: Optional[str] = None,
) -> Dict[str, object]:
    payload: Dict[str, object] = {
        "model": _env("SPARK_MODEL", DEFAULT_SPARK_MODEL),
        "messages": _normalize_messages(messages),
    }
    if stream:
        payload["stream"] = True
    if user:
        payload["user"] = user

    temperature = _env("SPARK_TEMPERATURE")
    top_p = _env("SPARK_TOP_P")
    max_tokens = _env("SPARK_MAX_TOKENS")
    if temperature is not None:
        payload["temperature"] = float(temperature)
    if top_p is not None:
        payload["top_p"] = float(top_p)
    if max_tokens is not None:
        payload["max_tokens"] = int(max_tokens)

    return payload


def _parse_chat_response(data: Dict[str, object]) -> str:
    if isinstance(data, dict) and data.get("code") not in (None, 0):
        raise SparkServiceError(
            f"Spark API error {data.get('code')}: {data.get('message')}"
        )

    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0] or {}
        message = choice.get("message") or {}
        if isinstance(message, dict) and message.get("content") is not None:
            return str(message.get("content"))
        delta = choice.get("delta") or {}
        if isinstance(delta, dict) and delta.get("content") is not None:
            return str(delta.get("content"))

    return str(data.get("text") or data.get("message") or "")


def _iter_stream_chunks(resp: requests.Response) -> Iterable[str]:
    """迭代处理SSE流式响应，确保UTF-8编码正确处理"""
    buffer = ""
    chunk_count = 0
    
    for chunk in resp.iter_content(chunk_size=None):
        if not chunk:
            continue
        
        # 明确使用UTF-8解码，处理编码错误
        try:
            decoded_chunk = chunk.decode('utf-8', errors='replace')
        except (UnicodeDecodeError, AttributeError) as e:
            logger.warning(f"UTF-8解码失败，使用备用方案: {e}")
            decoded_chunk = chunk.decode('utf-8', errors='replace')
        
        buffer += decoded_chunk
        
        # 按行分割处理
        while '\n' in buffer:
            line, buffer = buffer.split('\n', 1)
            line = line.strip()
            
            if not line:
                continue
            
            # 移除SSE的data:前缀
            if line.startswith("data:"):
                line = line[len("data:"):].strip()
            
            if line == "[DONE]":
                logger.info(f"SSE流处理完成，共处理 {chunk_count} 个数据块")
                return
            
            # 解析JSON数据
            try:
                data = json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON解析失败: {e}, 原始数据: {line[:100]}")
                continue
            
            # 检查API错误
            if isinstance(data, dict) and data.get("code") not in (None, 0):
                error_msg = f"Spark API error {data.get('code')}: {data.get('message')}"
                logger.error(error_msg)
                raise SparkServiceError(error_msg)
            
            # 提取内容
            choices = data.get("choices") or []
            for choice in choices:
                delta = choice.get("delta") or {}
                if isinstance(delta, dict) and delta.get("content") is not None:
                    content = delta.get("content")
                    chunk_count += 1
                    # 确保返回字符串类型
                    yield str(content) if content is not None else ""


def chat(messages: Union[str, List[Dict[str, str]]]) -> str:
    """Send a synchronous chat request and return the text response."""
    url = _env("SPARK_API_URL", DEFAULT_SPARK_API_URL)
    timeout = int(_env("SPARK_TIMEOUT", str(DEFAULT_TIMEOUT_SECONDS)))
    payload = _build_payload(messages, stream=False, user=_env("SPARK_USER"))
    logger.info(f"🚀 发送同步API请求到: {url}, 超时: {timeout}秒")
    logger.debug(f"📦 请求payload: {json.dumps(payload, ensure_ascii=False)[:500]}...")
    resp = requests.post(url, json=payload, headers=_get_headers(), timeout=timeout)
    try:
        resp.raise_for_status()
        logger.info(f"✅ API请求成功, 状态码: {resp.status_code}")
    except requests.RequestException as exc:
        logger.error(f"❌ API请求失败: {exc}, 响应内容: {resp.text[:200] if resp.text else '无'}")
        raise SparkServiceError(f"Spark API request failed: {exc}")
    return _parse_chat_response(resp.json())


def chat_stream(messages: Union[str, List[Dict[str, str]]]) -> Generator[str, None, None]:
    """Yield chunks from the streaming endpoint using SSE."""
    if not is_configured():
        error_msg = "AI服务未配置，请在后端.env文件中设置SPARK_API_KEY和SPARK_API_SECRET"
        logger.error(error_msg)
        raise SparkServiceError(error_msg)

    url = _env("SPARK_API_URL", DEFAULT_SPARK_API_URL)
    timeout = int(_env("SPARK_TIMEOUT", str(DEFAULT_TIMEOUT_SECONDS)))
    payload = _build_payload(messages, stream=True, user=_env("SPARK_USER"))
    logger.info(f"🚀 发送流式API请求到: {url}, 超时: {timeout}秒")
    with requests.post(
        url, json=payload, headers=_get_headers(), timeout=timeout, stream=True
    ) as resp:
        try:
            resp.raise_for_status()
            logger.info(f"✅ 流式API请求成功, 状态码: {resp.status_code}")
        except requests.RequestException as exc:
            logger.error(f"❌ 流式API请求失败: {exc}, 响应内容: {resp.text[:200] if resp.text else '无'}")
            raise SparkServiceError(f"Spark API request failed: {exc}")

        chunk_index = 0
        for chunk in _iter_stream_chunks(resp):
            chunk_index += 1
            yield chunk

        logger.info(f"✅ 流式响应处理完成, 共 {chunk_index} 个内容块")


def generate_teaching_content(
    course_title: str,
    topic: str,
    knowledge_base: Optional[str] = None,
) -> str:
    prompt = f"""请为以下课程生成教学内容。

课程：{course_title}
主题：{topic}

要求：
1. 内容结构清晰，分段落输出
2. 包含核心概念、关键步骤、常见误区
3. 如有必要，给出简短示例或类比
4. 适合中级学习者阅读
"""
    if knowledge_base:
        prompt += f"\n\n参考知识库：\n{knowledge_base[:2000]}"
    messages = [{"role": "user", "content": prompt}]
    return chat(messages)


def ai_tutor_chat(
    question: str,
    context: str = "",
    knowledge_base: str = "",
    ai_style: str = "academic",
) -> str:
    style_prompts = {
        'academic': """你是一位专业的AI学习助手，风格严谨学术。请根据学生的问题，结合教学内容进行解答。
解答要求：
1. 准确、专业、严谨
2. 提供详细的理论依据和知识点解释
3. 引用相关的学术概念
4. 逻辑清晰，结构完整
5. 鼓励学生深入思考和探索

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。""",
        'humorous': """你是一位风趣幽默的AI学习助手。请用轻松有趣的方式回答学生的问题。
解答要求：
1. 用生动有趣的比喻和例子解释概念
2. 适当加入一些幽默元素，但不要过度
3. 让学习变得愉快和轻松
4. 在幽默中传递准确的知识
5. 保持友好和鼓励的态度

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。""",
        'encouraging': """你是一位充满鼓励的AI学习助手。请用积极向上的方式引导学生学习。
解答要求：
1. 给予充分的肯定和鼓励
2. 循序渐进地引导学生思考
3. 肯定学生的每一点进步
4. 用积极的语言激发学习兴趣
5. 帮助学生建立学习信心
6. 提供具体的学习建议和方法

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。""",
        'concise': """你是一位简洁直接的AI学习助手。请用简洁明了的方式回答问题。
解答要求：
1. 直接回答问题，不啰嗦
2. 重点突出，条理清晰
3. 用最少的话传递最核心的信息
4. 避免冗长的解释
5. 如果需要详细说明，可以分点列出

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。"""
    }
    system_prompt = style_prompts.get(ai_style, style_prompts['academic'])
    user_prompt = f"""学生问题：{question}

{f"上下文：{context}" if context else ""}
{f"参考资料：{knowledge_base}" if knowledge_base else ""}

请回答学生的问题。"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    return chat(messages)


def generate_assessment(
    course_title: str,
    topic: str,
    question_count: int = 5,
    knowledge_base: Optional[str] = None,
) -> str:
    """生成考核题目."""
    prompt = f"""你是一位专业的教育考试出题专家。请为以下课程生成{question_count}道高质量的选择题。

课程名称：{course_title}
考试主题：{topic}
题目数量：{question_count}道

【出题要求】
1. 题目必须紧扣"{topic}"主题，具有实际教学意义
2. 题干要清晰、准确、专业，避免歧义
3. 每道题提供4个选项（A、B、C、D），其中只有一个正确答案
4. 干扰项要具有迷惑性，但不能是正确答案
5. 解析要详细说明正确答案的原因，帮助学生理解
6. 难度适中，符合中级学习者水平

【返回格式】
必须严格返回以下JSON数组格式，不要包含任何其他文字：
[
  {{
    "question": "具体的题目内容？",
    "options": ["选项A的具体内容", "选项B的具体内容", "选项C的具体内容", "选项D的具体内容"],
    "correctAnswer": 0,
    "explanation": "详细解析为什么选这个答案",
    "type": "choice",
    "score": 10,
    "difficulty": "medium"
  }}
]

【注意事项】
- correctAnswer 是正确选项的索引，范围是 0-3（0表示第一个选项，3表示最后一个选项）
- type 固定为 "choice"
- score 默认为 10 分
- difficulty 可选值为 "easy"、"medium"、"hard"
- 确保每个选项都是完整、有意义的句子或短语"""

    if knowledge_base:
        prompt += f"\n\n【参考知识库】\n{knowledge_base[:2000]}"

    prompt += "\n\n请现在生成题目，只返回JSON数组："

    try:
        result = chat(prompt)
        return result
    except Exception as e:
        return json.dumps(
            [
                {
                    "question": f"关于{topic}的核心概念，以下说法正确的是？",
                    "options": [
                        f"{topic}是一种编程语言",
                        f"{topic}是一种数据结构",
                        f"{topic}是一种算法思想",
                        f"{topic}是一种设计模式"
                    ],
                    "correctAnswer": 2,
                    "explanation": f"{topic}是计算机科学中的重要概念，需要深入理解其原理和应用。",
                    "type": "choice",
                    "score": 10,
                    "difficulty": "medium"
                }
                for _ in range(question_count)
            ],
            ensure_ascii=False,
        )


def evaluate_practice(
    question: str,
    user_answer: str,
    correct_answer: str = "",
) -> str:
    """评测练习答案."""
    prompt = f"""请评测学生的练习答案。

题目：{question}
学生答案：{user_answer}
正确答案：{correct_answer if correct_answer else '无标准答案'}

请给出简短的评测意见（不超过100字），包括：
1. 答案是否正确
2. 如果错误，指出错误原因
3. 学习建议"""

    try:
        return chat(prompt)
    except Exception:
        return "评测完成，请继续加油！"


def analyze_mistake(
    question_content: str,
    user_answer: str,
    correct_answer: str,
    knowledge_tags: Optional[List[str]] = None,
    course_title: Optional[str] = None,
    explanation: Optional[str] = None,
) -> str:
    """分析错题原因，识别知识点漏洞，给出学习建议。"""
    if not is_configured():
        return f"""【系统提示】AI服务当前未配置，无法进行智能分析。

请在后端 .env 文件中配置以下参数后重试：
- SPARK_API_KEY：讯飞星火API密钥
- SPARK_API_SECRET：讯飞星火API密码

## 基础分析
- 题目涉及知识点：{"、".join(knowledge_tags) if knowledge_tags else "未知"}
- 你的答案：{user_answer}
- 正确答案：{correct_answer}

## 学习建议
1. 仔细对比你的答案与正确答案的差异
2. 复习相关知识点，理解解题思路
3. 多做类似题目巩固练习"""

    tags_str = "、".join(knowledge_tags) if knowledge_tags else "未知"
    course_info = f"\n所属课程：{course_title}" if course_title else ""
    explanation_section = f"\n【题目解析】\n{explanation}" if explanation else "\n【题目解析】\n暂无解析"

    prompt = f"""你是一位经验丰富的教育专家，擅长分析学生的错题原因并提供针对性的学习建议。

请分析以下错题：

【题目内容】
{question_content}
{course_info}

【学生的答案】
{user_answer}

【正确答案】
{correct_answer}
{explanation_section}

【相关知识点】
{tags_str}

请从以下几个方面进行详细分析：

## 一、错误原因分析
请深入分析学生为什么会做错这道题：
1. 是概念理解错误？计算失误？还是审题不清？
2. 具体的错误点在哪里？
3. 错误的思维过程是怎样的？

## 二、知识点漏洞识别
请识别学生可能存在的知识点漏洞：
1. 这道题涉及哪些核心知识点？
2. 学生在哪些知识点上可能存在理解偏差？
3. 是否有前置知识没有掌握好？

## 三、学习建议
请给出针对性的学习建议：
1. 如何正确理解这道题的解题思路？
2. 需要重点复习哪些知识点？
3. 有什么练习方法可以帮助巩固？
4. 如何避免类似错误？

请用清晰、易懂的语言进行分析，帮助学生真正理解错误原因并改进。"""

    try:
        return chat(prompt)
    except Exception as e:
        logger.error(f"错题分析失败: {e}")
        return f"分析过程中出现错误：{str(e)}\n\n请稍后重试，或检查AI服务配置是否正确。"


def analyze_mistake_stream(
    question_content: str,
    user_answer: str,
    correct_answer: str,
    knowledge_tags: Optional[List[str]] = None,
    course_title: Optional[str] = None,
    explanation: Optional[str] = None,
) -> Generator[str, None, None]:
    """流式分析错题原因。"""
    logger.info(f"[analyze_mistake_stream] 开始流式错题分析...")

    if not is_configured():
        logger.warning("[analyze_mistake_stream] Spark服务未配置，返回基础分析")
        yield "【系统提示】AI服务当前未配置，无法进行智能分析。\n\n请在后端 .env 文件中配置以下参数后重试：\n- SPARK_API_KEY：讯飞星火API密钥\n- SPARK_API_SECRET：讯飞星火API密码\n\n以下是基于题目信息的基础分析建议：\n\n"
        tags_str = "、".join(knowledge_tags) if knowledge_tags else "未知"
        yield f"## 错误原因分析\n"
        yield f"- 题目涉及知识点：{tags_str}\n"
        yield f"- 你的答案：{user_answer}\n"
        yield f"- 正确答案：{correct_answer}\n\n"
        yield f"## 学习建议\n"
        yield f"- 仔细对比你的答案与正确答案的差异\n"
        yield f"- 复习相关知识点，理解解题思路\n"
        yield f"- 多做类似题目巩固练习\n"
        return

    tags_str = "、".join(knowledge_tags) if knowledge_tags else "未知"
    course_info = f"\n所属课程：{course_title}" if course_title else ""
    explanation_section = f"\n【题目解析】\n{explanation}" if explanation else "\n【题目解析】\n暂无解析"

    prompt = f"""你是一位经验丰富的教育专家，擅长分析学生的错题原因并提供针对性的学习建议。

请分析以下错题：

【题目内容】
{question_content}
{course_info}

【学生的答案】
{user_answer}

【正确答案】
{correct_answer}
{explanation_section}

【相关知识点】
{tags_str}

请从以下几个方面进行详细分析：

## 一、错误原因分析
请深入分析学生为什么会做错这道题：
1. 是概念理解错误？计算失误？还是审题不清？
2. 具体的错误点在哪里？
3. 错误的思维过程是怎样的？

## 二、知识点漏洞识别
请识别学生可能存在的知识点漏洞：
1. 这道题涉及哪些核心知识点？
2. 学生在哪些知识点上可能存在理解偏差？
3. 是否有前置知识没有掌握好？

## 三、学习建议
请给出针对性的学习建议：
1. 如何正确理解这道题的解题思路？
2. 需要重点复习哪些知识点？
3. 有什么练习方法可以帮助巩固？
4. 如何避免类似错误？

请用清晰、易懂的语言进行分析，帮助学生真正理解错误原因并改进。"""

    try:
        logger.info(f"[analyze_mistake_stream] 调用chat_stream API...")
        chunk_count = 0
        for chunk in chat_stream(prompt):
            chunk_count += 1
            if chunk_count % 10 == 0:  # 每10个chunk记录一次日志
                logger.debug(f"[analyze_mistake_stream] 已生成 {chunk_count} 个数据块")
            yield chunk
        logger.info(f"[analyze_mistake_stream] 流式分析完成, 共 {chunk_count} 个数据块")
    except Exception as e:
        logger.error(f"[analyze_mistake_stream] 流式错题分析失败: {e}", exc_info=True)
        yield "\n\n【系统提示】分析过程中出现错误，部分内容可能不完整。请稍后重试。"


def analyze_mistakes_batch(
    mistakes: List[Dict[str, str]],
) -> str:
    """批量分析多个错题，生成综合学习建议。"""
    if not mistakes:
        return "没有错题需要分析。"
    
    mistakes_info = []
    for i, m in enumerate(mistakes, 1):
        mistakes_info.append(f"""
### 错题 {i}
题目：{m.get('question_content', '未知')}
学生答案：{m.get('user_answer', '未作答')}
正确答案：{m.get('correct_answer', '未知')}
知识点：{', '.join(m.get('knowledge_tags', [])) if m.get('knowledge_tags') else '未知'}
""")
    
    mistakes_text = "\n".join(mistakes_info)
    
    prompt = f"""你是一位经验丰富的教育专家，擅长分析学生的错题模式并提供综合学习建议。

以下是学生的多个错题记录：

{mistakes_text}

请进行综合分析：

## 一、整体错误模式分析
1. 学生在哪些类型的题目上容易出错？
2. 是否存在反复出现的错误类型？
3. 错误的主要原因是什么？（概念理解、计算、审题等）

## 二、知识点薄弱环节汇总
1. 学生最薄弱的知识点有哪些？
2. 这些知识点之间是否存在关联？
3. 哪些前置知识可能没有掌握好？

## 三、综合学习建议
1. 制定怎样的复习计划最有效？
2. 应该优先复习哪些知识点？
3. 推荐的学习资源和练习方法？
4. 如何系统性地提高？

## 四、后续学习路径
请给出一个具体的学习路径建议，帮助学生逐步提高。

请用清晰、有条理的语言进行分析，帮助学生制定有效的学习计划。"""

    try:
        return chat(prompt)
    except Exception as e:
        logger.error(f"批量错题分析失败: {e}")
        return "分析暂时不可用，请稍后再试。"


def summarize_note(
    note_title: str,
    note_content: str,
    course_title: Optional[str] = None,
) -> str:
    """生成笔记摘要"""
    import re
    clean_content = re.sub(r'<[^>]*>', '', note_content)[:2000] if len(note_content) > 2000 else re.sub(r'<[^>]*>', '', note_content)
    course_info = f"\n所属课程：{course_title}" if course_title else ""
    
    prompt = f"""请为以下学习笔记生成一个简洁的摘要。

【笔记标题】
{note_title}
{course_info}

【笔记内容】
{clean_content}

请生成摘要，要求：
1. 提取核心知识点和要点（3-5个要点）
2. 保留关键概念和重要结论
3. 简洁明了，不超过200字
4. 使用条目形式呈现，便于快速浏览

摘要格式：
**核心要点：**
• 要点1
• 要点2
• 要点3

**关键概念：**
概念1、概念2、概念3"""

    try:
        return chat(prompt)
    except Exception as e:
        logger.error(f"笔记摘要生成失败: {e}")
        return "摘要生成暂时不可用，请稍后再试。"


def summarize_note_stream(
    note_title: str,
    note_content: str,
    course_title: Optional[str] = None,
) -> Generator[str, None, None]:
    """流式生成笔记摘要"""
    import re
    clean_content = re.sub(r'<[^>]*>', '', note_content)[:2000] if len(note_content) > 2000 else re.sub(r'<[^>]*>', '', note_content)
    course_info = f"\n所属课程：{course_title}" if course_title else ""
    
    prompt = f"""请为以下学习笔记生成一个简洁的摘要。

【笔记标题】
{note_title}
{course_info}

【笔记内容】
{clean_content}

请生成摘要，要求：
1. 提取核心知识点和要点（3-5个要点）
2. 保留关键概念和重要结论
3. 简洁明了，不超过200字
4. 使用条目形式呈现，便于快速浏览

摘要格式：
**核心要点：**
• 要点1
• 要点2
• 要点3

**关键概念：**
概念1、概念2、概念3"""

    try:
        for chunk in chat_stream(prompt):
            yield chunk
    except Exception as e:
        logger.error(f"流式笔记摘要生成失败: {e}")
        yield "摘要生成暂时不可用，请稍后再试。"


def organize_notes(
    notes: List[Dict[str, str]],
) -> str:
    """整理多篇笔记，生成结构化复习文档"""
    if not notes:
        return "没有笔记需要整理。"
    
    notes_info = []
    for i, note in enumerate(notes, 1):
        notes_info.append(f"""
### 笔记 {i}：{note.get('title', '无标题')}
课程：{note.get('course_title', '未知')}
内容摘要：{note.get('content', '')[:500]}...
标签：{', '.join(note.get('tags', [])) if note.get('tags') else '无'}
""")
    
    notes_text = "\n".join(notes_info)
    
    prompt = f"""你是一位专业的学习顾问，擅长整理和结构化学习笔记。

以下是学生的多篇学习笔记：

{notes_text}

请将这些笔记整理成一份结构化的复习文档，要求：

## 一、知识框架梳理
1. 按主题或知识点分类整理笔记内容
2. 建立知识点之间的关联和层次结构
3. 标注重点和难点内容

## 二、核心概念汇总
1. 提取所有核心概念和定义
2. 列出重要公式、定理或方法
3. 标注需要记忆的关键内容

## 三、复习要点清单
1. 按优先级排列复习要点
2. 标注每个要点的掌握程度建议
3. 提供复习顺序建议

## 四、知识盲点提示
1. 识别可能存在的知识盲点
2. 建议需要补充学习的内容
3. 推荐相关学习资源

请用清晰、有条理的语言进行整理，帮助学生高效复习。"""

    try:
        return chat(prompt)
    except Exception as e:
        logger.error(f"笔记整理失败: {e}")
        return "整理暂时不可用，请稍后再试。"


def organize_notes_stream(
    notes: List[Dict[str, str]],
) -> Generator[str, None, None]:
    """流式整理多篇笔记"""
    if not notes:
        yield "没有笔记需要整理。"
        return
    
    notes_info = []
    for i, note in enumerate(notes, 1):
        notes_info.append(f"""
### 笔记 {i}：{note.get('title', '无标题')}
课程：{note.get('course_title', '未知')}
内容摘要：{note.get('content', '')[:500]}...
标签：{', '.join(note.get('tags', [])) if note.get('tags') else '无'}
""")
    
    notes_text = "\n".join(notes_info)
    
    prompt = f"""你是一位专业的学习顾问，擅长整理和结构化学习笔记。

以下是学生的多篇学习笔记：

{notes_text}

请将这些笔记整理成一份结构化的复习文档，要求：

## 一、知识框架梳理
1. 按主题或知识点分类整理笔记内容
2. 建立知识点之间的关联和层次结构
3. 标注重点和难点内容

## 二、核心概念汇总
1. 提取所有核心概念和定义
2. 列出重要公式、定理或方法
3. 标注需要记忆的关键内容

## 三、复习要点清单
1. 按优先级排列复习要点
2. 标注每个要点的掌握程度建议
3. 提供复习顺序建议

## 四、知识盲点提示
1. 识别可能存在的知识盲点
2. 建议需要补充学习的内容
3. 推荐相关学习资源

请用清晰、有条理的语言进行整理，帮助学生高效复习。"""

    try:
        for chunk in chat_stream(prompt):
            yield chunk
    except Exception as e:
        logger.error(f"流式笔记整理失败: {e}")
        yield "整理暂时不可用，请稍后再试。"


def recommend_tags(
    note_title: str,
    note_content: str,
    existing_tags: Optional[List[str]] = None,
) -> str:
    """基于笔记内容推荐标签"""
    import re
    clean_content = re.sub(r'<[^>]*>', '', note_content)[:1000] if len(note_content) > 1000 else re.sub(r'<[^>]*>', '', note_content)
    existing_tags_str = "、".join(existing_tags) if existing_tags else "无"
    
    prompt = f"""请分析以下学习笔记，推荐合适的标签。

【笔记标题】
{note_title}

【笔记内容】
{clean_content}

【已有标签】
{existing_tags_str}

请推荐3-5个合适的标签，要求：
1. 标签应反映笔记的核心主题和知识点
2. 优先使用已有标签（如果相关）
3. 标签应简洁明了，便于分类和搜索
4. 可以包含：主题标签（如"数据结构"）、类型标签（如"重点"、"难点"）、状态标签（如"待复习"）

请直接返回标签列表，用逗号分隔，格式如下：
标签1, 标签2, 标签3, 标签4, 标签5"""

    try:
        return chat(prompt)
    except Exception as e:
        logger.error(f"标签推荐失败: {e}")
        return "推荐暂时不可用"


def generate_weekly_report(
    notes: List[Dict[str, str]],
    mistakes: List[Dict[str, str]],
    week_start: Optional[str] = None,
    week_end: Optional[str] = None,
) -> str:
    """生成周学习报告"""
    notes_summary = []
    for note in notes[:10]:
        notes_summary.append(f"- {note.get('title', '无标题')} ({note.get('course_title', '未知课程')})")
    
    mistakes_summary = []
    for m in mistakes[:10]:
        mistakes_summary.append(f"- {m.get('question_content', '未知题目')[:100]}... (错误{m.get('mistake_count', 1)}次)")
    
    week_info = ""
    if week_start and week_end:
        week_info = f"\n报告周期：{week_start} 至 {week_end}"
    
    prompt = f"""你是一位专业的学习顾问，请根据学生的学习数据生成周学习报告。
{week_info}

【本周学习笔记】（共{len(notes)}篇）
{chr(10).join(notes_summary) if notes_summary else '本周无笔记记录'}

【本周错题记录】（共{len(mistakes)}道）
{chr(10).join(mistakes_summary) if mistakes_summary else '本周无错题记录'}

请生成一份详细的周学习报告，包含以下内容：

## 一、本周学习概况
1. 学习内容概述
2. 学习投入分析
3. 学习进度评估

## 二、知识掌握情况
1. 已掌握的知识点
2. 需要加强的知识点
3. 知识薄弱环节分析

## 三、错题分析总结
1. 错题类型分布
2. 主要错误原因
3. 需要重点关注的知识点

## 四、下周学习建议
1. 重点复习内容
2. 建议学习路径
3. 具体行动计划

## 五、学习小贴士
针对本周学习情况，给出2-3个个性化的学习建议。

请用鼓励性的语言，帮助学生建立学习信心，同时给出切实可行的建议。"""

    try:
        return chat(prompt)
    except Exception as e:
        logger.error(f"周报告生成失败: {e}")
        return "报告生成暂时不可用，请稍后再试。"


def generate_weekly_report_stream(
    notes: List[Dict[str, str]],
    mistakes: List[Dict[str, str]],
    week_start: Optional[str] = None,
    week_end: Optional[str] = None,
) -> Generator[str, None, None]:
    """流式生成周学习报告"""
    notes_summary = []
    for note in notes[:10]:
        notes_summary.append(f"- {note.get('title', '无标题')} ({note.get('course_title', '未知课程')})")
    
    mistakes_summary = []
    for m in mistakes[:10]:
        mistakes_summary.append(f"- {m.get('question_content', '未知题目')[:100]}... (错误{m.get('mistake_count', 1)}次)")
    
    week_info = ""
    if week_start and week_end:
        week_info = f"\n报告周期：{week_start} 至 {week_end}"
    
    prompt = f"""你是一位专业的学习顾问，请根据学生的学习数据生成周学习报告。
{week_info}

【本周学习笔记】（共{len(notes)}篇）
{chr(10).join(notes_summary) if notes_summary else '本周无笔记记录'}

【本周错题记录】（共{len(mistakes)}道）
{chr(10).join(mistakes_summary) if mistakes_summary else '本周无错题记录'}

请生成一份详细的周学习报告，包含以下内容：

## 一、本周学习概况
1. 学习内容概述
2. 学习投入分析
3. 学习进度评估

## 二、知识掌握情况
1. 已掌握的知识点
2. 需要加强的知识点
3. 知识薄弱环节分析

## 三、错题分析总结
1. 错题类型分布
2. 主要错误原因
3. 需要重点关注的知识点

## 四、下周学习建议
1. 重点复习内容
2. 建议学习路径
3. 具体行动计划

## 五、学习小贴士
针对本周学习情况，给出2-3个个性化的学习建议。

请用鼓励性的语言，帮助学生建立学习信心，同时给出切实可行的建议。"""

    try:
        for chunk in chat_stream(prompt):
            yield chunk
    except Exception as e:
        logger.error(f"流式周报告生成失败: {e}")
        yield "报告生成暂时不可用，请稍后再试。"


class _SparkServiceSingleton:
    def is_configured(self):
        return is_configured()

    def chat(self, messages: Union[str, List[Dict[str, str]]]) -> str:
        return chat(messages)

    def chat_stream(self, messages: Union[str, List[Dict[str, str]]]):
        return chat_stream(messages)

    def generate_teaching_content(
        self,
        course_title: str,
        topic: str,
        knowledge_base: Optional[str] = None,
    ) -> str:
        return generate_teaching_content(course_title, topic, knowledge_base)

    def ai_tutor_chat(
        self,
        question: str,
        context: str = "",
        knowledge_base: str = "",
        ai_style: str = "academic",
    ) -> str:
        return ai_tutor_chat(question, context, knowledge_base, ai_style)

    def generate_assessment(
        self,
        course_title: str,
        topic: str,
        question_count: int = 5,
        knowledge_base: Optional[str] = None,
    ) -> str:
        return generate_assessment(course_title, topic, question_count, knowledge_base)

    def evaluate_practice(
        self,
        question: str,
        user_answer: str,
        correct_answer: str = "",
    ) -> str:
        return evaluate_practice(question, user_answer, correct_answer)

    def analyze_mistake(
        self,
        question_content: str,
        user_answer: str,
        correct_answer: str,
        knowledge_tags: Optional[List[str]] = None,
        course_title: Optional[str] = None,
        explanation: Optional[str] = None,
    ) -> str:
        return analyze_mistake(
            question_content, user_answer, correct_answer, knowledge_tags, course_title, explanation
        )

    def analyze_mistake_stream(
        self,
        question_content: str,
        user_answer: str,
        correct_answer: str,
        knowledge_tags: Optional[List[str]] = None,
        course_title: Optional[str] = None,
        explanation: Optional[str] = None,
    ):
        return analyze_mistake_stream(
            question_content, user_answer, correct_answer, knowledge_tags, course_title, explanation
        )

    def analyze_mistakes_batch(
        self,
        mistakes: List[Dict[str, str]],
    ) -> str:
        return analyze_mistakes_batch(mistakes)

    def summarize_note(
        self,
        note_title: str,
        note_content: str,
        course_title: Optional[str] = None,
    ) -> str:
        return summarize_note(note_title, note_content, course_title)

    def summarize_note_stream(
        self,
        note_title: str,
        note_content: str,
        course_title: Optional[str] = None,
    ):
        return summarize_note_stream(note_title, note_content, course_title)

    def organize_notes(
        self,
        notes: List[Dict[str, str]],
    ) -> str:
        return organize_notes(notes)

    def organize_notes_stream(
        self,
        notes: List[Dict[str, str]],
    ):
        return organize_notes_stream(notes)

    def recommend_tags(
        self,
        note_title: str,
        note_content: str,
        existing_tags: Optional[List[str]] = None,
    ) -> str:
        return recommend_tags(note_title, note_content, existing_tags)

    def generate_weekly_report(
        self,
        notes: List[Dict[str, str]],
        mistakes: List[Dict[str, str]],
        week_start: Optional[str] = None,
        week_end: Optional[str] = None,
    ) -> str:
        return generate_weekly_report(notes, mistakes, week_start, week_end)

    def generate_weekly_report_stream(
        self,
        notes: List[Dict[str, str]],
        mistakes: List[Dict[str, str]],
        week_start: Optional[str] = None,
        week_end: Optional[str] = None,
    ):
        return generate_weekly_report_stream(notes, mistakes, week_start, week_end)


spark_service = _SparkServiceSingleton()
