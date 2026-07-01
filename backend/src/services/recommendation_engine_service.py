import json
import logging
import re
from datetime import datetime, timedelta
from urllib.parse import quote
from src.models.user import db
from src.models.student_profile import StudentProfile
from src.models.learning_path import ResourceRecommendation
from src.models.knowledge_base import KnowledgePoint, CourseExercise, TeachingCase, CourseChapter
from src.models.course import Course, VideoLesson, LearningProgress, PracticeEvaluation, MistakeRecord
from src.services.spark_service import spark_service, is_configured as spark_is_configured

logger = logging.getLogger(__name__)


# 代码片段特征正则：描述若以这些模式开头，说明是代码而非文本描述
_CODE_PATTERN = re.compile(
    r'^\s*(def |class |import |from |public |private |function |var |let |const |'
    r'#include |int main|void main|print\(|console\.log|if __name__)',
    re.IGNORECASE,
)


def _is_low_quality_candidate(title, description):
    """判断候选资源是否为低质量（标题无意义或描述实为代码）。

    Args:
        title: 资源标题
        description: 资源描述

    Returns:
        True 表示低质量应跳过
    """
    if not title or not str(title).strip():
        return True
    # 纯数字或过短标题无意义
    title_str = str(title).strip()
    if title_str.isdigit() or len(title_str) < 2:
        return True
    # 描述实为代码片段（如 def sum_of_numbers():...），不适合作为推荐描述
    if description and _CODE_PATTERN.match(str(description)):
        return True
    return False

# Default dimension weights for profile-weighted matching
DEFAULT_DIMENSION_WEIGHTS = {
    'knowledge_base': 0.30,
    'cognitive_style': 0.15,
    'error_patterns': 0.20,
    'interest_areas': 0.15,
    'goal_orientation': 0.10,
    'learning_pace': 0.05,
    'interaction_preference': 0.05,
}

# Cognitive style -> preferred resource type mapping
COGNITIVE_STYLE_RESOURCE_MAP = {
    'visual': 'video',
    'auditory': 'video',
    'reading': 'document',
    'kinesthetic': 'case',
    'mixed': None,  # no strong preference
}

# Goal orientation -> preferred resource type mapping
GOAL_ORIENTATION_RESOURCE_MAP = {
    'exam': 'exercise',
    'career': 'case',
    'hobby': 'document',
    'research': 'document',
}

# Learning pace -> difficulty preference
PACE_DIFFICULTY_MAP = {
    'fast': 'advanced',
    'moderate': 'intermediate',
    'slow': 'basic',
    'adaptive': 'intermediate',
}

# Interaction preference -> recommendation style
INTERACTION_STYLE_MAP = {
    'guided': 'structured',
    'exploratory': 'diverse',
    'challenging': 'advanced',
}


def _safe_parse_json(value, default=None):
    """Safely parse a JSON field that may be a string or already-parsed object."""
    if value is None:
        return default if default is not None else {}
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default if default is not None else {}


class RecommendationEngineService:
    """Enhanced learning resource recommendation engine using student profile data
    for personalized matching across four resource types: document, video, exercise, case.
    """

    def __init__(self, dimension_weights=None):
        self.dimension_weights = dimension_weights or dict(DEFAULT_DIMENSION_WEIGHTS)

    # ------------------------------------------------------------------ #
    #  Main entry point
    # ------------------------------------------------------------------ #

    def generate_smart_recommendations(self, user_id, filters=None, limit=20):
        """Generate personalized resource recommendations for a user.

        Args:
            user_id: The user ID to generate recommendations for.
            filters: Optional dict with keys:
                - resource_type: str ('document'|'video'|'exercise'|'case')
                - difficulty_level: str ('basic'|'intermediate'|'advanced')
                - learning_objective: str (maps to goal_orientation)
            limit: Maximum number of recommendations to return (default 20).

        Returns:
            List of recommendation dicts, or dict with 'error' key on failure.
        """
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            # Fallback: generate basic recommendations without a profile
            return self._generate_fallback_recommendations(user_id, filters, limit)

        profile_data = profile.to_dict()

        # Collect all candidate resources from the four types
        candidates = []
        candidates.extend(self._collect_document_candidates(profile_data, filters))
        candidates.extend(self._collect_video_candidates(profile_data, filters))
        candidates.extend(self._collect_exercise_candidates(profile_data, filters))
        candidates.extend(self._collect_case_candidates(profile_data, filters))

        # If profile-driven candidates are too few, supplement with general resources
        if len(candidates) < limit:
            candidates.extend(self._collect_general_candidates(profile_data, filters, exclude_ids={c['id'] for c in candidates}))

        if not candidates:
            logger.warning("No candidate resources found for user %s", user_id)
            return []

        # Score each candidate against the profile
        scored = []
        for candidate in candidates:
            score_result = self._score_candidate(candidate, profile_data)
            scored.append((candidate, score_result))

        # Sort by relevance score descending
        scored.sort(key=lambda x: x[1]['relevance_score'], reverse=True)

        # Determine top-N
        top_n = scored[:limit]

        # Build ResourceRecommendation records
        recommendations = []
        for candidate, score_result in top_n:
            rec = self._build_recommendation(user_id, candidate, score_result, profile_data)
            recommendations.append(rec)

        # Apply filters to final list
        if filters:
            recommendations = self._apply_filters(recommendations, filters)

        # Persist to DB
        try:
            for rec in recommendations:
                db.session.add(rec)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to save recommendations for user %s: %s", user_id, e)
            return {"error": f"保存推荐失败: {str(e)}"}

        return [r.to_dict() for r in recommendations]

    # ------------------------------------------------------------------ #
    #  Candidate collection (4 resource types)
    # ------------------------------------------------------------------ #

    def _collect_document_candidates(self, profile_data, filters=None):
        """Collect document candidates from KnowledgePoint records."""
        candidates = []
        knowledge_base = profile_data.get('knowledge_base', {})
        if isinstance(knowledge_base, list):
            knowledge_base = {}

        weak_subjects = set()
        for subject, score in knowledge_base.items():
            if isinstance(score, (int, float)) and score < 70:
                weak_subjects.add(subject.lower())

        query = KnowledgePoint.query
        if filters and filters.get('difficulty_level'):
            query = query.filter_by(difficulty_level=filters['difficulty_level'])

        knowledge_points = query.limit(200).all()

        for kp in knowledge_points:
            kp_tags = _safe_parse_json(kp.tags, [])
            if not isinstance(kp_tags, list):
                kp_tags = []

            # Check if this knowledge point relates to weak subjects
            matches_weak = any(
                ws in (kp.title or '').lower() or ws in ' '.join(str(t) for t in kp_tags).lower()
                for ws in weak_subjects
            )

            candidates.append({
                'resource_type': 'document',
                'resource_id': kp.id,
                'title': kp.title or '',
                'description': (kp.definition or '') + '\n' + (kp.content[:200] if kp.content else ''),
                'url': kp.source_url,
                'difficulty': kp.difficulty_level or 'intermediate',
                'tags': kp_tags,
                'estimated_minutes': max(10, len(kp.content or '') // 200) if kp.content else 20,
                'source_model': 'KnowledgePoint',
                'matches_weak_knowledge': matches_weak,
                'knowledge_point_title': kp.title,
            })

        return candidates

    def _collect_video_candidates(self, profile_data, filters=None):
        """Collect video candidates from VideoLesson records."""
        candidates = []

        query = VideoLesson.query
        if filters and filters.get('difficulty_level'):
            pass  # VideoLesson doesn't have difficulty_level

        videos = query.limit(200).all()

        for v in videos:
            candidates.append({
                'resource_type': 'video',
                'resource_id': v.id,
                'title': v.title or '',
                'description': v.description or '',
                'url': v.video_url,
                'difficulty': 'intermediate',
                'tags': [v.title] if v.title else [],
                'estimated_minutes': int(v.duration // 60) if v.duration else 30,
                'source_model': 'VideoLesson',
                'matches_weak_knowledge': False,
                'knowledge_point_title': v.title,
            })

        return candidates

    def _collect_exercise_candidates(self, profile_data, filters=None):
        """Collect exercise candidates from CourseExercise records."""
        candidates = []
        error_patterns = profile_data.get('error_patterns', [])
        if not isinstance(error_patterns, list):
            error_patterns = []

        error_knowledge_points = set()
        for ep in error_patterns:
            if isinstance(ep, dict):
                point = ep.get('knowledge_point', '')
                if point:
                    error_knowledge_points.add(point.lower())

        query = CourseExercise.query
        if filters and filters.get('difficulty_level'):
            query = query.filter_by(difficulty_level=filters['difficulty_level'])

        exercises = query.limit(200).all()

        for ex in exercises:
            ex_tags = _safe_parse_json(ex.knowledge_tags, [])
            if not isinstance(ex_tags, list):
                ex_tags = []

            ex_title = ex.title or ''
            ex_desc = (ex.content[:200] if ex.content else '')
            # 跳过低质量候选（标题纯数字/过短、描述实为代码）
            if _is_low_quality_candidate(ex_title, ex_desc):
                continue

            matches_error = any(
                ekp in ex_title.lower() or ekp in ' '.join(str(t) for t in ex_tags).lower()
                for ekp in error_knowledge_points
            )

            candidates.append({
                'resource_type': 'exercise',
                'resource_id': ex.id,
                'title': ex_title,
                'description': ex_desc,
                'url': ex.source_url,
                'difficulty': ex.difficulty_level or 'intermediate',
                'tags': ex_tags,
                'estimated_minutes': ex.estimated_minutes or 10,
                'source_model': 'CourseExercise',
                'matches_error_pattern': matches_error,
                'knowledge_point_title': ex_title,
            })

        return candidates

    def _collect_case_candidates(self, profile_data, filters=None):
        """Collect case candidates from TeachingCase records."""
        candidates = []
        interest_areas = profile_data.get('interest_areas', [])
        if not isinstance(interest_areas, list):
            interest_areas = []

        interest_lower = [a.lower() for a in interest_areas if isinstance(a, str)]

        query = TeachingCase.query
        if filters and filters.get('difficulty_level'):
            query = query.filter_by(difficulty_level=filters['difficulty_level'])

        cases = query.limit(200).all()

        for tc in cases:
            tc_tags = _safe_parse_json(tc.tags, [])
            if not isinstance(tc_tags, list):
                tc_tags = []

            tc_title = tc.title or ''
            tc_desc = (tc.background or '')[:200] if tc.background else ''
            # 跳过低质量候选（标题纯数字/过短、描述实为代码）
            if _is_low_quality_candidate(tc_title, tc_desc):
                continue

            matches_interest = any(
                ia in tc_title.lower() or ia in ' '.join(str(t) for t in tc_tags).lower()
                for ia in interest_lower
            )

            candidates.append({
                'resource_type': 'case',
                'resource_id': tc.id,
                'title': tc_title,
                'description': tc_desc,
                'url': tc.source_url,
                'difficulty': tc.difficulty_level or 'intermediate',
                'tags': tc_tags,
                'estimated_minutes': 30,
                'source_model': 'TeachingCase',
                'matches_interest': matches_interest,
                'knowledge_point_title': tc_title,
            })

        return candidates

    def _collect_general_candidates(self, profile_data, filters=None, exclude_ids=None):
        """Supplement with general resources when profile-driven results are too few.
        Picks from all 4 types without requiring profile match, giving a baseline score."""
        if exclude_ids is None:
            exclude_ids = set()
        candidates = []

        # Documents - pick recent/important knowledge points
        doc_query = KnowledgePoint.query
        if filters and filters.get('difficulty_level'):
            doc_query = doc_query.filter_by(difficulty_level=filters['difficulty_level'])
        docs = doc_query.filter(~KnowledgePoint.id.in_(exclude_ids)).limit(10).all()
        for kp in docs:
            candidates.append({
                'resource_type': 'document', 'resource_id': kp.id,
                'title': kp.title or '', 'description': (kp.definition or '')[:200],
                'url': kp.source_url, 'difficulty': kp.difficulty_level or 'intermediate',
                'tags': _safe_parse_json(kp.tags, []),
                'estimated_minutes': 20, 'source_model': 'KnowledgePoint',
                'matches_interest': False, 'knowledge_point_title': kp.title,
                'is_general': True,
            })

        # Videos - pick from video lessons
        vid_query = VideoLesson.query
        videos = vid_query.filter(~VideoLesson.id.in_(exclude_ids)).limit(8).all()
        for vl in videos:
            candidates.append({
                'resource_type': 'video', 'resource_id': vl.id,
                'title': vl.title or '', 'description': (vl.description or '')[:200],
                'url': vl.video_url, 'difficulty': 'intermediate',
                'tags': [], 'estimated_minutes': (vl.duration or 600) // 60 or 15,
                'source_model': 'VideoLesson', 'matches_interest': False,
                'knowledge_point_title': vl.title, 'is_general': True,
            })

        # Exercises - pick varied exercises
        ex_query = CourseExercise.query
        if filters and filters.get('difficulty_level'):
            ex_query = ex_query.filter_by(difficulty_level=filters['difficulty_level'])
        exercises = ex_query.filter(~CourseExercise.id.in_(exclude_ids)).limit(8).all()
        for ex in exercises:
            candidates.append({
                'resource_type': 'exercise', 'resource_id': ex.id,
                'title': ex.title or '', 'description': (ex.content or '')[:200],
                'url': ex.source_url, 'difficulty': ex.difficulty_level or 'intermediate',
                'tags': _safe_parse_json(ex.knowledge_tags, []),
                'estimated_minutes': ex.estimated_minutes or 15,
                'source_model': 'CourseExercise', 'matches_interest': False,
                'knowledge_point_title': ex.title, 'is_general': True,
            })

        # Cases - pick varied cases
        case_query = TeachingCase.query
        if filters and filters.get('difficulty_level'):
            case_query = case_query.filter_by(difficulty_level=filters['difficulty_level'])
        cases = case_query.filter(~TeachingCase.id.in_(exclude_ids)).limit(6).all()
        for tc in cases:
            candidates.append({
                'resource_type': 'case', 'resource_id': tc.id,
                'title': tc.title or '', 'description': (tc.background or '')[:200],
                'url': tc.source_url, 'difficulty': tc.difficulty_level or 'intermediate',
                'tags': _safe_parse_json(tc.tags, []),
                'estimated_minutes': 30, 'source_model': 'TeachingCase',
                'matches_interest': False, 'knowledge_point_title': tc.title,
                'is_general': True,
            })

        return candidates

    # ------------------------------------------------------------------ #
    #  Profile-weighted scoring
    # ------------------------------------------------------------------ #

    def _score_candidate(self, candidate, profile_data):
        """Score a candidate resource against the student profile using
        weighted dimension matching.

        Returns dict with relevance_score and per-dimension match details.
        """
        weights = self.dimension_weights
        dimension_scores = {}
        match_reasons = {}

        # 1. Knowledge base dimension (30%)
        kb_score, kb_reason = self._score_knowledge_base(candidate, profile_data)
        dimension_scores['knowledge_base'] = kb_score
        match_reasons['knowledge_base'] = kb_reason

        # 2. Cognitive style dimension (15%)
        cs_score, cs_reason = self._score_cognitive_style(candidate, profile_data)
        dimension_scores['cognitive_style'] = cs_score
        match_reasons['cognitive_style'] = cs_reason

        # 3. Error patterns dimension (20%)
        ep_score, ep_reason = self._score_error_patterns(candidate, profile_data)
        dimension_scores['error_patterns'] = ep_score
        match_reasons['error_patterns'] = ep_reason

        # 4. Interest areas dimension (15%)
        ia_score, ia_reason = self._score_interest_areas(candidate, profile_data)
        dimension_scores['interest_areas'] = ia_score
        match_reasons['interest_areas'] = ia_reason

        # 5. Goal orientation dimension (10%)
        go_score, go_reason = self._score_goal_orientation(candidate, profile_data)
        dimension_scores['goal_orientation'] = go_score
        match_reasons['goal_orientation'] = go_reason

        # 6. Learning pace dimension (5%)
        lp_score, lp_reason = self._score_learning_pace(candidate, profile_data)
        dimension_scores['learning_pace'] = lp_score
        match_reasons['learning_pace'] = lp_reason

        # 7. Interaction preference dimension (5%)
        ip_score, ip_reason = self._score_interaction_preference(candidate, profile_data)
        dimension_scores['interaction_preference'] = ip_score
        match_reasons['interaction_preference'] = ip_reason

        # Compute weighted relevance score
        relevance_score = sum(
            weights.get(dim, 0) * dimension_scores.get(dim, 0)
            for dim in weights
        )
        relevance_score = round(min(max(relevance_score, 0.0), 1.0), 4)

        return {
            'relevance_score': relevance_score,
            'dimension_scores': dimension_scores,
            'match_reasons': match_reasons,
        }

    def _score_knowledge_base(self, candidate, profile_data):
        """Score based on knowledge base: match weak knowledge points (score < 70)."""
        knowledge_base = profile_data.get('knowledge_base', {})
        if isinstance(knowledge_base, list):
            knowledge_base = {}

        if not knowledge_base:
            return 0.3, '知识基础数据暂无，按默认匹配'

        weak_points = {
            k: v for k, v in knowledge_base.items()
            if isinstance(v, (int, float)) and v < 70
        }

        if not weak_points:
            return 0.5, '知识基础良好，无突出薄弱点'

        candidate_title = (candidate.get('title', '') or '').lower()
        candidate_tags = [str(t).lower() for t in candidate.get('tags', [])]
        candidate_text = candidate_title + ' ' + ' '.join(candidate_tags)

        best_match_score = 0.0
        matched_subject = None
        for subject, score in weak_points.items():
            subject_lower = subject.lower()
            if subject_lower in candidate_text or candidate_title in subject_lower:
                # The weaker the knowledge, the higher the match score
                match_val = (100 - score) / 100.0
                if match_val > best_match_score:
                    best_match_score = match_val
                    matched_subject = subject

        if candidate.get('matches_weak_knowledge') and best_match_score == 0:
            best_match_score = 0.6
            matched_subject = candidate.get('knowledge_point_title', '')

        if best_match_score > 0:
            reason = f'知识基础匹配：{matched_subject}掌握度不足70%，推荐相关资源补强'
            return min(best_match_score, 1.0), reason

        return 0.2, '该资源与当前薄弱知识点关联度较低'

    def _score_cognitive_style(self, candidate, profile_data):
        """Score based on cognitive style: visual→video, reading→document, kinesthetic→case."""
        cognitive_style = profile_data.get('cognitive_style', 'mixed')
        resource_type = candidate.get('resource_type', '')

        preferred_type = COGNITIVE_STYLE_RESOURCE_MAP.get(cognitive_style)

        if preferred_type is None:
            # mixed style: no strong preference, moderate score
            return 0.5, f'认知风格为混合型，各类资源均衡推荐'

        if resource_type == preferred_type:
            return 1.0, f'认知风格匹配：{cognitive_style}型学习者适合{resource_type}类资源'

        return 0.2, f'认知风格偏好{preferred_type}类资源，当前为{resource_type}类'

    def _score_error_patterns(self, candidate, profile_data):
        """Score based on error patterns: error knowledge points → corresponding exercises."""
        error_patterns = profile_data.get('error_patterns', [])
        if not isinstance(error_patterns, list):
            error_patterns = []

        if not error_patterns:
            return 0.3, '暂无易错点数据'

        error_knowledge_points = []
        for ep in error_patterns:
            if isinstance(ep, dict):
                point = ep.get('knowledge_point', '')
                freq = ep.get('frequency', '')
                if point:
                    error_knowledge_points.append((point, freq))

        if not error_knowledge_points:
            return 0.3, '暂无明确易错知识点'

        candidate_title = (candidate.get('title', '') or '').lower()
        candidate_tags = [str(t).lower() for t in candidate.get('tags', [])]
        candidate_text = candidate_title + ' ' + ' '.join(candidate_tags)

        best_match = 0.0
        matched_point = None
        for point, freq in error_knowledge_points:
            point_lower = point.lower()
            if point_lower in candidate_text or candidate_title in point_lower:
                match_val = 0.9 if freq == '高' else 0.7
                if match_val > best_match:
                    best_match = match_val
                    matched_point = point

        if candidate.get('matches_error_pattern') and best_match == 0:
            best_match = 0.6
            matched_point = candidate.get('knowledge_point_title', '')

        # Exercises get a bonus for error pattern matching
        if candidate.get('resource_type') == 'exercise' and best_match > 0:
            best_match = min(best_match * 1.2, 1.0)

        if best_match > 0:
            return best_match, f'易错点匹配：{matched_point}是你的易错知识点，推荐针对性练习'

        return 0.1, '该资源与易错知识点关联度较低'

    def _score_interest_areas(self, candidate, profile_data):
        """Score based on interest areas: interest tags match resource tags."""
        interest_areas = profile_data.get('interest_areas', [])
        if not isinstance(interest_areas, list):
            interest_areas = []

        if not interest_areas:
            return 0.3, '暂无兴趣领域数据'

        interest_lower = [a.lower() for a in interest_areas if isinstance(a, str)]
        candidate_title = (candidate.get('title', '') or '').lower()
        candidate_tags = [str(t).lower() for t in candidate.get('tags', [])]
        candidate_text = candidate_title + ' ' + ' '.join(candidate_tags)

        matched_interests = []
        for ia in interest_lower:
            if ia in candidate_text:
                matched_interests.append(ia)

        if candidate.get('matches_interest') and not matched_interests:
            matched_interests.append(candidate.get('knowledge_point_title', '').lower())

        if matched_interests:
            score = min(0.5 + 0.2 * len(matched_interests), 1.0)
            return score, f'兴趣匹配：{", ".join(matched_interests[:3])}是你的兴趣领域'

        return 0.2, '该资源与兴趣领域关联度较低'

    def _score_goal_orientation(self, candidate, profile_data):
        """Score based on goal orientation: exam→exercises, career→cases."""
        goal_orientation = profile_data.get('goal_orientation', 'exam')
        resource_type = candidate.get('resource_type', '')

        preferred_type = GOAL_ORIENTATION_RESOURCE_MAP.get(goal_orientation, 'exercise')

        if resource_type == preferred_type:
            return 1.0, f'目标导向匹配：{goal_orientation}目标适合{resource_type}类资源'

        return 0.3, f'目标导向偏好{preferred_type}类资源，当前为{resource_type}类'

    def _score_learning_pace(self, candidate, profile_data):
        """Score based on learning pace: fast→higher difficulty, slow→basic resources."""
        learning_pace = profile_data.get('learning_pace', 'moderate')
        candidate_difficulty = candidate.get('difficulty', 'intermediate')

        preferred_difficulty = PACE_DIFFICULTY_MAP.get(learning_pace, 'intermediate')

        difficulty_order = {'basic': 0, 'intermediate': 1, 'advanced': 2}
        pref_level = difficulty_order.get(preferred_difficulty, 1)
        cand_level = difficulty_order.get(candidate_difficulty, 1)

        if cand_level == pref_level:
            return 1.0, f'学习节奏匹配：{learning_pace}节奏适合{candidate_difficulty}难度资源'

        # Adjacent difficulty levels get partial score
        if abs(cand_level - pref_level) == 1:
            return 0.6, f'学习节奏部分匹配：{learning_pace}节奏偏好{preferred_difficulty}难度'

        return 0.2, f'学习节奏不匹配：偏好{preferred_difficulty}难度，当前为{candidate_difficulty}'

    def _score_interaction_preference(self, candidate, profile_data):
        """Score based on interaction preference: guided→structured, exploratory→diverse."""
        interaction_pref = profile_data.get('interaction_preference', 'guided')
        resource_type = candidate.get('resource_type', '')

        style = INTERACTION_STYLE_MAP.get(interaction_pref, 'structured')

        if style == 'structured':
            # Guided: prefer documents and exercises (structured content)
            if resource_type in ('document', 'exercise'):
                return 1.0, f'互动偏好匹配：引导型偏好适合结构化的{resource_type}资源'
            return 0.4, f'互动偏好部分匹配：引导型偏好更适合结构化资源'

        if style == 'diverse':
            # Exploratory: diverse types are all fine
            return 0.7, f'互动偏好匹配：探索型偏好适合多样化的{resource_type}资源'

        if style == 'advanced':
            # Challenging: prefer cases and advanced exercises
            if resource_type in ('case', 'exercise'):
                return 1.0, f'互动偏好匹配：挑战型偏好适合{resource_type}类资源'
            return 0.4, f'互动偏好部分匹配：挑战型偏好更适合案例和练习'

        return 0.5, '互动偏好一般匹配'

    # ------------------------------------------------------------------ #
    #  Build recommendation record
    # ------------------------------------------------------------------ #

    def _build_recommendation(self, user_id, candidate, score_result, profile_data):
        """Build a ResourceRecommendation from a scored candidate."""
        relevance_score = score_result['relevance_score']
        match_reasons = score_result['match_reasons']

        # Determine priority: 0=urgent, 1=important, 2=normal
        if relevance_score >= 0.8:
            priority = 0
        elif relevance_score >= 0.5:
            priority = 1
        else:
            priority = 2

        # Build reason fields
        reason_knowledge = match_reasons.get('knowledge_base', '')
        reason_progress = match_reasons.get('error_patterns', '')
        reason_ability = match_reasons.get('goal_orientation', '') + '；' + match_reasons.get('learning_pace', '')
        reason_interest = match_reasons.get('interest_areas', '') + '；' + match_reasons.get('cognitive_style', '')

        # Determine generated_by_agent based on resource type
        agent_map = {
            'document': 'document_agent',
            'video': 'media_agent',
            'exercise': 'exercise_agent',
            'case': 'case_agent',
        }

        rec = ResourceRecommendation(
            user_id=user_id,
            resource_type=candidate['resource_type'],
            resource_id=candidate.get('resource_id'),
            title=candidate.get('title', ''),
            description=candidate.get('description', '')[:500] if candidate.get('description') else '',
            url=candidate.get('url'),
            priority=priority,
            relevance_score=relevance_score,
            reason_knowledge=reason_knowledge,
            reason_progress=reason_progress,
            reason_ability=reason_ability,
            reason_interest=reason_interest,
            generated_by_agent=agent_map.get(candidate['resource_type'], 'recommendation_engine'),
            difficulty=candidate.get('difficulty', 'intermediate'),
            estimated_minutes=candidate.get('estimated_minutes', 30),
        )
        rec.set_tags(candidate.get('tags', []))

        return rec

    # ------------------------------------------------------------------ #
    #  Filter application
    # ------------------------------------------------------------------ #

    def _apply_filters(self, recommendations, filters):
        """Apply user-specified filters to the recommendation list."""
        filtered = recommendations

        if filters.get('resource_type'):
            rt = filters['resource_type']
            filtered = [r for r in filtered if r.resource_type == rt]

        if filters.get('difficulty_level'):
            dl = filters['difficulty_level']
            filtered = [r for r in filtered if r.difficulty == dl]

        if filters.get('learning_objective'):
            # Map learning_objective to goal_orientation and filter by related tags/reasons
            objective = filters['learning_objective']
            preferred_type = GOAL_ORIENTATION_RESOURCE_MAP.get(objective)
            if preferred_type:
                filtered = [r for r in filtered if r.resource_type == preferred_type]

        return filtered

    # ------------------------------------------------------------------ #
    #  Video search link generation
    # ------------------------------------------------------------------ #

    def generate_video_search_links(self, user_id, topic=None, knowledge_points=None):
        """Generate YouTube/Bilibili search URLs for online videos based on
        weak knowledge points and course topics.

        Uses LLM (spark_service) to generate search queries when available,
        falls back to direct knowledge point titles otherwise.

        Args:
            user_id: The user ID.
            topic: Optional topic string to search for directly.
            knowledge_points: Optional list of knowledge point strings to search.

        Returns:
            List of recommendation dicts, or dict with 'error' key on failure.
        """
        # If topic or knowledge_points are provided directly, use them
        if topic or knowledge_points:
            return self._generate_video_search_from_topic(user_id, topic, knowledge_points)

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            # Fallback: use course topics to generate video search links
            return self._generate_video_search_from_courses(user_id)

        profile_data = profile.to_dict()
        knowledge_base = profile_data.get('knowledge_base', {})
        if isinstance(knowledge_base, list):
            knowledge_base = {}

        # Identify weak knowledge points (score < 70)
        weak_points = [
            (k, v) for k, v in knowledge_base.items()
            if isinstance(v, (int, float)) and v < 70
        ]
        weak_points.sort(key=lambda x: x[1])

        if not weak_points:
            logger.info("No weak knowledge points found for user %s, using course topics for video search", user_id)
            return self._generate_video_search_from_courses(user_id)

        # Get course topics from user's enrolled courses
        progresses = LearningProgress.query.filter_by(user_id=user_id).all()
        course_ids = [lp.course_id for lp in progresses]
        courses = Course.query.filter(Course.id.in_(course_ids)).all() if course_ids else []
        course_titles = [c.title for c in courses if c.title]

        # Generate search queries
        search_queries = self._build_video_search_queries(weak_points, course_titles, user_id)

        if not search_queries:
            return []

        # Build search URLs and create recommendations
        recommendations = []
        for query_info in search_queries:
            query_text = query_info['query']
            encoded_query = quote(query_text)

            youtube_url = f"https://www.youtube.com/results?search_query={encoded_query}"
            bilibili_url = f"https://search.bilibili.com/all?keyword={encoded_query}"

            for platform, url in [('YouTube', youtube_url), ('Bilibili', bilibili_url)]:
                rec = ResourceRecommendation(
                    user_id=user_id,
                    resource_type='video',
                    title=f'{query_info.get("subject", query_text)} - {platform}搜索',
                    description=f'在{platform}上搜索"{query_text}"相关教学视频',
                    url=url,
                    priority=0 if query_info.get('urgency') == 'high' else 1,
                    relevance_score=query_info.get('score', 0.7),
                    reason_knowledge=f'知识基础匹配：{query_info.get("subject", "")}掌握度不足，推荐视频学习',
                    reason_progress=f'学习进度匹配：通过视频学习可更直观地理解{query_info.get("subject", "")}',
                    reason_ability=f'能力提升空间：视频学习有助于建立{query_info.get("subject", "")}的直观理解',
                    reason_interest=f'兴趣偏好匹配：视频资源适合多种认知风格的学习者',
                    generated_by_agent='video_search_agent',
                    difficulty='basic' if query_info.get('score', 0.7) > 0.8 else 'intermediate',
                    estimated_minutes=30,
                )
                rec.set_tags([query_info.get('subject', ''), '视频搜索', platform, '薄弱强化'])
                recommendations.append(rec)

        # Persist
        try:
            for rec in recommendations:
                db.session.add(rec)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to save video search links for user %s: %s", user_id, e)
            return {"error": f"保存视频搜索推荐失败: {str(e)}"}

        return [r.to_dict() for r in recommendations]

    def _build_video_search_queries(self, weak_points, course_titles, user_id=None):
        """Build search queries from weak knowledge points and course topics.

        Tries to use LLM for better query generation, falls back to direct titles.
        """
        queries = []

        # Try LLM-based query generation
        if spark_is_configured() and weak_points:
            try:
                weak_str = '、'.join([f'{k}({v}分)' for k, v in weak_points[:5]])
                course_str = '、'.join(course_titles[:3]) if course_titles else '暂无'

                prompt = f"""基于以下学生的薄弱知识点和课程信息，生成3-5个适合在视频网站搜索的教学视频关键词。
每个关键词应该简洁、具体，适合在YouTube或Bilibili上搜索教学视频。

薄弱知识点：{weak_str}
在学课程：{course_str}

请直接返回JSON数组格式，每个元素包含：
- "query": 搜索关键词（中文）
- "subject": 对应的知识点名称
- "urgency": "high"或"normal"（根据掌握度判断）

示例：[{{"query": "Python函数定义教程", "subject": "函数", "urgency": "high"}}]

只返回JSON数组，不要其他文字。"""

                response = spark_service.chat([
                    {"role": "system", "content": "你是一位教育搜索专家，擅长将学习需求转化为精准的视频搜索关键词。请只返回JSON数组。"},
                    {"role": "user", "content": prompt},
                ], user_id=user_id)

                if response and response.strip():
                    parsed = self._parse_json_response(response)
                    if isinstance(parsed, list):
                        for item in parsed:
                            if isinstance(item, dict) and item.get('query'):
                                # Calculate score based on urgency
                                score = 0.9 if item.get('urgency') == 'high' else 0.7
                                queries.append({
                                    'query': item['query'],
                                    'subject': item.get('subject', item['query']),
                                    'urgency': item.get('urgency', 'normal'),
                                    'score': score,
                                })
            except Exception as e:
                logger.warning("LLM video query generation failed for user %s: %s", user_id, e)

        # Fallback: use weak point titles directly
        if not queries:
            for subject, score_val in weak_points[:5]:
                urgency = 'high' if score_val < 40 else 'normal'
                relevance = (100 - score_val) / 100.0
                queries.append({
                    'query': f'{subject} 教程',
                    'subject': subject,
                    'urgency': urgency,
                    'score': round(relevance, 2),
                })

        return queries

    def _generate_fallback_recommendations(self, user_id, filters=None, limit=20):
        """Generate basic recommendations for users without a StudentProfile.

        Uses course content (knowledge points, exercises, teaching cases)
        to provide useful recommendations.
        """
        candidates = []

        # Collect knowledge points as document candidates
        kp_query = KnowledgePoint.query.filter_by(status='published')
        if filters and filters.get('difficulty_level'):
            kp_query = kp_query.filter_by(difficulty_level=filters['difficulty_level'])
        for kp in kp_query.limit(limit).all():
            candidates.append({
                'id': f'kp_{kp.id}',
                'resource_type': 'document',
                'title': kp.title,
                'description': kp.definition or kp.content[:200] if kp.content else '',
                'difficulty': kp.difficulty_level or 'intermediate',
                'url': '',
                'tags': json.loads(kp.tags) if kp.tags else [],
                'source': 'knowledge_point',
                'relevance_score': 0.6,
            })

        # Collect exercises as exercise candidates
        ex_query = CourseExercise.query.filter_by(status='published')
        if filters and filters.get('difficulty_level'):
            ex_query = ex_query.filter_by(difficulty_level=filters['difficulty_level'])
        for ex in ex_query.limit(limit).all():
            candidates.append({
                'id': f'ex_{ex.id}',
                'resource_type': 'exercise',
                'title': ex.title,
                'description': ex.content[:200] if ex.content else '',
                'difficulty': ex.difficulty_level or 'intermediate',
                'url': '',
                'tags': json.loads(ex.knowledge_tags) if ex.knowledge_tags else [],
                'source': 'course_exercise',
                'relevance_score': 0.65,
            })

        # Collect teaching cases as case candidates
        tc_query = TeachingCase.query.filter_by(status='published')
        for tc in tc_query.limit(limit).all():
            candidates.append({
                'id': f'tc_{tc.id}',
                'resource_type': 'case',
                'title': tc.title,
                'description': tc.background[:200] if tc.background else '',
                'difficulty': tc.difficulty_level or 'intermediate',
                'url': tc.source_url or '',
                'tags': json.loads(tc.tags) if tc.tags else [],
                'source': 'teaching_case',
                'relevance_score': 0.7,
            })

        # Collect video lessons as video candidates
        vl_query = VideoLesson.query.filter_by(status='published')
        for vl in vl_query.limit(limit).all():
            candidates.append({
                'id': f'vl_{vl.id}',
                'resource_type': 'video',
                'title': vl.title,
                'description': vl.description or '',
                'difficulty': 'intermediate',
                'url': vl.video_url or '',
                'tags': [],
                'source': 'video_lesson',
                'relevance_score': 0.75,
            })

        # Apply resource_type filter
        if filters and filters.get('resource_type'):
            candidates = [c for c in candidates if c['resource_type'] == filters['resource_type']]

        # Sort by relevance and take top N
        candidates.sort(key=lambda x: x['relevance_score'], reverse=True)
        top_n = candidates[:limit]

        # Build and persist recommendations
        recommendations = []
        for candidate in top_n:
            rec = ResourceRecommendation(
                user_id=user_id,
                resource_type=candidate['resource_type'],
                resource_id=None,
                title=candidate['title'],
                description=candidate.get('description', ''),
                url=candidate.get('url', ''),
                priority=1,
                relevance_score=candidate.get('relevance_score', 0.5),
                reason_knowledge='基于课程内容的通用推荐',
                reason_progress='适合当前学习阶段',
                reason_ability='有助于提升编程能力',
                reason_interest='与课程主题相关',
                generated_by_agent='fallback_recommender',
                difficulty=candidate.get('difficulty', 'intermediate'),
                estimated_minutes=30,
            )
            if candidate.get('tags'):
                rec.set_tags(candidate['tags'])
            recommendations.append(rec)

        try:
            for rec in recommendations:
                db.session.add(rec)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to save fallback recommendations for user %s: %s", user_id, e)
            return {"error": f"保存推荐失败: {str(e)}"}

        return [r.to_dict() for r in recommendations]

    def _generate_video_search_from_topic(self, user_id, topic=None, knowledge_points=None):
        """Generate video search links from a specific topic or knowledge points."""
        search_items = []
        if topic:
            search_items.append({'query': f'{topic} 教程', 'subject': topic, 'urgency': 'normal', 'score': 0.8})
        if knowledge_points:
            for kp in knowledge_points[:5]:
                search_items.append({'query': f'{kp} 教程', 'subject': kp, 'urgency': 'normal', 'score': 0.75})

        if not search_items:
            return self._generate_video_search_from_courses(user_id)

        recommendations = []
        for query_info in search_items:
            query_text = query_info['query']
            encoded_query = quote(query_text)
            youtube_url = f"https://www.youtube.com/results?search_query={encoded_query}"
            bilibili_url = f"https://search.bilibili.com/all?keyword={encoded_query}"

            for platform, url in [('YouTube', youtube_url), ('Bilibili', bilibili_url)]:
                rec = ResourceRecommendation(
                    user_id=user_id,
                    resource_type='video',
                    title=f'{query_info.get("subject", query_text)} - {platform}搜索',
                    description=f'在{platform}上搜索"{query_text}"相关教学视频',
                    url=url,
                    priority=1,
                    relevance_score=query_info.get('score', 0.7),
                    reason_knowledge=f'知识匹配：{query_info.get("subject", "")}相关视频',
                    reason_progress='通过视频学习更直观',
                    reason_ability='视频资源有助于建立直观理解',
                    reason_interest='视频适合多种学习风格',
                    generated_by_agent='video_search_agent',
                    difficulty='intermediate',
                    estimated_minutes=30,
                )
                rec.set_tags([query_info.get('subject', ''), '视频搜索', platform])
                recommendations.append(rec)

        try:
            for rec in recommendations:
                db.session.add(rec)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to save video search links for user %s: %s", user_id, e)
            return {"error": f"保存视频搜索推荐失败: {str(e)}"}

        return [r.to_dict() for r in recommendations]

    def _generate_video_search_from_courses(self, user_id):
        """Generate video search links based on user's course topics when no profile or weak points."""
        # Get user's enrolled courses via LearningProgress
        progresses = LearningProgress.query.filter_by(user_id=user_id).all()
        course_ids = [lp.course_id for lp in progresses]

        # If no enrolled courses, get all active courses
        if not course_ids:
            courses = Course.query.filter_by(status='active').limit(3).all()
        else:
            courses = Course.query.filter(Course.id.in_(course_ids)).all()

        if not courses:
            logger.info("No courses found for video search, user %s", user_id)
            return []

        course_titles = [c.title for c in courses if c.title]

        # Get knowledge points from these courses as search topics
        kp_topics = []
        for course in courses:
            kps = KnowledgePoint.query.filter_by(course_id=course.id, status='published').limit(3).all()
            for kp in kps:
                kp_topics.append({'query': f'{kp.title} 教程', 'subject': kp.title, 'score': 0.7})

        # If no knowledge points, use course titles directly
        if not kp_topics:
            for title in course_titles[:5]:
                kp_topics.append({'query': f'{title} 教程', 'subject': title, 'score': 0.7})

        if not kp_topics:
            return []

        # Limit to top 5
        kp_topics = kp_topics[:5]

        recommendations = []
        for query_info in kp_topics:
            query_text = query_info['query']
            encoded_query = quote(query_text)
            youtube_url = f"https://www.youtube.com/results?search_query={encoded_query}"
            bilibili_url = f"https://search.bilibili.com/all?keyword={encoded_query}"

            for platform, url in [('YouTube', youtube_url), ('Bilibili', bilibili_url)]:
                rec = ResourceRecommendation(
                    user_id=user_id,
                    resource_type='video',
                    title=f'{query_info.get("subject", query_text)} - {platform}搜索',
                    description=f'在{platform}上搜索"{query_text}"相关教学视频',
                    url=url,
                    priority=1,
                    relevance_score=query_info.get('score', 0.7),
                    reason_knowledge=f'课程相关：{query_info.get("subject", "")}视频学习资源',
                    reason_progress='通过视频学习可以更直观地理解知识点',
                    reason_ability='视频资源有助于建立知识的直观理解',
                    reason_interest='视频适合多种认知风格的学习者',
                    generated_by_agent='video_search_agent',
                    difficulty='intermediate',
                    estimated_minutes=30,
                )
                rec.set_tags([query_info.get('subject', ''), '视频搜索', platform, '课程推荐'])
                recommendations.append(rec)

        try:
            for rec in recommendations:
                db.session.add(rec)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error("Failed to save course-based video search links for user %s: %s", user_id, e)
            return {"error": f"保存视频搜索推荐失败: {str(e)}"}

        return [r.to_dict() for r in recommendations]

    def _parse_json_response(self, response):
        """Parse a JSON response from LLM, handling markdown code blocks."""
        if not response:
            return None

        json_str = response.strip()

        # Strip markdown code blocks
        if '```json' in json_str:
            try:
                json_str = json_str.split('```json')[1].split('```')[0].strip()
            except IndexError:
                pass
        elif '```' in json_str:
            try:
                json_str = json_str.split('```')[1].split('```')[0].strip()
            except IndexError:
                pass

        json_str = json_str.strip()
        if json_str.startswith('```'):
            json_str = json_str[3:]
        if json_str.endswith('```'):
            json_str = json_str[:-3]
        json_str = json_str.strip()

        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Try to find JSON array in the response
        import re
        bracket_match = re.search(r'\[[\s\S]*\]', json_str)
        if bracket_match:
            try:
                return json.loads(bracket_match.group())
            except json.JSONDecodeError:
                pass

        return None

    # ------------------------------------------------------------------ #
    #  Effectiveness tracking
    # ------------------------------------------------------------------ #

    def get_effectiveness_stats(self, user_id):
        """Analyze recommendation effectiveness for a user.

        Returns stats on completion rate, avg feedback score, and dismiss rate
        broken down by resource type.
        """
        all_recs = ResourceRecommendation.query.filter_by(user_id=user_id).all()

        if not all_recs:
            return {
                'user_id': user_id,
                'total_recommendations': 0,
                'by_type': {},
                'overall': {
                    'completion_rate': 0.0,
                    'avg_feedback_score': 0.0,
                    'dismiss_rate': 0.0,
                },
            }

        resource_types = set(r.resource_type for r in all_recs)
        by_type = {}

        for rt in resource_types:
            type_recs = [r for r in all_recs if r.resource_type == rt]
            total = len(type_recs)
            completed = sum(1 for r in type_recs if r.is_completed)
            dismissed = sum(1 for r in type_recs if r.is_dismissed)
            feedback_scores = [r.feedback_score for r in type_recs if r.feedback_score is not None]

            by_type[rt] = {
                'total': total,
                'completed': completed,
                'dismissed': dismissed,
                'completion_rate': round(completed / total, 4) if total > 0 else 0.0,
                'dismiss_rate': round(dismissed / total, 4) if total > 0 else 0.0,
                'avg_feedback_score': round(sum(feedback_scores) / len(feedback_scores), 2) if feedback_scores else 0.0,
            }

        total_all = len(all_recs)
        completed_all = sum(1 for r in all_recs if r.is_completed)
        dismissed_all = sum(1 for r in all_recs if r.is_dismissed)
        feedback_all = [r.feedback_score for r in all_recs if r.feedback_score is not None]

        return {
            'user_id': user_id,
            'total_recommendations': total_all,
            'by_type': by_type,
            'overall': {
                'completion_rate': round(completed_all / total_all, 4) if total_all > 0 else 0.0,
                'avg_feedback_score': round(sum(feedback_all) / len(feedback_all), 2) if feedback_all else 0.0,
                'dismiss_rate': round(dismissed_all / total_all, 4) if total_all > 0 else 0.0,
            },
        }

    def adjust_weights_from_feedback(self, user_id):
        """Dynamically adjust dimension weights based on user feedback data.

        Increases weights for dimensions whose recommended resources receive
        positive feedback, and decreases weights for dimensions whose resources
        are frequently dismissed.

        Returns the adjusted weights dict.
        """
        stats = self.get_effectiveness_stats(user_id)
        by_type = stats.get('by_type', {})

        if not by_type:
            return dict(self.dimension_weights)

        # Map resource types to the dimensions that primarily drive them
        type_to_dimensions = {
            'document': ['knowledge_base', 'interest_areas'],
            'video': ['cognitive_style', 'knowledge_base'],
            'exercise': ['error_patterns', 'goal_orientation'],
            'case': ['interest_areas', 'goal_orientation'],
        }

        # Calculate adjustment factors per dimension
        dimension_adjustments = {}
        for dim in self.dimension_weights:
            dimension_adjustments[dim] = 0.0

        for rt, type_stats in by_type.items():
            dimensions = type_to_dimensions.get(rt, [])
            if not dimensions:
                continue

            completion_rate = type_stats.get('completion_rate', 0.0)
            dismiss_rate = type_stats.get('dismiss_rate', 0.0)
            avg_feedback = type_stats.get('avg_feedback_score', 0.0)

            # Positive signal: high completion rate and feedback
            # Negative signal: high dismiss rate
            adjustment = 0.0
            if completion_rate > 0.5:
                adjustment += 0.05
            if avg_feedback >= 4:
                adjustment += 0.05
            elif avg_feedback >= 3:
                adjustment += 0.02
            if dismiss_rate > 0.3:
                adjustment -= 0.05
            elif dismiss_rate > 0.5:
                adjustment -= 0.1

            for dim in dimensions:
                dimension_adjustments[dim] = dimension_adjustments.get(dim, 0.0) + adjustment

        # Apply adjustments to weights
        new_weights = {}
        for dim, weight in self.dimension_weights.items():
            adj = dimension_adjustments.get(dim, 0.0)
            new_weight = weight + adj
            # Clamp between 0.01 and 0.50
            new_weight = max(0.01, min(0.50, new_weight))
            new_weights[dim] = new_weight

        # Normalize so weights sum to 1.0
        total = sum(new_weights.values())
        if total > 0:
            new_weights = {k: round(v / total, 4) for k, v in new_weights.items()}

        self.dimension_weights = new_weights
        return new_weights

    # ------------------------------------------------------------------ #
    #  Integration with existing RecommendationEngine
    # ------------------------------------------------------------------ #

    def complete_recommendation(self, user_id, rec_id):
        """Mark a recommendation as completed. Delegates to existing engine."""
        from src.services.learning_path_service import recommendation_engine
        return recommendation_engine.complete_recommendation(user_id, rec_id)

    def dismiss_recommendation(self, user_id, rec_id):
        """Dismiss a recommendation. Delegates to existing engine."""
        from src.services.learning_path_service import recommendation_engine
        return recommendation_engine.dismiss_recommendation(user_id, rec_id)

    def feedback_recommendation(self, user_id, rec_id, score):
        """Provide feedback on a recommendation. Delegates to existing engine."""
        from src.services.learning_path_service import recommendation_engine
        return recommendation_engine.feedback_recommendation(user_id, rec_id, score)

    def get_recommendations(self, user_id, resource_type=None, priority=None):
        """Get existing recommendations with optional filters. Delegates to existing engine."""
        from src.services.learning_path_service import recommendation_engine
        return recommendation_engine.get_recommendations(user_id, resource_type, priority)


# Singleton instance
recommendation_engine_service = RecommendationEngineService()
