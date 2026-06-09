import json
import re
from datetime import datetime, timedelta

from src.models.user import db
from src.models.content_review import ContentReview, ReviewRule, ReviewOperationLog


class ContentReviewService:

    # ---- list & stats ----

    def get_review_list(self, filters=None):
        filters = filters or {}
        query = ContentReview.query

        status = filters.get('status')
        if status:
            query = query.filter(ContentReview.status == status)

        content_type = filters.get('content_type')
        if content_type:
            query = query.filter(ContentReview.content_type == content_type)

        source = filters.get('source')
        if source:
            query = query.filter(ContentReview.source == source)

        search = filters.get('search')
        if search:
            query = query.filter(ContentReview.content_title.ilike(f'%{search}%'))

        query = query.order_by(ContentReview.created_at.desc())

        page = int(filters.get('page', 1))
        per_page = int(filters.get('per_page', 10))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            'items': [r.to_dict(include_content=False) for r in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages,
        }

    def get_review_stats(self):
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        stats = {}
        for status in ['pending', 'auto_reviewing', 'manual_reviewing', 'spot_checking', 'passed', 'rejected']:
            stats[status] = ContentReview.query.filter(ContentReview.status == status).count()

        stats['today_reviewed'] = ContentReview.query.filter(
            ContentReview.reviewed_at >= today_start
        ).count()

        return stats

    # ---- submit ----

    def submit_for_review(self, content_id, content_type, content_title, content_body, source='ai', author_id=None):
        review = ContentReview(
            content_id=content_id,
            content_type=content_type,
            content_title=content_title,
            content_body=content_body or '',
            source=source,
            author_id=author_id,
            status='pending',
            review_mechanism='auto',
        )
        db.session.add(review)
        db.session.commit()

        self._log_operation(review.id, author_id, 'submit', f'提交审核: {content_title}')

        # trigger auto review
        self.auto_review(review.id)

        return review

    # ---- auto review ----

    def auto_review(self, review_id):
        review = ContentReview.query.get(review_id)
        if not review:
            return None

        review.status = 'auto_reviewing'
        db.session.commit()

        body = review.content_body or ''
        title = review.content_title or ''

        # --- scoring ---
        completeness = self._score_completeness(body)
        structure = self._score_structure(body)
        quality = self._score_quality(body)
        relevance = self._score_relevance(title, body)

        auto_score = round(completeness * 0.30 + structure * 0.20 + quality * 0.30 + relevance * 0.20, 2)

        result = {
            'completeness': round(completeness, 2),
            'structure': round(structure, 2),
            'quality': round(quality, 2),
            'relevance': round(relevance, 2),
            'details': [],
        }

        # check prohibited patterns
        issues = []
        if len(body) < 50:
            issues.append('内容长度不足50字符')
        for pattern in ['待补充', 'TODO', 'FIXME', '暂无内容', 'placeholder']:
            if pattern.lower() in body.lower():
                issues.append(f'包含占位文本: {pattern}')
        if re.search(r'#{1,6}\s*$', body, re.MULTILINE):
            issues.append('存在空标题')
        result['details'] = issues

        # determine threshold
        threshold = 60.0
        rule = ReviewRule.query.filter_by(rule_type='auto', enabled=True).first()
        if rule:
            threshold = rule.threshold

        if auto_score >= threshold and not issues:
            review.status = 'passed'
        else:
            review.status = 'manual_reviewing'

        review.auto_score = auto_score
        review.auto_review_result = json.dumps(result, ensure_ascii=False)
        review.auto_reviewed_at = datetime.utcnow()

        db.session.commit()

        self._log_operation(review.id, None, 'auto_review',
                            f'自动审核完成，评分: {auto_score}，状态: {review.status}')

        return review

    # ---- manual review ----

    def manual_review(self, review_id, reviewer_id, status, comment='', score=None):
        review = ContentReview.query.get(review_id)
        if not review:
            return None

        if status not in ('passed', 'rejected'):
            return None

        review.status = status
        review.reviewer_id = reviewer_id
        review.review_comment = comment
        review.review_score = score
        review.reviewed_at = datetime.utcnow()

        db.session.commit()

        self._log_operation(review.id, reviewer_id, status,
                            f'人工审核: {status}，评分: {score}，意见: {comment}')
        return review

    # ---- batch ----

    def batch_review(self, review_ids, action, reviewer_id, comment=''):
        if action not in ('approve', 'reject'):
            return 0

        status = 'passed' if action == 'approve' else 'rejected'
        count = 0
        for rid in review_ids:
            review = ContentReview.query.get(rid)
            if review and review.status in ('pending', 'auto_reviewing', 'manual_reviewing', 'spot_checking'):
                review.status = status
                review.reviewer_id = reviewer_id
                review.review_comment = comment
                review.reviewed_at = datetime.utcnow()
                count += 1
                self._log_operation(rid, reviewer_id, action,
                                    f'批量审核: {status}，意见: {comment}')

        db.session.commit()
        return count

    # ---- assign ----

    def assign_reviewer(self, review_id, reviewer_id):
        review = ContentReview.query.get(review_id)
        if not review:
            return None

        review.reviewer_id = reviewer_id
        if review.status == 'pending':
            review.status = 'manual_reviewing'

        db.session.commit()

        self._log_operation(review_id, reviewer_id, 'assign',
                            f'分配审核员: {reviewer_id}')
        return review

    # ---- rules ----

    def get_review_rules(self):
        rules = ReviewRule.query.all()
        if not rules:
            rules = self._create_default_rules()
        return [r.to_dict() for r in rules]

    def update_review_rule(self, rule_id, data):
        rule = ReviewRule.query.get(rule_id)
        if not rule:
            return None

        if 'enabled' in data:
            rule.enabled = data['enabled']
        if 'threshold' in data:
            rule.threshold = float(data['threshold'])
        if 'config' in data:
            rule.config = json.dumps(data['config'], ensure_ascii=False) if isinstance(data['config'], dict) else data['config']
        if 'name' in data:
            rule.name = data['name']
        if 'description' in data:
            rule.description = data['description']

        db.session.commit()
        return rule

    # ---- logs ----

    def get_operation_logs(self, filters=None):
        filters = filters or {}
        query = ReviewOperationLog.query

        action = filters.get('action')
        if action:
            query = query.filter(ReviewOperationLog.action == action)

        review_id = filters.get('review_id')
        if review_id:
            query = query.filter(ReviewOperationLog.review_id == review_id)

        query = query.order_by(ReviewOperationLog.created_at.desc())

        page = int(filters.get('page', 1))
        per_page = int(filters.get('per_page', 10))
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return {
            'items': [l.to_dict() for l in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages,
        }

    # ---- analytics ----

    def get_review_analytics(self):
        now = datetime.utcnow()

        # daily counts for last 7 days
        daily_counts = []
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            passed = ContentReview.query.filter(
                ContentReview.status == 'passed',
                ContentReview.reviewed_at >= day_start,
                ContentReview.reviewed_at < day_end,
            ).count()
            rejected = ContentReview.query.filter(
                ContentReview.status == 'rejected',
                ContentReview.reviewed_at >= day_start,
                ContentReview.reviewed_at < day_end,
            ).count()
            daily_counts.append({
                'date': day_start.strftime('%m-%d'),
                'passed': passed,
                'rejected': rejected,
            })

        # pass rate by content type
        content_types = ['knowledge_point', 'teaching_case', 'exercise', 'teaching_content']
        pass_rate_by_type = []
        for ct in content_types:
            total = ContentReview.query.filter(ContentReview.content_type == ct).count()
            passed = ContentReview.query.filter(
                ContentReview.content_type == ct,
                ContentReview.status == 'passed',
            ).count()
            pass_rate_by_type.append({
                'content_type': ct,
                'total': total,
                'passed': passed,
                'pass_rate': round(passed / total * 100, 1) if total > 0 else 0,
            })

        # average auto score
        avg_score_result = db.session.query(
            db.func.avg(ContentReview.auto_score)
        ).filter(ContentReview.auto_score.isnot(None)).scalar()
        avg_auto_score = round(float(avg_score_result), 2) if avg_score_result else 0

        # review mechanism distribution
        mechanism_dist = []
        for mech in ['auto', 'manual', 'spot_check']:
            count = ContentReview.query.filter(ContentReview.review_mechanism == mech).count()
            mechanism_dist.append({'mechanism': mech, 'count': count})

        return {
            'daily_counts': daily_counts,
            'pass_rate_by_type': pass_rate_by_type,
            'avg_auto_score': avg_auto_score,
            'mechanism_distribution': mechanism_dist,
        }

    # ---- versions ----

    def get_content_versions(self, content_id, content_type):
        reviews = ContentReview.query.filter_by(
            content_id=content_id,
            content_type=content_type,
        ).order_by(ContentReview.version.asc()).all()
        return [r.to_dict(include_content=True) for r in reviews]

    # ---- auto submit AI content ----

    def auto_submit_ai_content(self, course_id):
        submitted = 0

        # knowledge_points
        try:
            from src.models.knowledge_base import KnowledgePoint
            kps = KnowledgePoint.query.filter_by(course_id=course_id).all()
            for kp in kps:
                exists = ContentReview.query.filter_by(
                    content_id=kp.id,
                    content_type='knowledge_point',
                ).first()
                if not exists:
                    body = (kp.definition or '') + '\n' + (kp.content or '')
                    self.submit_for_review(
                        content_id=kp.id,
                        content_type='knowledge_point',
                        content_title=kp.title,
                        content_body=body,
                        source='ai',
                    )
                    submitted += 1
        except Exception:
            pass

        # teaching_cases
        try:
            from src.models.knowledge_base import TeachingCase
            cases = TeachingCase.query.filter_by(course_id=course_id).all()
            for case in cases:
                exists = ContentReview.query.filter_by(
                    content_id=case.id,
                    content_type='teaching_case',
                ).first()
                if not exists:
                    body = (case.background or '') + '\n' + (case.analysis or '') + '\n' + (case.solution or '')
                    self.submit_for_review(
                        content_id=case.id,
                        content_type='teaching_case',
                        content_title=case.title,
                        content_body=body,
                        source='ai',
                    )
                    submitted += 1
        except Exception:
            pass

        # exercises
        try:
            from src.models.knowledge_base import CourseExercise
            exercises = CourseExercise.query.filter_by(course_id=course_id).all()
            for ex in exercises:
                exists = ContentReview.query.filter_by(
                    content_id=ex.id,
                    content_type='exercise',
                ).first()
                if not exists:
                    body = (ex.content or '') + '\n' + (ex.answer_analysis or '')
                    self.submit_for_review(
                        content_id=ex.id,
                        content_type='exercise',
                        content_title=ex.title,
                        content_body=body,
                        source='ai',
                    )
                    submitted += 1
        except Exception:
            pass

        return submitted

    # ---- private helpers ----

    def _score_completeness(self, body):
        if not body:
            return 0
        score = 100.0
        if len(body) < 50:
            score -= 40
        elif len(body) < 100:
            score -= 20
        for pattern in ['待补充', 'TODO', 'FIXME', '暂无内容', 'placeholder']:
            if pattern.lower() in body.lower():
                score -= 15
        return max(0, min(100, score))

    def _score_structure(self, body):
        if not body:
            return 0
        score = 40.0  # base score for having content
        # headings
        if re.search(r'^#{1,6}\s', body, re.MULTILINE):
            score += 20
        # lists
        if re.search(r'^\s*[-*+]\s', body, re.MULTILINE) or re.search(r'^\s*\d+\.\s', body, re.MULTILINE):
            score += 15
        # code blocks
        if re.search(r'```', body):
            score += 15
        # paragraphs
        paragraphs = [p for p in body.split('\n\n') if p.strip()]
        if len(paragraphs) >= 3:
            score += 10
        return min(100, score)

    def _score_quality(self, body):
        if not body:
            return 0
        score = 70.0
        sentences = re.split(r'[。！？.!?]', body)
        sentences = [s.strip() for s in sentences if s.strip()]
        if sentences:
            avg_len = sum(len(s) for s in sentences) / len(sentences)
            if 10 <= avg_len <= 80:
                score += 15
            elif avg_len < 10:
                score -= 10
        # check for repetitive text
        if len(sentences) > 2:
            unique = set(sentences)
            if len(unique) < len(sentences) * 0.7:
                score -= 20
        return max(0, min(100, score))

    def _score_relevance(self, title, body):
        if not body or not title:
            return 50
        title_words = set(re.findall(r'\w+', title.lower()))
        body_lower = body.lower()
        if not title_words:
            return 50
        matched = sum(1 for w in title_words if w in body_lower)
        ratio = matched / len(title_words) if title_words else 0
        return round(ratio * 100, 2)

    def _log_operation(self, review_id, operator_id, action, detail=''):
        log = ReviewOperationLog(
            review_id=review_id,
            operator_id=operator_id,
            action=action,
            detail=detail,
        )
        db.session.add(log)
        db.session.commit()

    def _create_default_rules(self):
        defaults = [
            {'name': '内容完整性检查', 'rule_type': 'auto', 'enabled': True, 'threshold': 50, 'description': '检查内容长度和完整性'},
            {'name': '合规性评分', 'rule_type': 'auto', 'enabled': True, 'threshold': 60, 'description': '内容合规性最低分数'},
            {'name': '教育价值评估', 'rule_type': 'auto', 'enabled': True, 'threshold': 50, 'description': '教育适用性最低分数'},
            {'name': 'AI综合评分', 'rule_type': 'auto', 'enabled': True, 'threshold': 70, 'description': 'AI综合评分最低要求'},
            {'name': '格式规范检查', 'rule_type': 'auto', 'enabled': False, 'threshold': 0, 'description': '检查内容格式规范性'},
            {'name': '人工复核规则', 'rule_type': 'manual', 'enabled': True, 'threshold': 60, 'description': '自动审核低于此分数需人工复核'},
            {'name': '抽查审核规则', 'rule_type': 'spot_check', 'enabled': True, 'threshold': 80, 'description': '评分低于此阈值的内容需抽查'},
        ]
        rules = []
        for d in defaults:
            rule = ReviewRule(**d)
            db.session.add(rule)
            rules.append(rule)
        db.session.commit()
        return rules


content_review_service = ContentReviewService()
