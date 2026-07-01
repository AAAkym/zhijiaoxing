"""智能体执行记录持久化模型。

将 AgentMonitor 的内存态计数与历史转为数据库持久化，
确保服务重启后"累计工作次数/成功率/历史记录"不丢失。
"""
from datetime import datetime

from src.models.user import db


class AgentExecutionLog(db.Model):
    __tablename__ = 'agent_execution_logs'
    __table_args__ = (
        db.Index('idx_agent_exec_agent_created', 'agent_name', 'created_at'),
        db.Index('idx_agent_exec_status', 'status'),
        db.Index('idx_agent_exec_user', 'user_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    agent_name = db.Column(db.String(50), nullable=False)
    task_type = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(20), nullable=False)  # success / failed
    duration_ms = db.Column(db.Integer, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', backref='agent_execution_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'agent_name': self.agent_name,
            'task_type': self.task_type,
            'status': self.status,
            'duration_ms': self.duration_ms,
            'error_message': self.error_message,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
