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


SOURCE_PREFIX = "java-aid-pdf"
RESOURCE_TITLE = "Java教辅资料知识库"
DEFAULT_COURSE_TITLE = "Java实战开发"


def _find_default_pdf():
    desktop = Path.home() / "Desktop"
    candidates = [
        p for p in desktop.glob("*.pdf")
        if p.name.lower().startswith("java") and "教辅" in p.name
    ]
    if candidates:
        return candidates[0]
    candidates = [p for p in desktop.glob("*.pdf") if p.name.lower().startswith("java")]
    if candidates:
        return candidates[0]
    return desktop / "java教辅资料.pdf"


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
    text = text.replace("youkeda", "")
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
            pivot = max(page_text.rfind("。", start, end), page_text.rfind("；", start, end))
            if pivot > start + int(size * 0.55):
                end = pivot + 1
        chunks.append(page_text[start:end].strip())
        if end >= len(page_text):
            break
        start = max(0, end - overlap)
    return chunks


def _guess_topic(text):
    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if first_line and len(first_line) <= 40:
        return first_line

    topic_keywords = [
        "Java 简介", "开发环境", "基础语法", "对象和类", "数据类型", "变量类型",
        "修饰符", "运算符", "循环结构", "条件语句", "switch case", "Number",
        "Character", "String", "StringBuffer", "数组", "日期时间", "正则表达式",
        "方法", "IO", "Scanner", "异常处理", "面向对象", "继承", "重写",
        "重载", "多态", "抽象类", "封装", "接口", "包", "集合", "ArrayList",
        "LinkedList", "HashSet", "HashMap", "Iterator", "多线程", "网络编程",
        "文档注释", "序列化", "泛型", "Java 8", "Java 9",
    ]
    for keyword in topic_keywords:
        if keyword in text:
            return keyword
    return "Java教辅资料"


def _build_resource_content(pdf_path, total_pages, text_pages, chunk_count):
    return f"""# Java教辅资料知识库

本学习资源已从《{pdf_path.name}》解析并接入课程知识库，可用于课程内容检索、AI 助教答疑、资源生成引用和复习资料整理。

## 资料概况

- 来源文件：{pdf_path}
- PDF 页数：{total_pages}
- 可解析文本页：{text_pages}
- 知识库片段：{chunk_count}
- 接入课程：{DEFAULT_COURSE_TITLE}

## 覆盖主题

- Java 简介、发展历史与开发环境配置
- 基础语法、数据类型、变量、修饰符、运算符与流程控制
- 字符串、数组、日期时间、正则表达式、方法与异常处理
- 面向对象编程：对象和类、继承、重写、重载、多态、抽象类、封装、接口与包
- 集合与数据结构：ArrayList、LinkedList、HashSet、HashMap、Iterator 与集合框架
- 多线程、网络编程、文档注释、序列化、泛型以及 Java 8/9 新特性

## 使用建议

学习时可围绕具体主题向 AI 助教提问，例如“Java 多态和重载有什么区别”“HashMap 的使用场景”“Java 异常处理流程”。系统会从本资料片段中检索证据并给出带引用的回答。
"""


def import_pdf(pdf_path, course_title=DEFAULT_COURSE_TITLE, dry_run=False):
    pdf_path = Path(pdf_path).expanduser().resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    pages, total_pages = _extract_pages(pdf_path)
    source_url = str(pdf_path)

    with app.app_context():
        course = Course.query.filter_by(title=course_title).first()
        if not course:
            course = Course.query.filter(Course.title.like("%Java%实战%")).first()
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

        chunk_payloads = []
        for page in pages:
            topic = _guess_topic(page["text"])
            for part_index, piece in enumerate(_chunk_page_text(page["text"]), start=1):
                chunk_payloads.append({
                    "course_id": course.id,
                    "source_type": "pdf_resource",
                    "source_id": f"{SOURCE_PREFIX}:p{page['page']}:c{part_index}",
                    "reference_code": f"JP{len(chunk_payloads) + 1:03d}",
                    "title": topic,
                    "content": piece,
                    "location": f"{pdf_path.name} / 第{page['page']}页 / 片段{part_index}",
                    "source_url": source_url,
                    "metadata_json": json.dumps({
                        "origin": "java_aid_pdf_import",
                        "file_name": pdf_path.name,
                        "page": page["page"],
                        "chunk_index": part_index,
                        "topic": topic,
                    }, ensure_ascii=False),
                })

        if dry_run:
            return {
                "course_id": course.id,
                "course_title": course.title,
                "pdf_path": str(pdf_path),
                "total_pages": total_pages,
                "text_pages": len(pages),
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
            db.session.add(KnowledgeSourceChunk(**payload))

        resource_content = _build_resource_content(
            pdf_path=pdf_path,
            total_pages=total_pages,
            text_pages=len(pages),
            chunk_count=len(chunk_payloads),
        )
        db.session.add(TeachingContent(
            course_id=course.id,
            title=RESOURCE_TITLE,
            content=resource_content,
            generated_by_llm=False,
            content_type="resource",
        ))
        db.session.commit()

        return {
            "course_id": course.id,
            "course_title": course.title,
            "pdf_path": str(pdf_path),
            "total_pages": total_pages,
            "text_pages": len(pages),
            "created_chunks": len(chunk_payloads),
            "replaced_chunks": existing_chunks,
            "replaced_resources": existing_resources,
            "resource_title": RESOURCE_TITLE,
            "dry_run": False,
        }


def main():
    parser = argparse.ArgumentParser(description="Import Java aid PDF as course knowledge-base resource.")
    parser.add_argument("--pdf", default=str(_find_default_pdf()), help="Path to java教辅资料.pdf")
    parser.add_argument("--course-title", default=DEFAULT_COURSE_TITLE, help="Target course title")
    parser.add_argument("--dry-run", action="store_true", help="Analyze without writing database changes")
    args = parser.parse_args()

    result = import_pdf(args.pdf, args.course_title, args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
