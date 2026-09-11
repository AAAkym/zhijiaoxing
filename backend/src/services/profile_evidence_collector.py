import json

from src.models.course import ProgrammingSubmission


def _result_score(value):
    if not value:
        return None
    if isinstance(value, dict):
        data = value
    else:
        try:
            data = json.loads(value)
        except (TypeError, ValueError):
            return None
    try:
        return float(data.get("score"))
    except (AttributeError, TypeError, ValueError):
        return None


def collect_programming_signals(user_id, course_ids=None, limit=50):
    """Read programming evidence for profile explanation without database writes."""
    query = ProgrammingSubmission.query.filter_by(user_id=user_id)
    if course_ids is not None:
        ids = [int(course_id) for course_id in course_ids if course_id is not None]
        if not ids:
            return _empty_programming_signals()
        query = query.filter(ProgrammingSubmission.course_id.in_(ids))

    submissions = query.order_by(ProgrammingSubmission.created_at.desc()).limit(limit).all()
    if not submissions:
        return _empty_programming_signals()

    passed = 0
    syntax_issues = 0
    logic_issues = 0
    languages = {}
    for submission in submissions:
        ratio = (float(submission.score or 0) / float(submission.max_score or 100))
        if submission.status == "passed" or ratio >= 0.6:
            passed += 1
        syntax_score = _result_score(submission.syntax_result)
        logic_score = _result_score(submission.logic_result)
        if syntax_score is not None and syntax_score < 60:
            syntax_issues += 1
        if logic_score is not None and logic_score < 60:
            logic_issues += 1
        language = submission.language or "unknown"
        languages[language] = languages.get(language, 0) + 1

    total = len(submissions)
    return {
        "total_submissions": total,
        "passed_submissions": passed,
        "pass_rate": round(passed / total, 3),
        "syntax_issue_count": syntax_issues,
        "logic_issue_count": logic_issues,
        "language_distribution": languages,
        "last_at": submissions[0].created_at.isoformat() if submissions[0].created_at else None,
    }


def _empty_programming_signals():
    return {
        "total_submissions": 0,
        "passed_submissions": 0,
        "pass_rate": 0,
        "syntax_issue_count": 0,
        "logic_issue_count": 0,
        "language_distribution": {},
        "last_at": None,
    }
