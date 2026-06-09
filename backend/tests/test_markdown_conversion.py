import json
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.services.content_converter_service import content_converter_service
from src.services.content_sync_service import ContentSyncService
from src.services.course_data_service import DataCleaner


class TestMarkdownEscape:
    def test_escape_asterisk(self):
        result = content_converter_service._generate_document_markdown(
            "Test*Title", "", [], [], []
        )
        assert "\\*" in result
        assert "Test\\*Title" in result

    def test_escape_underscore(self):
        result = content_converter_service._generate_document_markdown(
            "Test_Title", "", [], [], []
        )
        assert "\\_" in result

    def test_escape_brackets(self):
        result = content_converter_service._generate_document_markdown(
            "Test[1]", "", [], [], []
        )
        assert "\\[" in result
        assert "\\]" in result

    def test_escape_backslash(self):
        result = content_converter_service._generate_document_markdown(
            "C:\\Users\\path", "", [], [], []
        )
        assert "\\\\" in result

    def test_escape_tilde_in_mindmap(self):
        svc = ContentSyncService()
        data = {"mindmap": {"root": {"name": "A~B", "description": "x~y", "children": []}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "\\~" in result

    def test_chinese_text_no_escape_needed(self):
        result = content_converter_service._generate_document_markdown(
            "数据库原理与应用", "", [], [], []
        )
        assert "数据库原理与应用" in result

    def test_mixed_chinese_english(self):
        result = content_converter_service._generate_document_markdown(
            "Python编程_基础*入门", "", [], [], []
        )
        assert "\\_" in result
        assert "\\*" in result
        assert "Python编程" in result

    def test_math_symbols_preserved(self):
        result = content_converter_service._generate_document_markdown(
            "方程 α=β+γ", "", [], [], []
        )
        assert "α=β+γ" in result

    def test_greek_letters_preserved(self):
        sections = [{"title": "物理", "key_points": ["λ=hc/E"], "content": "", "examples": [], "common_mistakes": [], "further_reading": []}]
        result = content_converter_service._generate_document_markdown(
            "量子力学", "", sections, [], []
        )
        assert "λ=hc/E" in result


class TestHtmlToMarkdown:
    def test_heading_conversion(self):
        html = "<h1>Title</h1><h2>Sub</h2>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "## Title" in result
        assert "## Sub" in result

    def test_paragraph_conversion(self):
        html = "<p>Hello world</p>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "Hello world" in result

    def test_list_conversion(self):
        html = "<ul><li>Item 1</li><li>Item 2</li></ul>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "- Item 1" in result
        assert "- Item 2" in result

    def test_strong_em_conversion(self):
        html = "<strong>Bold</strong> and <em>Italic</em>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "**Bold**" in result
        assert "*Italic*" in result

    def test_code_conversion(self):
        html = "<code>print()</code>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "`print()`" in result

    def test_pre_conversion(self):
        html = "<pre>x = 1</pre>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "```" in result
        assert "x = 1" in result

    def test_blockquote_conversion(self):
        html = "<blockquote>Quote text</blockquote>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "> Quote text" in result

    def test_link_conversion(self):
        html = '<a href="https://example.com">Link</a>'
        result = DataCleaner.clean_html_to_markdown(html)
        assert "[Link](https://example.com)" in result

    def test_image_conversion(self):
        html = '<img alt="Alt" src="https://example.com/img.png"/>'
        result = DataCleaner.clean_html_to_markdown(html)
        assert "![Alt](https://example.com/img.png)" in result

    def test_hr_conversion(self):
        html = "<hr/>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "---" in result

    def test_html_entity_amp(self):
        html = "A &amp; B"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "A & B" in result

    def test_html_entity_lt_gt(self):
        html = "x &lt; 5 &gt; 3"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "x < 5" in result
        assert "> 3" in result

    def test_html_entity_nbsp(self):
        html = "A&nbsp;&nbsp;B"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "A  B" in result

    def test_html_entity_quot(self):
        html = 'He said &quot;hello&quot;'
        result = DataCleaner.clean_html_to_markdown(html)
        assert '"hello"' in result

    def test_chinese_html_content(self):
        html = "<h2>数据库原理</h2><p>关系代数是<strong>核心</strong>内容</p>"
        result = DataCleaner.clean_html_to_markdown(html)
        assert "数据库原理" in result
        assert "关系代数" in result
        assert "**核心**" in result


class TestJsonExtraction:
    def test_valid_json(self):
        data = content_converter_service._ensure_dict('{"key": "value"}')
        assert data["key"] == "value"

    def test_json_with_prefix(self):
        data = content_converter_service._ensure_dict('Here is the result: {"key": "value"}')
        assert data["key"] == "value"

    def test_json_with_suffix(self):
        data = content_converter_service._ensure_dict('{"key": "value"} end of response')
        assert data["key"] == "value"

    def test_json_with_code_fence(self):
        data = content_converter_service._ensure_dict('```json\n{"key": "value"}\n```')
        assert data["key"] == "value"

    def test_nested_braces(self):
        data = content_converter_service._ensure_dict('text {"a": {"b": 1}} more')
        assert data["a"]["b"] == 1

    def test_multiple_json_objects(self):
        data = content_converter_service._ensure_dict('prefix {"a": 1} garbage {"b": 2}')
        assert data["a"] == 1

    def test_invalid_json_fallback(self):
        data = content_converter_service._ensure_dict('not json at all')
        assert "raw_response" in data

    def test_chinese_json(self):
        data = content_converter_service._ensure_dict('{"名称": "数据库", "描述": "关系型数据库"}')
        assert data["名称"] == "数据库"

    def test_multibyte_safe_extraction(self):
        payload = '{"text": "中文内容测试", "value": 42}'
        data = content_converter_service._ensure_dict(payload)
        assert data["text"] == "中文内容测试"


class TestMindmapMarkdown:
    def test_basic_mindmap(self):
        svc = ContentSyncService()
        data = {"mindmap": {"root": {"name": "Root", "description": "Desc", "children": [
            {"name": "Child1", "description": "", "children": []},
            {"name": "Child2", "description": "", "children": []},
        ]}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "# Root" in result
        assert "- Child1" in result
        assert "- Child2" in result

    def test_mindmap_special_chars(self):
        svc = ContentSyncService()
        data = {"mindmap": {"root": {"name": "A*B_C", "description": "x[y]z", "children": []}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "\\*" in result
        assert "\\_" in result
        assert "\\[" in result
        assert "\\]" in result

    def test_mindmap_core_mark(self):
        svc = ContentSyncService()
        data = {"mindmap": {"root": {"name": "Root", "description": "", "is_core": True, "children": [
            {"name": "Core", "description": "", "is_core": True, "children": []},
        ]}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "★" in result

    def test_mindmap_relationship_type(self):
        svc = ContentSyncService()
        data = {"mindmap": {"root": {"name": "Root", "description": "", "children": [
            {"name": "Child", "description": "", "relationship_type": "递进", "children": []},
        ]}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "[递进]" in result

    def test_mindmap_description_truncation(self):
        svc = ContentSyncService()
        long_desc = "A" * 200
        data = {"mindmap": {"root": {"name": "Root", "description": long_desc, "children": []}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "..." in result
        assert len([l for l in result.split("\n") if "_" in l and "A" in l][0]) < 200

    def test_mindmap_deep_nesting(self):
        svc = ContentSyncService()
        data = {"mindmap": {"root": {"name": "L0", "description": "", "children": [
            {"name": "L1", "description": "", "children": [
                {"name": "L2", "description": "", "children": [
                    {"name": "L3", "description": "", "children": []},
                ]},
            ]},
        ]}}}
        result = svc._mindmap_to_markdown(data, "test")
        assert "L0" in result
        assert "L1" in result
        assert "L2" in result
        assert "L3" in result


class TestDocumentMarkdown:
    def test_basic_document(self):
        result = content_converter_service._generate_document_markdown(
            "Test Doc", "Summary", [], [], []
        )
        assert "# Test Doc" in result
        assert "> Summary" in result

    def test_document_with_sections(self):
        sections = [{
            "title": "Section 1",
            "key_points": ["Point 1", "Point 2"],
            "content": "Content here",
            "examples": [],
            "common_mistakes": [],
            "further_reading": [],
        }]
        result = content_converter_service._generate_document_markdown(
            "Doc", "", sections, [], []
        )
        assert "## Section 1" in result
        assert "- Point 1" in result
        assert "Content here" in result

    def test_document_with_glossary(self):
        glossary = [{"term": "API", "definition": "Application Programming Interface"}]
        result = content_converter_service._generate_document_markdown(
            "Doc", "", [], glossary, []
        )
        assert "**API**" in result
        assert "Application Programming Interface" in result

    def test_document_with_review_questions(self):
        questions = ["What is X?", "How does Y work?"]
        result = content_converter_service._generate_document_markdown(
            "Doc", "", [], [], questions
        )
        assert "1. What is X?" in result
        assert "2. How does Y work?" in result

    def test_document_special_chars_in_sections(self):
        sections = [{
            "title": "C++ & Java",
            "key_points": ["x*y=z", "a_b=c"],
            "content": "",
            "examples": [],
            "common_mistakes": [],
            "further_reading": [],
        }]
        result = content_converter_service._generate_document_markdown(
            "Doc", "", sections, [], []
        )
        assert "C++ & Java" in result or "C++" in result
