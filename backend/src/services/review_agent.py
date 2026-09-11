"""Deterministic and model-assisted review for generated resource packages.

This module is deliberately side-effect free.  A caller decides when a reviewed
package is persisted or submitted for human/content review.
"""

import json
import ipaddress
import logging
import re
import socket
from copy import deepcopy
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = {
    "document": ("title", "content"),
    "mindmap": ("title", "content"),
    "layered_exercise": ("title", "questions"),
    "exercise": ("title", "questions"),
    "recommendation": ("title", "content"),
    "media": ("title", "script"),
    "project": ("title", "steps", "acceptance_criteria"),
    "ppt": ("title", "slides"),
}

URL_FIELDS = ("url", "source_url", "download_url", "file_url", "ppt_url")


def _items(value):
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [value]
    return []


def _content_text(item):
    parts = []
    for key in ("content", "definition", "description", "background", "analysis", "solution", "script"):
        value = item.get(key)
        if isinstance(value, str):
            parts.append(value)
        elif isinstance(value, (list, dict)):
            parts.append(json.dumps(value, ensure_ascii=False))
    return "\n".join(parts)


def check_package_structure(resources, requirements=None):
    """Return hard checks for the package without calling an external model."""
    requirements = requirements or {}
    checks = []
    missing = []
    resource_types = requirements.get("resource_types") or list(resources or {})
    knowledge_points = [str(item).strip() for item in requirements.get("knowledge_points", []) if str(item).strip()]

    for resource_type in resource_types:
        value = (resources or {}).get(resource_type)
        items = _items(value)
        check = {"resource_type": resource_type, "status": "passed", "issues": [], "item_count": len(items)}
        if not items:
            check["status"] = "failed"
            check["issues"].append("没有生成资源内容")
        fields = REQUIRED_FIELDS.get(resource_type, ("title",))
        for index, item in enumerate(items):
            for field in fields:
                current = item.get(field)
                if current is None or current == "" or current == [] or current == {}:
                    check["status"] = "failed"
                    issue = f"第{index + 1}项缺少{field}"
                    check["issues"].append(issue)
                    missing.append({"resource_type": resource_type, "index": index, "field": field})
            text = _content_text(item)
            if re.search(r"待补充|TODO|FIXME|placeholder|占位", text, re.IGNORECASE):
                check["status"] = "failed"
                check["issues"].append(f"第{index + 1}项包含占位内容")
        if knowledge_points and items:
            joined = json.dumps(items, ensure_ascii=False).lower()
            if not any(point.lower() in joined for point in knowledge_points):
                check["status"] = "failed"
                check["issues"].append("没有发现本次方案要求覆盖的知识点")
        checks.append(check)

    passed = all(item["status"] == "passed" for item in checks)
    return {"passed": passed, "checks": checks, "missing": missing}


def repair_package_structure(resources, requirements=None):
    """Fill only predictable structural omissions; never invent external sources."""
    requirements = requirements or {}
    repaired = deepcopy(resources or {})
    changes = []
    for resource_type in requirements.get("resource_types") or list(repaired):
        value = repaired.get(resource_type)
        if not value:
            continue
        for index, item in enumerate(_items(value)):
            title = item.get("title") or f"{requirements.get('topic', '课程')}·{resource_type}"
            if not item.get("title"):
                item["title"] = title
                changes.append(f"{resource_type}[{index}].title")
            fields = REQUIRED_FIELDS.get(resource_type, ("title",))
            for field in fields:
                if item.get(field) not in (None, "", [], {}):
                    continue
                if field == "content":
                    item[field] = f"围绕{requirements.get('topic', '本课主题')}的结构化讲解。"
                elif field == "questions":
                    item[field] = [{"question": f"请解释{requirements.get('topic', '本课主题')}的核心概念。", "answer": "请结合知识点作答。", "explanation": "用于检查基础理解。"}]
                elif field == "script":
                    item[field] = [{"scene": "概念讲解", "voiceover": f"介绍{requirements.get('topic', '本课主题')}。"}]
                elif field == "steps":
                    item[field] = ["理解任务目标", "完成基础实现", "运行并检查结果"]
                elif field == "acceptance_criteria":
                    item[field] = ["能够运行", "结果符合题目要求", "能够说明关键步骤"]
                elif field == "slides":
                    item[field] = [{"title": title, "content": [requirements.get("topic", "课程主题")]}]
                else:
                    item[field] = "请根据课程知识点补充。"
                changes.append(f"{resource_type}[{index}].{field}")
    return repaired, changes


def _public_http_url(url):
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False, "地址格式不正确"
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
        for address in addresses:
            ip = ipaddress.ip_address(address[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False, "不允许访问本机或内网地址"
        return True, ""
    except (OSError, ValueError):
        return False, "域名无法解析"


def validate_external_resources(resources, timeout=4):
    """Check external URLs without blocking otherwise usable local content."""
    checked = deepcopy(resources or {})
    results = []
    for resource_type, value in checked.items():
        for index, item in enumerate(_items(value)):
            for field in URL_FIELDS:
                url = item.get(field)
                if not isinstance(url, str) or not url.strip():
                    continue
                allowed, reason = _public_http_url(url.strip())
                available = False
                status_code = None
                if allowed:
                    try:
                        response = requests.head(url, timeout=timeout, allow_redirects=True)
                        status_code = response.status_code
                        if response.status_code in (405, 501):
                            response = requests.get(url, timeout=timeout, allow_redirects=True, stream=True)
                            status_code = response.status_code
                        available = 200 <= status_code < 400
                        if not available:
                            reason = f"外部服务返回状态码{status_code}"
                    except requests.RequestException:
                        reason = "外部内容连接超时或无法访问"
                result = {
                    "resource_type": resource_type,
                    "item_index": index,
                    "field": field,
                    "url": url,
                    "available": available,
                    "status_code": status_code,
                    "message": "外部内容可用" if available else f"外部内容暂不可用：{reason}",
                }
                results.append(result)
                item["external_available"] = available
                item["external_status"] = result["message"]
    return checked, results


class ReviewAgent:
    """ReviewAgent with deterministic hard checks and optional Spark semantics."""

    name = "ReviewAgent"

    def __init__(self, spark=None, max_rounds=2):
        self.spark = spark
        self.max_rounds = max_rounds

    def _semantic_review(self, resources, requirements, user_id=None, user_role=None):
        if not self.spark or not self.spark.is_configured():
            return {"available": False, "score": None, "passed": True, "issues": [], "label": "规则审核"}
        prompt = f"""你是课程资源审核智能体。只返回JSON，不要Markdown。
课程主题：{requirements.get('topic', '')}
知识点：{json.dumps(requirements.get('knowledge_points', []), ensure_ascii=False)}
学习方案：{json.dumps(requirements.get('strategy', {}), ensure_ascii=False)[:4000]}
资源内容：{json.dumps(resources, ensure_ascii=False)[:12000]}
请检查知识点覆盖、难度匹配、学习顺序和学生方案适配，返回：
{{"score": 0到100的数字, "passed": true或false, "issues": ["具体问题"], "suggestions": ["可执行修改"]}}"""
        try:
            raw = self.spark.chat(prompt, user_id=user_id, user_role=user_role)
            clean = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.IGNORECASE).strip()
            result = json.loads(clean)
            score = float(result.get("score", 0))
            return {
                "available": True,
                "score": max(0, min(100, score)),
                "passed": bool(result.get("passed")) and score >= 80,
                "issues": result.get("issues") or [],
                "suggestions": result.get("suggestions") or [],
                "label": "AI语义审核",
            }
        except Exception as exc:
            logger.warning("ReviewAgent semantic review unavailable: %s", exc)
            return {"available": False, "score": None, "passed": True, "issues": [], "label": "规则审核（AI语义审核暂不可用）"}

    def _semantic_repair(self, resources, requirements, semantic, user_id=None, user_role=None):
        if not semantic.get("available") or not self.spark or not self.spark.is_configured():
            return resources, []
        prompt = f"""你是课程资源修复智能体。根据审核问题修改资源，只返回完整JSON对象，不要Markdown。
课程主题：{requirements.get('topic', '')}
必须覆盖的知识点：{json.dumps(requirements.get('knowledge_points', []), ensure_ascii=False)}
已确认学习方案：{json.dumps(requirements.get('strategy', {}), ensure_ascii=False)[:4000]}
审核问题：{json.dumps(semantic.get('issues', []), ensure_ascii=False)}
修改建议：{json.dumps(semantic.get('suggestions', []), ensure_ascii=False)}
原资源包：{json.dumps(resources, ensure_ascii=False)[:12000]}
保持原有资源类型和正确内容，只修复指出的问题。"""
        try:
            raw = self.spark.chat(prompt, user_id=user_id, user_role=user_role)
            clean = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.IGNORECASE).strip()
            repaired = json.loads(clean)
            if isinstance(repaired, dict):
                if isinstance(repaired.get("resources"), dict):
                    repaired = repaired["resources"]
                return repaired, ["ReviewAgent根据语义审核意见修复资源"]
        except Exception as exc:
            logger.warning("ReviewAgent semantic repair unavailable: %s", exc)
        return resources, []

    def review_and_repair(self, resources, requirements, user_id=None, user_role=None):
        current = deepcopy(resources or {})
        rounds = []
        for round_number in range(self.max_rounds + 1):
            structure = check_package_structure(current, requirements)
            semantic = self._semantic_review(current, requirements, user_id, user_role)
            hard_passed = structure["passed"]
            semantic_passed = semantic["passed"]
            round_result = {
                "round": round_number,
                "structure": structure,
                "semantic": semantic,
                "passed": hard_passed and semantic_passed,
                "changes": [],
            }
            rounds.append(round_result)
            if round_result["passed"] or round_number >= self.max_rounds:
                break
            current, changes = repair_package_structure(current, requirements)
            if semantic.get("available") and not semantic_passed:
                current, semantic_changes = self._semantic_repair(
                    current, requirements, semantic, user_id, user_role
                )
                changes.extend(semantic_changes)
            round_result["changes"] = changes

        last = rounds[-1]
        return {
            "resources": current,
            "passed": bool(last["passed"]),
            "can_submit": bool(last["passed"]),
            "needs_teacher_attention": not bool(last["passed"]),
            "rounds": rounds,
            "round_count": len(rounds),
            "agent": self.name,
            "summary": "审核通过" if last["passed"] else "内容结构已检查，但仍有项目需要教师确认",
        }
