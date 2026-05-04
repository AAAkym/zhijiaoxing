import json
import pytest
from tests.conftest import app, db_session


class TestProgrammingQuestionGeneration:
    def test_validate_question_count_valid(self):
        from src.routes.programming import _validate_question_count
        assert _validate_question_count(5) == 5
        assert _validate_question_count(1) == 1
        assert _validate_question_count(20) == 20

    def test_validate_question_count_invalid(self):
        from src.routes.programming import _validate_question_count
        assert _validate_question_count(0) == 1
        assert _validate_question_count(-1) == 1
        assert _validate_question_count(21) == 20
        assert _validate_question_count(None) == 1
        assert _validate_question_count('abc') == 1
        assert _validate_question_count('') == 1
        assert _validate_question_count(3.7) == 3

    def test_fallback_questions_are_unique(self):
        from src.routes.programming import _fallback_question
        questions = [_fallback_question('Python', 'medium', 'python', i) for i in range(10)]
        titles = [q['title'] for q in questions]
        assert len(set(titles)) == 10, f"Expected 10 unique titles, got {len(set(titles))}"

    def test_fallback_question_has_all_fields(self):
        from src.routes.programming import _fallback_question
        q = _fallback_question('Python', 'medium', 'python', 0)
        required_fields = ['id', 'type', 'title', 'question', 'description',
                          'input_format', 'output_format', 'constraints',
                          'samples', 'test_cases', 'standard_answer',
                          'difficulty', 'language', 'score', 'explanation',
                          'knowledge_tags']
        for field in required_fields:
            assert field in q, f"Missing field: {field}"

    def test_normalize_question_preserves_raw_data(self):
        from src.routes.programming import _normalize_question
        raw = {
            'title': 'Custom Title',
            'description': 'Custom Description',
            'input_format': 'Custom Input',
            'output_format': 'Custom Output',
            'standard_answer': 'print(42)',
            'explanation': 'Custom explanation',
            'test_cases': [{'input': '1', 'output': '42'}],
            'samples': [{'input': '2', 'output': '42'}],
            'knowledge_tags': ['tag1', 'tag2'],
            'difficulty': 'hard',
        }
        q = _normalize_question(raw, 0, 'Python', 'medium', 'python')
        assert q['title'] == 'Custom Title'
        assert q['description'] == 'Custom Description'
        assert q['standard_answer'] == 'print(42)'
        assert q['explanation'] == 'Custom explanation'
        assert len(q['test_cases']) == 1
        assert q['knowledge_tags'] == ['tag1', 'tag2']

    def test_normalize_empty_raw_uses_fallback(self):
        from src.routes.programming import _normalize_question
        q = _normalize_question({}, 0, 'Python', 'medium', 'python')
        assert q['type'] == 'programming'
        assert q['id'] == 1
        assert 'title' in q
        assert 'description' in q

    def test_deduplicate_questions(self):
        from src.routes.programming import _deduplicate_questions
        questions = [
            {'title': 'A', 'description': 'Desc A'},
            {'title': 'A', 'description': 'Desc A'},
            {'title': 'B', 'description': 'Desc B'},
            {'title': 'C', 'description': 'Desc C'},
            {'title': 'B', 'description': 'Desc B different'},
        ]
        result = _deduplicate_questions(questions)
        assert len(result) == 4

    def test_extract_json_array(self):
        from src.routes.programming import _extract_json_array
        assert _extract_json_array('[{"a":1}]') == [{'a': 1}]
        assert _extract_json_array('```json\n[{"a":1}]\n```') == [{'a': 1}]
        assert _extract_json_array('') == []
        assert _extract_json_array('not json') == []


class TestLessonPlanService:
    def test_fallback_plan_structure(self):
        from src.services.lesson_plan_service import _fallback_lesson_plan
        plan = _fallback_lesson_plan('Python基础', 45, 'medium')
        assert 'title' in plan
        assert 'objectives' in plan
        assert 'key_points' in plan
        assert 'teaching_process' in plan
        assert 'interaction_design' in plan
        assert 'assessment_design' in plan
        assert 'reflection' in plan
        total_duration = sum(p['duration_minutes'] for p in plan['teaching_process'])
        assert total_duration == 45

    def test_parse_lesson_plan_json(self):
        from src.services.lesson_plan_service import _parse_lesson_plan
        raw = json.dumps({
            "title": "Test Plan",
            "objectives": {"knowledge": ["k1"], "ability": ["a1"], "emotion": ["e1"]},
            "teaching_process": [],
        })
        result = _parse_lesson_plan(raw, 'Test')
        assert result['title'] == 'Test Plan'


class TestLearningAnalyticsService:
    def test_at_risk_students_empty(self):
        from src.services.learning_analytics_service import get_at_risk_students
        from src.main import app as flask_app
        with flask_app.app_context():
            result = get_at_risk_students(99999)
            assert isinstance(result, list)
            assert len(result) == 0

    def test_fallback_analytics_report(self):
        from src.services.learning_analytics_service import _fallback_analytics_report
        analytics = {
            'total_students': 30,
            'avg_progress': 55.0,
            'progress_distribution': {'excellent': 5, 'good': 10, 'average': 8, 'below_average': 5, 'inactive': 2},
        }
        report = _fallback_analytics_report(analytics)
        assert 'summary' in report
        assert 'key_findings' in report
        assert 'teaching_suggestions' in report


class TestAIOptimizationService:
    def test_evaluate_content_quality(self):
        from src.services.ai_optimization_service import _evaluate_content_quality
        assert _evaluate_content_quality('') == 0.0
        assert _evaluate_content_quality('short') < 60
        long_content = '概念与原理\n' * 50 + '示例：如上所示\n' * 10 + '注意：常见误区\n' * 5 + '总结归纳\n' * 5
        assert _evaluate_content_quality(long_content) >= 80

    def test_evaluate_assessment_quality(self):
        from src.services.ai_optimization_service import _evaluate_assessment_quality
        assert _evaluate_assessment_quality([]) == 0.0
        questions = [
            {'type': 'choice', 'explanation': '解析', 'difficulty': 'easy'},
            {'type': 'fill', 'explanation': '解析', 'difficulty': 'medium'},
            {'type': 'essay', 'explanation': '解析', 'difficulty': 'hard'},
        ]
        score = _evaluate_assessment_quality(questions)
        assert score > 50

    def test_compute_quality_signal(self):
        from src.services.ai_optimization_service import _compute_quality_signal
        assert _compute_quality_signal('', '', '') == 'neutral'
        assert _compute_quality_signal('abc', 'a', '') == 'negative'
        assert _compute_quality_signal('abc', 'abcdefghij', '') == 'positive_expansion'
