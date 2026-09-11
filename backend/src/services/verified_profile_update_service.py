"""Apply reviewed learning-cycle evidence to a narrow permanent-profile whitelist."""

from datetime import datetime

from src.models.student_profile import StudentProfile


WRITABLE_PROFILE_PATHS = (
    "knowledge_base._verified_learning_cycles",
    "error_patterns[_source=verified_learning_cycle]",
)


def apply_verified_cycle_update(student_user_id, context, evidence, feedback, review):
    result = {
        "updated": False,
        "reason": "evidence_not_high_confidence",
        "writable_paths": list(WRITABLE_PROFILE_PATHS),
        "preserved_dimensions": [
            "cognitive_style", "learning_pace", "interest_areas", "goal_orientation",
            "time_availability", "interaction_preference",
        ],
    }
    if not review.get("high_confidence") or review.get("decision") != "accepted_for_cycle":
        return result

    effect = feedback.get("learning_effect")
    if effect not in ("clearly_improved", "partially_improved", "not_improved"):
        result["reason"] = "conclusion_not_writable"
        return result

    profile = StudentProfile.query.filter_by(user_id=int(student_user_id)).first()
    if not profile:
        result["reason"] = "profile_not_found"
        return result

    course_id = int(context["course_id"])
    topic = str(context.get("topic") or "本轮知识点").strip()
    cycle_id = str(context["cycle_id"])
    record_key = f"course:{course_id}:topic:{topic}"
    knowledge_base = profile.get_knowledge_base()
    verified = knowledge_base.get("_verified_learning_cycles")
    if not isinstance(verified, dict):
        verified = {}
    verified[record_key] = {
        "cycle_id": cycle_id,
        "course_id": course_id,
        "topic": topic,
        "conclusion": effect,
        "summary": feedback.get("summary"),
        "confidence_score": int(feedback.get("confidence_score") or 0),
        "assessment_source_count": int(evidence.get("assessment_source_count") or 0),
        "assessment_sample_count": int(evidence.get("assessment_sample_count") or 0),
        "assessment_ids": (evidence.get("assessment_scope") or {}).get("assessment_ids") or [],
        "updated_at": datetime.utcnow().isoformat(),
    }
    knowledge_base["_verified_learning_cycles"] = verified
    profile.set_knowledge_base(knowledge_base)

    patterns = [
        value for value in profile.get_error_patterns()
        if not (
            isinstance(value, dict)
            and value.get("_source") == "verified_learning_cycle"
            and value.get("_record_key") == record_key
        )
    ]
    if effect in ("partially_improved", "not_improved"):
        patterns.append({
            "knowledge_point": topic,
            "error_type": "本轮检测尚未完全达标",
            "frequency": "中" if effect == "partially_improved" else "高",
            "_auto_generated": True,
            "_source": "verified_learning_cycle",
            "_record_key": record_key,
            "_cycle_id": cycle_id,
        })
    profile.set_error_patterns(patterns)
    profile.update_source = "verified_learning_cycle"
    profile.last_updated = datetime.utcnow()

    result.update({
        "updated": True,
        "reason": "high_confidence_whitelist_applied",
        "record_key": record_key,
        "cycle_id": cycle_id,
        "profile": profile.to_dict(),
    })
    return result
