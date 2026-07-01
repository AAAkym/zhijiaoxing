import argparse
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.main import app
from src.models.course import Course, TeachingContent
from src.models.knowledge_base import KnowledgeSourceChunk
from src.models.user import db


SOURCE_PREFIX = "python-course-pdf"
RESOURCE_TITLE = "Python课程资料知识库"
DEFAULT_COURSE_TITLE = "Python程序设计"

TARGET_FILE_NAMES = {
    "Python详细入门【71页】.pdf",
    "python超精简的复习整理【5页】.pdf",
    "第9课小题里通过死记硬背拿分的知识（文档）.pdf",
    "Python详细笔记【182页】(1).pdf",
    "python基础练题100道【39页】.pdf",
    "第8课其它知识（文档）.pdf",
    "第二套模拟题.pdf",
    "Python重点笔记【18页】.pdf",
    "Python经典题库及答案【67页】.pdf",
    "Python试题含答案【27页】.pdf",
    "PYTHON知识点总结及答案【33页】.pdf",
    "第一套模拟题.pdf",
    "Python期末考试试题及答案【16页】.pdf",
}


def _discover_pdfs():
    desktop = Path.home() / "Desktop"
    files = [p for p in desktop.glob("*.pdf") if p.name in TARGET_FILE_NAMES]
    files.sort(key=lambda p: _resource_order(p.name))
    return files


def _resource_order(name):
    order = [
        "Python详细入门【71页】.pdf",
        "Python详细笔记【182页】(1).pdf",
        "Python重点笔记【18页】.pdf",
        "python超精简的复习整理【5页】.pdf",
        "PYTHON知识点总结及答案【33页】.pdf",
        "第8课其它知识（文档）.pdf",
        "第9课小题里通过死记硬背拿分的知识（文档）.pdf",
        "python基础练题100道【39页】.pdf",
        "Python经典题库及答案【67页】.pdf",
        "Python试题含答案【27页】.pdf",
        "Python期末考试试题及答案【16页】.pdf",
        "第一套模拟题.pdf",
        "第二套模拟题.pdf",
    ]
    return order.index(name) if name in order else len(order)


def _resource_kind(name):
    if "模拟题" in name:
        return "mock_exam"
    if "题" in name or "试题" in name or "考试" in name:
        return "question_bank"
    if "复习" in name or "重点" in name or "总结" in name or "死记硬背" in name:
        return "review_notes"
    if "笔记" in name or "入门" in name or "知识" in name:
        return "lecture_notes"
    return "reference"


def _reference_prefix(kind):
    return {
        "lecture_notes": "PN",
        "review_notes": "PR",
        "question_bank": "PQ",
        "mock_exam": "PM",
        "reference": "PX",
    }.get(kind, "PX")


def _extract_pages(pdf_path):
    import fitz

    doc = fitz.open(str(pdf_path))
    try:
        pages = []
        for index, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            text = _normalize_text(text)
            if text:
                pages.append({"page": index, "text": text})
        return pages, doc.page_count
    finally:
        doc.close()


def _normalize_text(text):
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.fullmatch(r"[-_=\s]+", line):
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def _chunk_page_text(page_text, size=900, overlap=120):
    page_text = re.sub(r"\s+", " ", page_text).strip()
    if not page_text:
        return []
    chunks = []
    start = 0
    while start < len(page_text):
        end = min(len(page_text), start + size)
        if end < len(page_text):
            pivot = max(
                page_text.rfind("。", start, end),
                page_text.rfind("；", start, end),
                page_text.rfind("\n", start, end),
            )
            if pivot > start + int(size * 0.55):
                end = pivot + 1
        chunks.append(page_text[start:end].strip())
        if end >= len(page_text):
            break
        start = max(0, end - overlap)
    return chunks


def _guess_topic(text, fallback):
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if first_line and 2 <= len(first_line) <= 45:
        return first_line

    topic_keywords = [
        "变量", "数据类型", "字符串", "列表", "元组", "字典", "集合", "条件语句",
        "循环", "函数", "模块", "文件", "异常", "面向对象", "类", "对象", "继承",
        "多态", "装饰器", "生成器", "迭代器", "正则表达式", "NumPy", "Pandas",
        "Matplotlib", "选择题", "填空题", "判断题", "编程题", "模拟题",
    ]
    for keyword in topic_keywords:
        if keyword in text:
            return keyword
    return fallback


def _build_resource_content(file_summaries, chunk_count):
    source_lines = "\n".join(
        f"- {item['name']}：{item['pages']} 页，{item['text_pages']} 页可解析，{item['chunks']} 个知识片段，类型 {item['kind']}"
        for item in file_summaries
    )
    return f"""# Python课程资料知识库

这些资料已经解析并接入《Python程序设计》课程知识库，可作为 AI 生成教学内容、复习资料、练习题、模拟题与答案解析的依据。

## 接入资料

{source_lines}

## 资料用途

- 教学内容生成：优先参考入门资料、详细笔记、重点笔记和知识点总结。
- 题目生成：优先参考基础练题、经典题库、试题含答案、期末试题和两套模拟题。
- 复习巩固：优先参考超精简复习整理、重点笔记、第 8 课和第 9 课补充资料。
- AI 助教答疑：从全部 {chunk_count} 个资料片段中检索证据并生成带来源引用的回答。
"""


def import_pdfs(course_title=DEFAULT_COURSE_TITLE, dry_run=False):
    pdfs = _discover_pdfs()
    missing = sorted(TARGET_FILE_NAMES - {p.name for p in pdfs})
    if missing:
        raise FileNotFoundError(f"Missing target PDFs on Desktop: {missing}")

    parsed_files = []
    chunk_payloads = []
    for file_index, pdf_path in enumerate(pdfs, start=1):
        pages, total_pages = _extract_pages(pdf_path)
        kind = _resource_kind(pdf_path.name)
        prefix = _reference_prefix(kind)
        file_chunk_start = len(chunk_payloads)
        for page in pages:
            topic = _guess_topic(page["text"], pdf_path.stem)
            for part_index, piece in enumerate(_chunk_page_text(page["text"]), start=1):
                chunk_no = len(chunk_payloads) + 1
                chunk_payloads.append({
                    "source_type": "pdf_resource",
                    "source_id": f"{SOURCE_PREFIX}:f{file_index}:p{page['page']}:c{part_index}",
                    "reference_code": f"{prefix}{chunk_no:04d}",
                    "title": topic,
                    "content": piece,
                    "location": f"{pdf_path.name} / 第{page['page']}页 / 片段{part_index}",
                    "source_url": str(pdf_path.resolve()),
                    "metadata_json": json.dumps({
                        "origin": "python_course_pdf_import",
                        "file_name": pdf_path.name,
                        "resource_kind": kind,
                        "page": page["page"],
                        "chunk_index": part_index,
                        "topic": topic,
                        "used_for": ["teaching_content_generation", "question_generation", "rag_answering"],
                    }, ensure_ascii=False),
                })
        parsed_files.append({
            "name": pdf_path.name,
            "kind": kind,
            "pages": total_pages,
            "text_pages": len(pages),
            "chunks": len(chunk_payloads) - file_chunk_start,
        })

    with app.app_context():
        course = Course.query.filter_by(title=course_title).first()
        if not course:
            course = Course.query.filter(Course.title.like("%Python%")).order_by(Course.id.desc()).first()
        if not course:
            raise RuntimeError(f"Course not found: {course_title}")

        existing_chunks = KnowledgeSourceChunk.query.filter(
            KnowledgeSourceChunk.course_id == course.id,
            KnowledgeSourceChunk.source_id.like(f"{SOURCE_PREFIX}:%"),
        ).count()
        existing_resources = TeachingContent.query.filter_by(
            course_id=course.id,
            title=RESOURCE_TITLE,
        ).count()

        if dry_run:
            return {
                "course_id": course.id,
                "course_title": course.title,
                "files": parsed_files,
                "chunks_to_create": len(chunk_payloads),
                "existing_chunks_to_replace": existing_chunks,
                "existing_resources_to_replace": existing_resources,
                "dry_run": True,
            }

        KnowledgeSourceChunk.query.filter(
            KnowledgeSourceChunk.course_id == course.id,
            KnowledgeSourceChunk.source_id.like(f"{SOURCE_PREFIX}:%"),
        ).delete(synchronize_session=False)
        TeachingContent.query.filter_by(course_id=course.id, title=RESOURCE_TITLE).delete()

        for payload in chunk_payloads:
            db.session.add(KnowledgeSourceChunk(course_id=course.id, **payload))

        db.session.add(TeachingContent(
            course_id=course.id,
            title=RESOURCE_TITLE,
            content=_build_resource_content(parsed_files, len(chunk_payloads)),
            generated_by_llm=False,
            content_type="resource",
        ))
        db.session.commit()

        return {
            "course_id": course.id,
            "course_title": course.title,
            "files": parsed_files,
            "created_chunks": len(chunk_payloads),
            "replaced_chunks": existing_chunks,
            "replaced_resources": existing_resources,
            "resource_title": RESOURCE_TITLE,
            "dry_run": False,
        }


def main():
    parser = argparse.ArgumentParser(description="Import Python course PDFs as knowledge-base resources.")
    parser.add_argument("--course-title", default=DEFAULT_COURSE_TITLE, help="Target course title")
    parser.add_argument("--dry-run", action="store_true", help="Analyze without writing database changes")
    args = parser.parse_args()

    result = import_pdfs(args.course_title, args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
