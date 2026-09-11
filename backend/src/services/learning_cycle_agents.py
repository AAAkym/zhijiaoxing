"""Explainable, deterministic agents for the personalized learning feedback cycle."""

from copy import deepcopy


class FeedbackAgent:
    name = "FeedbackAgent"

    def analyze(self, baseline, evidence):
        metrics = evidence.get("metrics", {})
        # Learning activity is useful context, but only assessed work supports a
        # mastery conclusion. Keep the two evidence scopes explicit.
        source_count = int(evidence.get("assessment_source_count", 0))
        sample_count = int(evidence.get("assessment_sample_count", 0))
        practice_score = metrics.get("practice_average_score")
        programming_rate = metrics.get("programming_pass_rate")
        completed_resources = metrics.get("completed_resources", 0)

        evidence_lines = []
        if practice_score is not None:
            evidence_lines.append(f"本轮练习平均分{practice_score}分")
        if programming_rate is not None:
            evidence_lines.append(f"本轮编程提交通过率{round(programming_rate * 100)}%")
        if metrics.get("mistake_count") is not None:
            evidence_lines.append(f"本轮新增错题{metrics['mistake_count']}条")
        evidence_lines.append(f"已完成{completed_resources}项学习资源")

        conflict = (
            practice_score is not None
            and programming_rate is not None
            and ((practice_score >= 80 and programming_rate < 0.5)
                 or (practice_score < 60 and programming_rate >= 0.8))
        )
        if sample_count < 2 or source_count == 0:
            effect = "evidence_insufficient"
            summary = "本轮证据不足，暂不判断是否掌握"
        elif conflict:
            effect = "evidence_conflict"
            summary = "练习与编程表现给出相反信号，本轮不形成单一掌握结论"
        elif practice_score is not None and practice_score >= 80 and (programming_rate is None or programming_rate >= 0.6):
            effect = "clearly_improved"
            summary = "本轮检测达到当前任务标准，可以进入迁移或进阶练习"
        elif (practice_score is not None and practice_score >= 60) or (programming_rate is not None and programming_rate >= 0.5):
            effect = "partially_improved"
            summary = "本轮已有部分改善，但仍需要针对剩余问题巩固"
        else:
            effect = "not_improved"
            summary = "已有足够证据，但当前任务目标尚未达到"

        confidence = min(95, source_count * 25 + min(sample_count, 9) * 6)
        remaining = []
        if practice_score is not None and practice_score < 80:
            remaining.append("练习正确率尚未达到80%")
        if programming_rate is not None and programming_rate < 0.6:
            remaining.append("编程任务独立通过仍不稳定")
        return {
            "agent": self.name,
            "learning_effect": effect,
            "summary": summary,
            "evidence": evidence_lines,
            "improvements": [] if effect in ("not_improved", "evidence_insufficient", "evidence_conflict") else [summary],
            "remaining_problems": remaining,
            "confidence_score": confidence,
            "baseline_reference": baseline.get("captured_at"),
        }


class ProfileUpdateAgent:
    name = "ProfileUpdateAgent"

    def propose(self, profile_before, feedback):
        effect = feedback.get("learning_effect")
        conclusion = {
            "clearly_improved": "当前知识点已达到本轮标准",
            "partially_improved": "当前知识点部分改善，仍需巩固",
            "not_improved": "当前知识点尚未达到本轮标准",
            "evidence_insufficient": "证据不足，保持原结论",
            "evidence_conflict": "证据存在冲突，保持原结论并安排复核",
        }.get(effect, "证据不足，保持原结论")
        return {
            "agent": self.name,
            "permanent_profile_write": False,
            "permanent_profile_write_policy": "仅在EvidenceReviewAgent确认高可信后写入客观白名单",
            "requested_writable_paths": [
                "knowledge_base._verified_learning_cycles",
                "error_patterns[_source=verified_learning_cycle]",
            ],
            "changes": [{
                "dimension": "current_knowledge_mastery",
                "before": "以发布前画像快照为准",
                "proposed": conclusion,
                "confidence": feedback.get("confidence_score", 0),
                "evidence": feedback.get("evidence", []),
            }],
            "reason": "先形成周期画像；只有高可信结论可更新知识掌握记录和自动易错点",
            "profile_reference": profile_before,
        }


class EvidenceReviewAgent:
    name = "EvidenceReviewAgent"

    def review(self, evidence, feedback, proposal):
        source_count = int(evidence.get("assessment_source_count", 0))
        sample_count = int(evidence.get("assessment_sample_count", 0))
        confidence = int(feedback.get("confidence_score", 0))
        has_conflict = feedback.get("learning_effect") == "evidence_conflict"
        high_confidence = source_count >= 2 and sample_count >= 5 and confidence >= 80 and not has_conflict
        evidence_sufficient = source_count >= 1 and sample_count >= 2
        decision = "conflict_review" if has_conflict else ("accepted_for_cycle" if evidence_sufficient else "observe_only")
        return {
            "agent": self.name,
            "passed": True,
            "decision": decision,
            "high_confidence": high_confidence,
            "permanent_profile_write": False,
            "checks": [
                {"name": "证据来源", "passed": source_count >= 1, "value": source_count},
                {"name": "有效样本", "passed": sample_count >= 2, "value": sample_count},
                {"name": "永久画像白名单", "passed": True, "value": "仅知识掌握记录和自动易错点"},
            ],
            "summary": "证据相互冲突，未改变画像结论" if has_conflict else ("周期画像已自动审核" if evidence_sufficient else "证据不足，保留为待观察结论"),
        }

    def build_profile_after(self, profile_before, proposal, review):
        return {
            "base_profile": deepcopy(profile_before),
            "cycle_observations": proposal.get("changes", []) if review.get("decision") == "accepted_for_cycle" else [],
            "status": review.get("decision"),
            "permanent_profile_updated": False,
        }


def build_next_strategy(feedback):
    effect = feedback.get("learning_effect")
    if effect == "clearly_improved":
        action = "减少基础重复讲解，增加迁移练习和综合项目"
        sequence = ["快速复习", "迁移练习", "综合项目"]
    elif effect == "partially_improved":
        action = "保留关键讲解，增加针对剩余错误的巩固练习"
        sequence = ["错误辨析", "巩固练习", "短检测"]
    elif effect == "not_improved":
        action = "降低单次难度，补充前置知识并使用分步提示"
        sequence = ["前置知识", "分步示例", "基础练习", "短检测"]
    elif effect == "evidence_conflict":
        action = "安排同知识点短检测并对照编程过程，先解决证据冲突"
        sequence = ["短检测", "编程过程复核", "证据复核"]
    else:
        action = "先安排短检测补充证据，不扩大画像结论"
        sequence = ["短检测", "证据复核"]
    return {
        "source": "learning_cycle",
        "action": action,
        "learning_sequence": sequence,
        "remaining_problems": feedback.get("remaining_problems", []),
    }
