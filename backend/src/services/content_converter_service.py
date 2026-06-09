import json
import logging
import re

logger = logging.getLogger(__name__)


class ContentConverterService:

    def convert(self, content_type, raw_content, topic="", options=None):
        options = options or {}
        converters = {
            "mindmap": self.convert_mindmap,
            "project": self.convert_code_practical,
            "document": self.convert_document,
            "recommendation": self.convert_recommendation,
        }
        converter = converters.get(content_type)
        if not converter:
            return raw_content
        try:
            result = converter(raw_content, topic=topic, options=options)
            if content_type == "mindmap":
                result = self._validate_mindmap_schema(result, topic)
            return result
        except Exception as e:
            logger.error(f"Content conversion failed for type {content_type}: {e}")
            return raw_content

    def _validate_mindmap_schema(self, result, topic=""):
        if not isinstance(result, dict):
            return {"root": {"name": topic or "知识结构", "description": "", "is_core": True, "relationship_type": None, "children": []}}

        if "root" not in result:
            return {"root": {"name": topic or "知识结构", "description": "", "is_core": True, "relationship_type": None, "children": []}}

        root = result["root"]
        if not isinstance(root, dict):
            return {"root": {"name": topic or "知识结构", "description": "", "is_core": True, "relationship_type": None, "children": []}}

        root["name"] = root.get("name") or topic or "知识结构"
        if not root.get("description"):
            root["description"] = f"{root['name']}的知识体系"
        root["is_core"] = True
        root["relationship_type"] = None

        if not isinstance(root.get("children"), list):
            root["children"] = []

        self._validate_mindmap_children(root["children"])

        return {"root": root}

    def _validate_mindmap_children(self, children):
        if not isinstance(children, list):
            return
        for i, child in enumerate(children):
            if not isinstance(child, dict):
                children[i] = {"name": str(child), "description": "", "is_core": False, "relationship_type": "包含", "children": []}
                continue
            child["name"] = child.get("name") or f"节点{i + 1}"
            if not child.get("description"):
                child["description"] = ""
            if "is_core" not in child:
                child["is_core"] = False
            if "relationship_type" not in child:
                child["relationship_type"] = "包含"
            if not isinstance(child.get("children"), list):
                child["children"] = []
            self._validate_mindmap_children(child["children"])

    def convert_mindmap(self, raw_content, topic="", options=None):
        options = options or {}
        data = self._ensure_dict(raw_content)

        if data.get("parse_error") and data.get("raw_response"):
            json_data = self._try_extract_json(data["raw_response"])
            if json_data:
                if json_data.get("mindmap"):
                    json_data = json_data["mindmap"]
                if json_data.get("root"):
                    root = self._normalize_mindmap_node(json_data["root"], topic)
                    return {"root": root}
            root = self._build_mindmap_from_raw_text(data["raw_response"], topic)
            return {"root": root}

        if data.get("mindmap"):
            data = data["mindmap"]

        root = data.get("root")
        if root:
            root = self._normalize_mindmap_node(root, topic)
            return {"root": root}

        if data.get("nodes") or data.get("children"):
            node = self._normalize_mindmap_node(data, topic)
            return {"root": node}

        if data.get("sections") or data.get("chapters"):
            root = self._build_mindmap_from_document(data, topic)
            return {"root": root}

        if data.get("tasks") or data.get("project_title"):
            root = self._build_mindmap_from_project(data, topic)
            return {"root": root}

        root = self._build_mindmap_from_generic(data, topic)
        return {"root": root}

    def _normalize_mindmap_node(self, node, fallback_name=""):
        if not isinstance(node, dict):
            return {
                "name": str(node) if node else fallback_name,
                "description": "",
                "is_core": False,
                "relationship_type": "包含",
                "children": [],
            }

        name = (
            node.get("name")
            or node.get("title")
            or node.get("label")
            or node.get("text")
            or fallback_name
        )
        description = (
            node.get("description")
            or node.get("summary")
            or node.get("content")
            or node.get("detail")
            or ""
        )
        if isinstance(description, str) and len(description) > 200:
            description = description[:200] + "..."

        is_core = node.get("is_core", False)
        if not is_core:
            importance = node.get("importance", "")
            is_core = importance in ("core", "核心", "high", "重要")

        rel_type = (
            node.get("relationship_type")
            or node.get("relation")
            or node.get("link_type")
            or "包含"
        )

        children = []
        raw_children = (
            node.get("children")
            or node.get("subtopics")
            or node.get("branches")
            or node.get("items")
            or []
        )
        if isinstance(raw_children, list):
            for child in raw_children:
                if isinstance(child, dict):
                    children.append(self._normalize_mindmap_node(child))
                elif isinstance(child, str) and child.strip():
                    children.append({
                        "name": child.strip(),
                        "description": "",
                        "is_core": False,
                        "relationship_type": "包含",
                        "children": [],
                    })

        return {
            "name": name,
            "description": description,
            "is_core": is_core,
            "relationship_type": rel_type,
            "children": children,
        }

    def _build_mindmap_from_document(self, data, topic):
        root_name = (
            data.get("title")
            or data.get("document", {}).get("title")
            or topic
            or "知识结构"
        )
        root = {
            "name": root_name,
            "description": data.get("summary", ""),
            "is_core": True,
            "relationship_type": None,
            "children": [],
        }

        sections = data.get("sections") or data.get("chapters") or []
        for sec in sections:
            if not isinstance(sec, dict):
                continue
            sec_name = sec.get("title") or sec.get("section_title") or "未命名章节"
            sec_desc = sec.get("content") or sec.get("summary") or ""
            if isinstance(sec_desc, str) and len(sec_desc) > 150:
                sec_desc = sec_desc[:150] + "..."

            sec_node = {
                "name": sec_name,
                "description": sec_desc,
                "is_core": True,
                "relationship_type": "包含",
                "children": [],
            }

            key_points = sec.get("key_points") or sec.get("key_concepts") or []
            for kp in key_points:
                if isinstance(kp, str):
                    sec_node["children"].append({
                        "name": kp,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
                elif isinstance(kp, dict):
                    sec_node["children"].append(self._normalize_mindmap_node(kp))

            examples = sec.get("examples") or []
            for ex in examples:
                ex_name = ex.get("title", "示例") if isinstance(ex, dict) else str(ex)
                sec_node["children"].append({
                    "name": ex_name,
                    "description": "示例" if isinstance(ex, dict) else "",
                    "is_core": False,
                    "relationship_type": "递进",
                    "children": [],
                })

            common_mistakes = sec.get("common_mistakes") or []
            for cm in common_mistakes:
                sec_node["children"].append({
                    "name": str(cm) if not isinstance(cm, dict) else cm.get("title", "常见误区"),
                    "description": "常见误区",
                    "is_core": False,
                    "relationship_type": "因果",
                    "children": [],
                })

            root["children"].append(sec_node)

        glossary = data.get("glossary") or []
        if glossary:
            glossary_node = {
                "name": "术语表",
                "description": "核心术语定义",
                "is_core": False,
                "relationship_type": "包含",
                "children": [],
            }
            for item in glossary:
                if isinstance(item, dict):
                    glossary_node["children"].append({
                        "name": item.get("term", ""),
                        "description": item.get("definition", ""),
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
                elif isinstance(item, str):
                    glossary_node["children"].append({
                        "name": item,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
            root["children"].append(glossary_node)

        return root

    def _build_mindmap_from_project(self, data, topic):
        root_name = (
            data.get("project_title")
            or data.get("title")
            or topic
            or "项目结构"
        )
        root = {
            "name": root_name,
            "description": data.get("project_description") or data.get("description") or "",
            "is_core": True,
            "relationship_type": None,
            "children": [],
        }

        objectives = data.get("learning_objectives") or data.get("prerequisites") or []
        if objectives:
            obj_node = {
                "name": "学习目标",
                "description": "项目学习目标",
                "is_core": True,
                "relationship_type": "包含",
                "children": [],
            }
            for obj in objectives:
                obj_node["children"].append({
                    "name": str(obj),
                    "description": "",
                    "is_core": False,
                    "relationship_type": "并列",
                    "children": [],
                })
            root["children"].append(obj_node)

        tasks = data.get("tasks") or []
        if tasks:
            tasks_node = {
                "name": "任务分解",
                "description": f"共{len(tasks)}个子任务",
                "is_core": True,
                "relationship_type": "包含",
                "children": [],
            }
            for idx, task in enumerate(tasks):
                if not isinstance(task, dict):
                    continue
                task_name = task.get("title") or f"任务{idx + 1}"
                task_desc = task.get("description") or ""
                if isinstance(task_desc, str) and len(task_desc) > 150:
                    task_desc = task_desc[:150] + "..."

                task_node = {
                    "name": task_name,
                    "description": task_desc,
                    "is_core": False,
                    "relationship_type": "递进",
                    "children": [],
                }

                steps = task.get("steps") or []
                if isinstance(steps, list):
                    for step in steps:
                        if isinstance(step, dict):
                            task_node["children"].append({
                                "name": step.get("instruction") or step.get("step", ""),
                                "description": step.get("hint", ""),
                                "is_core": False,
                                "relationship_type": "递进",
                                "children": [],
                            })
                        elif isinstance(step, str):
                            task_node["children"].append({
                                "name": step,
                                "description": "",
                                "is_core": False,
                                "relationship_type": "递进",
                                "children": [],
                            })

                tasks_node["children"].append(task_node)
            root["children"].append(tasks_node)

        scoring = data.get("scoring_criteria") or data.get("rubric")
        if scoring:
            scoring_node = {
                "name": "评分标准",
                "description": "项目评分细则",
                "is_core": False,
                "relationship_type": "包含",
                "children": [],
            }
            if isinstance(scoring, list):
                for item in scoring:
                    if isinstance(item, dict):
                        scoring_node["children"].append({
                            "name": item.get("item") or item.get("criterion", ""),
                            "description": item.get("description", ""),
                            "is_core": False,
                            "relationship_type": "并列",
                            "children": [],
                        })
            elif isinstance(scoring, dict):
                for key, val in scoring.items():
                    scoring_node["children"].append({
                        "name": key,
                        "description": str(val) if isinstance(val, str) else "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
            root["children"].append(scoring_node)

        return root

    def _build_mindmap_from_generic(self, data, topic):
        root_name = data.get("title") or data.get("name") or topic or "知识结构"
        root = {
            "name": root_name,
            "description": data.get("description") or data.get("summary") or "",
            "is_core": True,
            "relationship_type": None,
            "children": [],
        }

        skip_keys = {"title", "name", "description", "summary", "raw_response", "parse_error"}
        for key, value in data.items():
            if key in skip_keys:
                continue
            if isinstance(value, list) and value:
                child_node = {
                    "name": self._humanize_key(key),
                    "description": f"{len(value)}项",
                    "is_core": False,
                    "relationship_type": "包含",
                    "children": [],
                }
                for item in value[:10]:
                    if isinstance(item, dict):
                        item_name = item.get("title") or item.get("name") or item.get("term", "")
                        item_desc = item.get("description") or item.get("definition") or ""
                        if item_name:
                            child_node["children"].append({
                                "name": item_name,
                                "description": item_desc[:150] if isinstance(item_desc, str) else "",
                                "is_core": False,
                                "relationship_type": "并列",
                                "children": [],
                            })
                    elif isinstance(item, str) and item.strip():
                        child_node["children"].append({
                            "name": item.strip()[:50],
                            "description": "",
                            "is_core": False,
                            "relationship_type": "并列",
                            "children": [],
                        })
                if child_node["children"]:
                    root["children"].append(child_node)
            elif isinstance(value, dict) and value:
                child_node = {
                    "name": self._humanize_key(key),
                    "description": "",
                    "is_core": False,
                    "relationship_type": "包含",
                    "children": [],
                }
                for sub_key, sub_val in list(value.items())[:8]:
                    child_node["children"].append({
                        "name": str(sub_key),
                        "description": str(sub_val)[:100] if not isinstance(sub_val, (dict, list)) else "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
                root["children"].append(child_node)

        return root

    def convert_code_practical(self, raw_content, topic="", options=None):
        options = options or {}
        data = self._ensure_dict(raw_content)

        if data.get("project"):
            data = data["project"]

        language = (
            options.get("programming_language")
            or data.get("programming_language")
            or data.get("language")
            or "python"
        )
        language = self._normalize_language(language)

        tasks = data.get("tasks") or []
        normalized_tasks = []
        for idx, task in enumerate(tasks):
            if not isinstance(task, dict):
                continue
            normalized_tasks.append(self._normalize_code_task(task, idx, language))

        full_code = self._extract_full_code(data)
        if full_code:
            full_code = self._ensure_code_quality(full_code, language)

        starter_code = data.get("starter_code") or ""
        if starter_code:
            starter_code = self._ensure_code_quality(starter_code, language)

        reference_solution = data.get("reference_solution") or ""
        if reference_solution and not full_code:
            reference_solution = self._ensure_code_quality(reference_solution, language)

        scoring_criteria = data.get("scoring_criteria") or data.get("rubric") or []
        if isinstance(scoring_criteria, dict):
            scoring_criteria = self._normalize_rubric(scoring_criteria)

        result = {
            "project_title": data.get("project_title") or data.get("title") or topic or "代码实操案例",
            "project_description": data.get("project_description") or data.get("description") or "",
            "difficulty": data.get("difficulty") or "intermediate",
            "programming_language": language,
            "estimated_time": data.get("estimated_time") or data.get("estimated_hours", ""),
            "prerequisites": data.get("prerequisites") or data.get("knowledge_points_covered") or [],
            "learning_objectives": data.get("learning_objectives") or [],
            "tasks": normalized_tasks,
            "full_code": full_code or reference_solution,
            "starter_code": starter_code,
            "scoring_criteria": scoring_criteria,
            "extension_challenges": data.get("extension_challenges") or [],
        }

        return result

    def _normalize_code_task(self, task, index, language):
        task_id = task.get("task_id") or index + 1
        title = task.get("title") or f"任务{index + 1}"
        description = task.get("description") or ""

        steps = task.get("steps") or []
        normalized_steps = []
        for step in steps:
            if isinstance(step, dict):
                normalized_steps.append({
                    "instruction": step.get("instruction") or step.get("step", ""),
                    "hint": step.get("hint", ""),
                    "expected_output": step.get("expected_output") or step.get("expected_output_description", ""),
                })
            elif isinstance(step, str):
                normalized_steps.append({
                    "instruction": step,
                    "hint": "",
                    "expected_output": "",
                })

        code_template = task.get("code_template") or ""
        if code_template:
            code_template = self._ensure_code_quality(code_template, language)

        reference_solution = task.get("reference_solution") or ""
        if reference_solution:
            reference_solution = self._ensure_code_quality(reference_solution, language)

        hints = task.get("hints") or []
        if isinstance(hints, str):
            hints = [hints]

        return {
            "task_id": task_id,
            "title": title,
            "description": description,
            "steps": normalized_steps,
            "code_template": code_template,
            "reference_solution": reference_solution,
            "expected_output": task.get("expected_output") or "",
            "hints": hints,
            "deliverable": task.get("deliverable") or "",
        }

    def _extract_full_code(self, data):
        full_code = data.get("full_code") or ""
        if full_code:
            return full_code

        tasks = data.get("tasks") or []
        code_parts = []
        for task in tasks:
            if not isinstance(task, dict):
                continue
            ref = task.get("reference_solution") or ""
            if ref and ref.strip():
                code_parts.append(ref.strip())

        if code_parts:
            return "\n\n# " + "=" * 40 + "\n\n".join(code_parts)

        return ""

    def _ensure_code_quality(self, code, language):
        if not code or not isinstance(code, str):
            return code

        code = code.strip()

        if code.startswith("```"):
            lines = code.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            code = "\n".join(lines)

        if language == "python":
            code = self._ensure_python_imports(code)
        elif language in ("javascript", "js"):
            code = self._ensure_js_imports(code)
        elif language == "java":
            code = self._ensure_java_structure(code)

        return code

    def _ensure_python_imports(self, code):
        common_patterns = {
            "numpy": r"\bnp\.",
            "pandas": r"\bpd\.",
            "matplotlib.pyplot": r"\bplt\.",
            "sklearn": r"\bsklearn\b",
            "requests": r"\brequests\.",
            "json": r"\bjson\.",
            "os": r"\bos\.",
            "sys": r"\bsys\.",
            "re": r"\bre\.",
            "collections": r"\bcollections\.",
            "datetime": r"\bdatetime\b",
            "math": r"\bmath\.",
            "random": r"\brandom\.",
            "typing": r"\btyping\b",
        }

        existing_imports = set()
        import_pattern = re.compile(r"^import\s+(\S+)|^from\s+(\S+)", re.MULTILINE)
        for match in import_pattern.finditer(code):
            existing_imports.add(match.group(1) or match.group(2))

        needed_imports = []
        for module, pattern in common_patterns.items():
            base_module = module.split(".")[0]
            if base_module in existing_imports:
                continue
            if re.search(pattern, code):
                if module == "matplotlib.pyplot":
                    needed_imports.append("import matplotlib.pyplot as plt")
                elif module == "numpy":
                    needed_imports.append("import numpy as np")
                elif module == "pandas":
                    needed_imports.append("import pandas as pd")
                elif module == "sklearn":
                    pass
                else:
                    needed_imports.append(f"import {module}")

        if needed_imports:
            import_block = "\n".join(needed_imports)
            if re.match(r"^import\s|^from\s", code, re.MULTILINE):
                first_import = import_pattern.search(code)
                if first_import:
                    pos = first_import.start()
                    code = code[:pos] + import_block + "\n" + code[pos:]
                else:
                    code = import_block + "\n\n" + code
            else:
                code = import_block + "\n\n" + code

        return code

    def _ensure_js_imports(self, code):
        return code

    def _ensure_java_structure(self, code):
        if "class " not in code and "public " not in code:
            code = "public class Main {\n    public static void main(String[] args) {\n        " + code.replace("\n", "\n        ") + "\n    }\n}"
        return code

    def _normalize_language(self, language):
        lang_map = {
            "python": "python",
            "py": "python",
            "python3": "python",
            "javascript": "javascript",
            "js": "javascript",
            "es6": "javascript",
            "java": "java",
            "cpp": "cpp",
            "c++": "cpp",
            "c": "c",
            "typescript": "javascript",
            "ts": "javascript",
        }
        return lang_map.get(language.lower().strip(), language.lower().strip())

    def _normalize_rubric(self, rubric_dict):
        criteria = []
        for level, description in rubric_dict.items():
            criteria.append({
                "item": level,
                "description": str(description),
            })
        return criteria

    def convert_document(self, raw_content, topic="", options=None):
        options = options or {}
        data = self._ensure_dict(raw_content)

        if data.get("parse_error") and data.get("raw_response"):
            json_data = self._try_extract_json(data["raw_response"])
            if json_data:
                if json_data.get("document"):
                    json_data = json_data["document"]
                if json_data.get("title") or json_data.get("sections"):
                    data = json_data
                    if data.get("document"):
                        data = data["document"]
                    title = (
                        data.get("title")
                        or data.get("document_title")
                        or topic
                        or "课程文档"
                    )
                    summary = data.get("summary") or data.get("abstract") or ""
                    target_audience = data.get("target_audience") or ""
                    reading_time = data.get("estimated_reading_time_minutes") or 0
                    sections = data.get("sections") or data.get("chapters") or []
                    normalized_sections = []
                    for idx, sec in enumerate(sections):
                        if not isinstance(sec, dict):
                            continue
                        normalized_sections.append(self._normalize_document_section(sec, idx))
                    glossary = data.get("glossary") or []
                    normalized_glossary = []
                    for item in glossary:
                        if isinstance(item, dict):
                            normalized_glossary.append({
                                "term": item.get("term") or item.get("word") or "",
                                "definition": item.get("definition") or item.get("meaning") or "",
                            })
                        elif isinstance(item, str):
                            parts = item.split("：", 1)
                            if len(parts) == 2:
                                normalized_glossary.append({"term": parts[0].strip(), "definition": parts[1].strip()})
                            else:
                                normalized_glossary.append({"term": item, "definition": ""})
                    review_questions = data.get("review_questions") or data.get("questions") or []
                    normalized_questions = []
                    for q in review_questions:
                        if isinstance(q, str):
                            normalized_questions.append(q)
                        elif isinstance(q, dict):
                            normalized_questions.append(q.get("question") or q.get("text") or str(q))
                    markdown_content = self._generate_document_markdown(
                        title, summary, normalized_sections, normalized_glossary, normalized_questions
                    )
                    return {
                        "title": title,
                        "summary": summary,
                        "target_audience": target_audience,
                        "estimated_reading_time_minutes": reading_time,
                        "sections": normalized_sections,
                        "glossary": normalized_glossary,
                        "review_questions": normalized_questions,
                        "markdown": markdown_content,
                    }
            return self._build_document_from_raw_text(data["raw_response"], topic)

        if data.get("document"):
            data = data["document"]

        title = (
            data.get("title")
            or data.get("document_title")
            or topic
            or "课程文档"
        )
        summary = data.get("summary") or data.get("abstract") or ""
        target_audience = data.get("target_audience") or ""
        reading_time = data.get("estimated_reading_time_minutes") or 0

        sections = data.get("sections") or data.get("chapters") or []
        normalized_sections = []
        for idx, sec in enumerate(sections):
            if not isinstance(sec, dict):
                continue
            normalized_sections.append(self._normalize_document_section(sec, idx))

        if not normalized_sections:
            normalized_sections = self._build_sections_from_generic(data)

        glossary = data.get("glossary") or []
        normalized_glossary = []
        for item in glossary:
            if isinstance(item, dict):
                normalized_glossary.append({
                    "term": item.get("term") or item.get("word") or "",
                    "definition": item.get("definition") or item.get("meaning") or "",
                })
            elif isinstance(item, str):
                parts = item.split("：", 1)
                if len(parts) == 2:
                    normalized_glossary.append({"term": parts[0].strip(), "definition": parts[1].strip()})
                else:
                    normalized_glossary.append({"term": item, "definition": ""})

        review_questions = data.get("review_questions") or data.get("questions") or []
        normalized_questions = []
        for q in review_questions:
            if isinstance(q, str):
                normalized_questions.append(q)
            elif isinstance(q, dict):
                normalized_questions.append(q.get("question") or q.get("text") or str(q))

        markdown_content = self._generate_document_markdown(
            title, summary, normalized_sections, normalized_glossary, normalized_questions
        )

        return {
            "title": title,
            "summary": summary,
            "target_audience": target_audience,
            "estimated_reading_time_minutes": reading_time,
            "sections": normalized_sections,
            "glossary": normalized_glossary,
            "review_questions": normalized_questions,
            "markdown": markdown_content,
        }

    def _normalize_document_section(self, section, index):
        section_id = section.get("section_id") or f"s{index + 1}"
        title = section.get("title") or section.get("section_title") or f"第{index + 1}节"
        key_points = section.get("key_points") or section.get("key_concepts") or []
        content = section.get("content") or section.get("body") or ""

        examples = section.get("examples") or []
        normalized_examples = []
        for ex in examples:
            if isinstance(ex, dict):
                normalized_examples.append({
                    "title": ex.get("title") or "示例",
                    "description": ex.get("description") or "",
                    "content": ex.get("content") or ex.get("code") or "",
                })
            elif isinstance(ex, str):
                normalized_examples.append({
                    "title": "示例",
                    "description": "",
                    "content": ex,
                })

        common_mistakes = section.get("common_mistakes") or section.get("pitfalls") or []
        further_reading = section.get("further_reading") or section.get("references") or []

        return {
            "section_id": section_id,
            "title": title,
            "key_points": key_points,
            "content": content,
            "examples": normalized_examples,
            "common_mistakes": common_mistakes if isinstance(common_mistakes, list) else [str(common_mistakes)],
            "further_reading": further_reading if isinstance(further_reading, list) else [str(further_reading)],
        }

    def _build_sections_from_generic(self, data):
        sections = []
        content_keys = [k for k in data.keys() if k not in {
            "title", "name", "summary", "description", "raw_response", "parse_error",
            "glossary", "review_questions", "target_audience",
        }]

        for key in content_keys[:8]:
            value = data[key]
            if isinstance(value, str) and len(value) > 50:
                sections.append({
                    "section_id": f"s{len(sections) + 1}",
                    "title": self._humanize_key(key),
                    "key_points": [],
                    "content": value,
                    "examples": [],
                    "common_mistakes": [],
                    "further_reading": [],
                })
            elif isinstance(value, list) and value:
                items_text = "\n\n".join(
                    str(item) if not isinstance(item, dict)
                    else item.get("content") or item.get("description") or json.dumps(item, ensure_ascii=False)
                    for item in value[:5]
                )
                if items_text:
                    sections.append({
                        "section_id": f"s{len(sections) + 1}",
                        "title": self._humanize_key(key),
                        "key_points": [],
                        "content": items_text,
                        "examples": [],
                        "common_mistakes": [],
                        "further_reading": [],
                    })

        return sections

    def _generate_document_markdown(self, title, summary, sections, glossary, review_questions):
        parts = []

        def esc(text):
            if not text or not isinstance(text, str):
                return text
            text = text.replace("\\", "\\\\")
            text = text.replace("*", "\\*")
            text = text.replace("_", "\\_")
            text = text.replace("[", "\\[")
            text = text.replace("]", "\\]")
            return text

        parts.append(f"# {esc(title)}\n")
        if summary:
            parts.append(f"> {esc(summary)}\n")

        for sec in sections:
            parts.append(f"\n## {esc(sec['title'])}\n")
            if sec.get("key_points"):
                parts.append("**核心要点：**")
                for kp in sec["key_points"]:
                    parts.append(f"- {esc(str(kp))}")
                parts.append("")
            if sec.get("content"):
                parts.append(sec["content"])
                parts.append("")
            if sec.get("examples"):
                parts.append("### 示例\n")
                for ex in sec["examples"]:
                    parts.append(f"**{esc(ex['title'])}**")
                    if ex.get("description"):
                        parts.append(f"\n{esc(ex['description'])}")
                    if ex.get("content"):
                        parts.append(f"\n```\n{ex['content']}\n```")
                    parts.append("")
            if sec.get("common_mistakes"):
                parts.append("### 常见误区\n")
                for cm in sec["common_mistakes"]:
                    parts.append(f"- ⚠️ {esc(str(cm))}")
                parts.append("")

        if glossary:
            parts.append("\n## 术语表\n")
            for item in glossary:
                parts.append(f"- **{esc(item['term'])}**：{esc(item['definition'])}")
            parts.append("")

        if review_questions:
            parts.append("\n## 复习思考题\n")
            for idx, q in enumerate(review_questions, 1):
                parts.append(f"{idx}. {esc(str(q))}")
            parts.append("")

        return "\n".join(parts)

    def convert_recommendation(self, raw_content, topic="", options=None):
        options = options or {}
        data = self._ensure_dict(raw_content)

        if data.get("parse_error") and data.get("raw_response"):
            return self._build_recommendation_from_raw_text(data["raw_response"], topic)

        items = []
        if isinstance(data, list):
            items = data
        elif data.get("recommendations"):
            items = data["recommendations"]
        elif data.get("items"):
            items = data["items"]
        elif data.get("resources"):
            items = data["resources"]
        elif data.get("recommendation"):
            rec = data["recommendation"]
            if isinstance(rec, list):
                items = rec
            elif isinstance(rec, dict):
                if rec.get("recommendations") or rec.get("items"):
                    items = rec.get("recommendations") or rec.get("items")
                else:
                    items = [rec]
        else:
            for key, val in data.items():
                if isinstance(val, list) and val and isinstance(val[0], dict):
                    items = val
                    break

        if not items and any(data.values()):
            items = [data]

        normalized = []
        for item in items:
            if not isinstance(item, dict):
                if isinstance(item, str) and item.strip():
                    normalized.append({
                        "title": item.strip(),
                        "category": "general",
                        "description": "",
                        "key_points": [],
                        "priority": "medium",
                        "source_type": "reference",
                    })
                continue

            title = (
                item.get("title")
                or item.get("name")
                or item.get("resource_name")
                or item.get("topic")
                or ""
            )
            description = (
                item.get("description")
                or item.get("summary")
                or item.get("abstract")
                or item.get("content")
                or ""
            )
            if isinstance(description, dict):
                description = json.dumps(description, ensure_ascii=False)[:500]
            elif not isinstance(description, str):
                description = str(description)[:500]

            category = (
                item.get("category")
                or item.get("type")
                or item.get("resource_type")
                or self._infer_category(title, description)
            )
            key_points = item.get("key_points") or item.get("key_takeaways") or item.get("highlights") or []
            if isinstance(key_points, str):
                key_points = [p.strip() for p in key_points.split("；") if p.strip()]
            if not isinstance(key_points, list):
                key_points = []

            priority = item.get("priority") or item.get("importance") or "medium"
            if isinstance(priority, (int, float)):
                priority = "high" if priority >= 4 else "medium" if priority >= 2 else "low"
            if priority not in ("high", "medium", "low"):
                priority = "medium"

            source_type = item.get("source_type") or item.get("type") or "reference"
            url = item.get("url") or item.get("link") or ""
            author = item.get("author") or ""
            difficulty = item.get("difficulty") or item.get("level") or ""

            normalized.append({
                "title": title or f"拓展资源{len(normalized) + 1}",
                "category": category,
                "description": description[:500],
                "key_points": key_points[:5],
                "priority": priority,
                "source_type": source_type,
                "url": url,
                "author": author,
                "difficulty": difficulty,
            })

        categories = {}
        for item in normalized:
            cat = item.get("category", "general")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item)

        markdown = self._generate_recommendation_markdown(topic, normalized, categories)

        return {
            "title": f"{topic} - 拓展学习推荐" if topic else "拓展学习推荐",
            "summary": f"共{len(normalized)}项推荐资源，涵盖{len(categories)}个类别",
            "items": normalized,
            "categories": categories,
            "markdown": markdown,
        }

    def _infer_category(self, title, description):
        text = f"{title} {description}".lower()
        category_keywords = {
            "textbook": ["教材", "课本", "教科书", "textbook", "book"],
            "tutorial": ["教程", "指南", "入门", "tutorial", "guide", "how-to"],
            "video": ["视频", "课程录像", "lecture", "video", "mooc"],
            "paper": ["论文", "研究", "paper", "research", "journal"],
            "practice": ["练习", "实训", "实验", "practice", "exercise", "lab"],
            "tool": ["工具", "软件", "平台", "tool", "software", "platform"],
            "reference": ["参考", "手册", "文档", "reference", "manual", "documentation", "api"],
        }
        for cat, keywords in category_keywords.items():
            if any(kw in text for kw in keywords):
                return cat
        return "general"

    def _generate_recommendation_markdown(self, topic, items, categories):
        parts = [f"# {topic} - 拓展学习推荐" if topic else "# 拓展学习推荐", ""]

        cat_labels = {
            "textbook": "教材与书籍",
            "tutorial": "教程与指南",
            "video": "视频课程",
            "paper": "学术论文",
            "practice": "练习与实训",
            "tool": "工具与平台",
            "reference": "参考文档",
            "general": "综合资源",
        }

        for cat, cat_items in categories.items():
            label = cat_labels.get(cat, cat)
            parts.append(f"## {label}")
            parts.append("")
            for item in cat_items:
                priority_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(item.get("priority", "medium"), "🟡")
                parts.append(f"### {priority_icon} {item['title']}")
                if item.get("description"):
                    parts.append(f"\n{item['description']}")
                if item.get("key_points"):
                    parts.append("")
                    for kp in item["key_points"]:
                        parts.append(f"- {kp}")
                if item.get("url"):
                    parts.append(f"\n🔗 [{item['url']}]({item['url']})")
                if item.get("author"):
                    parts.append(f"\n👤 {item['author']}")
                if item.get("difficulty"):
                    parts.append(f"\n📊 难度: {item['difficulty']}")
                parts.append("")

        return "\n".join(parts)

    def _build_recommendation_from_raw_text(self, text, topic):
        items = []
        lines = text.split("\n")
        current_item = None

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            heading_match = re.match(r"^#{1,3}\s+(.+)", stripped)
            if heading_match:
                if current_item and current_item["title"]:
                    items.append(current_item)
                current_item = {
                    "title": heading_match.group(1).strip(),
                    "category": "general",
                    "description": "",
                    "key_points": [],
                    "priority": "medium",
                    "source_type": "reference",
                    "url": "",
                    "author": "",
                    "difficulty": "",
                }
                continue

            bullet_match = re.match(r"^[-*•]\s+(.+)", stripped)
            if bullet_match and current_item:
                current_item["key_points"].append(bullet_match.group(1).strip())
                continue

            numbered_match = re.match(r"^\d+[.、)]\s+(.+)", stripped)
            if numbered_match:
                if current_item and current_item["title"]:
                    items.append(current_item)
                current_item = {
                    "title": numbered_match.group(1).strip(),
                    "category": "general",
                    "description": "",
                    "key_points": [],
                    "priority": "medium",
                    "source_type": "reference",
                    "url": "",
                    "author": "",
                    "difficulty": "",
                }
                continue

            if current_item and not current_item["description"] and len(stripped) > 10:
                current_item["description"] = stripped[:500]

        if current_item and current_item["title"]:
            items.append(current_item)

        if not items:
            sentences = re.split(r'[。！？；\n]', text)
            for s in sentences:
                s = s.strip()
                if len(s) > 5 and len(s) <= 100:
                    items.append({
                        "title": s,
                        "category": "general",
                        "description": "",
                        "key_points": [],
                        "priority": "medium",
                        "source_type": "reference",
                        "url": "",
                        "author": "",
                        "difficulty": "",
                    })
                    if len(items) >= 8:
                        break

        categories = {}
        for item in items:
            cat = item.get("category", "general")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(item)

        markdown = self._generate_recommendation_markdown(topic, items, categories)

        return {
            "title": f"{topic} - 拓展学习推荐" if topic else "拓展学习推荐",
            "summary": f"共{len(items)}项推荐资源",
            "items": items,
            "categories": categories,
            "markdown": markdown,
        }

    def _ensure_dict(self, content):
        if isinstance(content, dict):
            return content
        if isinstance(content, str):
            content = content.strip()
            if content.startswith("```"):
                lines = content.split("\n")
                first_line = lines[0].strip()
                if first_line.startswith("```") and len(first_line) > 3:
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                content = "\n".join(lines)
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass
            start = content.find("{")
            end = content.rfind("}") + 1
            if start >= 0 and end > start:
                candidate = content[start:end]
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    pass
            repaired = self._repair_json_brackets(content)
            if repaired and isinstance(repaired, dict):
                return repaired
            brace_count = 0
            json_start = None
            for i, ch in enumerate(content):
                if ch == "{":
                    if brace_count == 0:
                        json_start = i
                    brace_count += 1
                elif ch == "}":
                    brace_count -= 1
                    if brace_count == 0 and json_start is not None:
                        try:
                            return json.loads(content[json_start:i + 1])
                        except (json.JSONDecodeError, ValueError):
                            json_start = None
            return {"raw_response": content}
        return {"raw_response": str(content)}

    def _try_extract_json(self, text):
        if not text or not isinstance(text, str):
            return None
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            first_line = lines[0].strip()
            if first_line.startswith("```") and len(first_line) > 3:
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except (json.JSONDecodeError, ValueError):
            pass
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except (json.JSONDecodeError, ValueError):
                pass
        repaired = self._repair_json_brackets(text)
        if repaired:
            return repaired
        brace_count = 0
        json_start = None
        for i, ch in enumerate(text):
            if ch == "{":
                if brace_count == 0:
                    json_start = i
                brace_count += 1
            elif ch == "}":
                brace_count -= 1
                if brace_count == 0 and json_start is not None:
                    try:
                        return json.loads(text[json_start:i + 1])
                    except (json.JSONDecodeError, ValueError):
                        json_start = None
        return None

    @staticmethod
    def _repair_json_brackets(text):
        if not text or not isinstance(text, str):
            return None
        chars = list(text)
        stack = []
        in_str = False
        esc = False
        for i, ch in enumerate(chars):
            if esc:
                esc = False
                continue
            if ch == '\\' and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in '{[':
                stack.append(ch)
            elif ch in '}]':
                if stack:
                    last_ch = stack[-1]
                    if (ch == '}' and last_ch == '{') or (ch == ']' and last_ch == '['):
                        stack.pop()
                    else:
                        expected = '}' if last_ch == '{' else ']'
                        chars[i] = expected
                        stack.pop()
                else:
                    chars[i] = ''
        result = ''.join(chars).rstrip()
        while stack:
            last_ch = stack.pop()
            expected = '}' if last_ch == '{' else ']'
            result += expected
        try:
            parsed = json.loads(result)
            return parsed
        except json.JSONDecodeError:
            pass
        brace_count = 0
        json_start = None
        for i, ch in enumerate(result):
            if ch == '{':
                if brace_count == 0:
                    json_start = i
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
                if brace_count == 0 and json_start is not None:
                    candidate = result[json_start:i + 1]
                    try:
                        return json.loads(candidate)
                    except (json.JSONDecodeError, ValueError):
                        json_start = None
        return None

    def _humanize_key(self, key):
        key_map = {
            "key_points": "核心要点",
            "key_concepts": "核心概念",
            "examples": "示例",
            "common_mistakes": "常见误区",
            "further_reading": "扩展阅读",
            "review_questions": "复习思考题",
            "learning_objectives": "学习目标",
            "prerequisites": "前置知识",
            "scoring_criteria": "评分标准",
            "extension_challenges": "扩展挑战",
            "tasks": "任务列表",
            "steps": "操作步骤",
            "hints": "提示",
            "glossary": "术语表",
            "sections": "章节",
            "chapters": "章节",
            "recommendations": "推荐资源",
            "resources": "资源列表",
        }
        if key in key_map:
            return key_map[key]
        return key.replace("_", " ").replace("-", " ").title()

    def _build_mindmap_from_raw_text(self, text, topic):
        root_name = topic or "知识结构"
        root = {
            "name": root_name,
            "description": f"{root_name}的知识体系",
            "is_core": True,
            "relationship_type": None,
            "children": [],
        }

        lines = text.split("\n")
        current_branches = []
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            heading_match = re.match(r"^#{1,3}\s+(.+)", stripped)
            if heading_match:
                name = heading_match.group(1).strip()
                current_branches.append({
                    "name": name,
                    "description": "",
                    "is_core": True,
                    "relationship_type": "包含",
                    "children": [],
                })
                continue

            bullet_match = re.match(r"^[-*•]\s+(.+)", stripped)
            if bullet_match:
                name = bullet_match.group(1).strip()
                if len(name) > 50:
                    name = name[:50] + "..."
                if current_branches:
                    current_branches[-1]["children"].append({
                        "name": name,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
                else:
                    root["children"].append({
                        "name": name,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
                continue

            numbered_match = re.match(r"^\d+[.、)]\s+(.+)", stripped)
            if numbered_match:
                name = numbered_match.group(1).strip()
                if len(name) > 50:
                    name = name[:50] + "..."
                if current_branches:
                    current_branches[-1]["children"].append({
                        "name": name,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "递进",
                        "children": [],
                    })
                else:
                    root["children"].append({
                        "name": name,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "递进",
                        "children": [],
                    })
                continue

            if len(stripped) > 10 and len(stripped) <= 80:
                if current_branches:
                    if not current_branches[-1]["description"]:
                        current_branches[-1]["description"] = stripped[:100]
                    else:
                        current_branches[-1]["children"].append({
                            "name": stripped[:50],
                            "description": "",
                            "is_core": False,
                            "relationship_type": "并列",
                            "children": [],
                        })

        root["children"].extend(current_branches)

        if not root["children"]:
            sentences = re.split(r'[。！？；\n]', text)
            for s in sentences:
                s = s.strip()
                if len(s) > 5 and len(s) <= 60:
                    root["children"].append({
                        "name": s,
                        "description": "",
                        "is_core": False,
                        "relationship_type": "并列",
                        "children": [],
                    })
                    if len(root["children"]) >= 8:
                        break

        return root

    def _build_document_from_raw_text(self, text, topic):
        title = topic or "课程文档"
        sections = []
        current_section = None
        current_content_lines = []

        for line in text.split("\n"):
            stripped = line.strip()
            heading_match = re.match(r"^#{1,3}\s+(.+)", stripped)
            if heading_match:
                if current_section is not None or current_content_lines:
                    if current_section is None:
                        current_section = {
                            "section_id": "s1",
                            "title": "概述",
                            "key_points": [],
                            "content": "\n".join(current_content_lines).strip(),
                            "examples": [],
                            "common_mistakes": [],
                            "further_reading": [],
                        }
                        sections.append(current_section)
                    elif current_content_lines:
                        current_section["content"] += "\n" + "\n".join(current_content_lines).strip()
                    current_content_lines = []

                current_section = {
                    "section_id": f"s{len(sections) + 1}",
                    "title": heading_match.group(1).strip(),
                    "key_points": [],
                    "content": "",
                    "examples": [],
                    "common_mistakes": [],
                    "further_reading": [],
                }
                sections.append(current_section)
                continue

            bullet_match = re.match(r"^[-*•]\s+(.+)", stripped)
            if bullet_match and current_section:
                content = bullet_match.group(1).strip()
                if not current_section["key_points"] and not current_section["content"]:
                    current_section["key_points"].append(content)
                else:
                    current_content_lines.append(stripped)
                continue

            current_content_lines.append(stripped)

        if current_content_lines and current_section:
            remaining = "\n".join(current_content_lines).strip()
            if remaining:
                if current_section["content"]:
                    current_section["content"] += "\n" + remaining
                else:
                    current_section["content"] = remaining
        elif current_content_lines and not sections:
            sections.append({
                "section_id": "s1",
                "title": "概述",
                "key_points": [],
                "content": "\n".join(current_content_lines).strip(),
                "examples": [],
                "common_mistakes": [],
                "further_reading": [],
            })

        if not sections:
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            for idx, para in enumerate(paragraphs[:8]):
                sections.append({
                    "section_id": f"s{idx + 1}",
                    "title": f"第{idx + 1}部分",
                    "key_points": [],
                    "content": para,
                    "examples": [],
                    "common_mistakes": [],
                    "further_reading": [],
                })

        for sec in sections:
            if sec["content"] and not sec["key_points"]:
                first_sentence = sec["content"].split("。")[0]
                if first_sentence and len(first_sentence) < 60:
                    sec["key_points"] = [first_sentence]

        markdown = self._generate_document_markdown(title, "", sections, [], [])

        return {
            "title": title,
            "summary": sections[0]["content"][:200] if sections and sections[0].get("content") else "",
            "target_audience": "",
            "estimated_reading_time_minutes": max(1, len(text) // 500),
            "sections": sections,
            "glossary": [],
            "review_questions": [],
            "markdown": markdown,
        }


content_converter_service = ContentConverterService()
