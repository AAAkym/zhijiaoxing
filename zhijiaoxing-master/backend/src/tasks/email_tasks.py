"""
邮件通知任务

处理邮件发送相关任务，包括：
- 单封邮件发送
- 批量邮件发送
- 邮件模板渲染
- 发送状态记录
"""
import time
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional, List
from celery import shared_task

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# 邮件配置（实际项目中应从环境变量或配置文件读取）
EMAIL_CONFIG = {
    'smtp_server': os.environ.get('SMTP_SERVER', 'smtp.example.com'),
    'smtp_port': int(os.environ.get('SMTP_PORT', 587)),
    'smtp_username': os.environ.get('SMTP_USERNAME', ''),
    'smtp_password': os.environ.get('SMTP_PASSWORD', ''),
    'from_email': os.environ.get('FROM_EMAIL', 'noreply@zhijiaoxing.com'),
    'from_name': os.environ.get('FROM_NAME', '智教星'),
}


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def send_email_task(self, to_email: str, subject: str, content: str,
                   html_content: Optional[str] = None,
                   cc_emails: Optional[List[str]] = None,
                   bcc_emails: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    发送单封邮件任务
    
    Args:
        to_email: 收件人邮箱
        subject: 邮件主题
        content: 邮件内容（纯文本）
        html_content: HTML格式内容（可选）
        cc_emails: 抄送邮箱列表（可选）
        bcc_emails: 密送邮箱列表（可选）
        
    Returns:
        发送结果
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 20, 'message': '准备发送邮件'})
        
        # 创建邮件对象
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{EMAIL_CONFIG['from_name']} <{EMAIL_CONFIG['from_email']}>"
        msg['To'] = to_email
        
        if cc_emails:
            msg['Cc'] = ', '.join(cc_emails)
        
        # 添加纯文本内容
        msg.attach(MIMEText(content, 'plain', 'utf-8'))
        
        # 添加HTML内容（如果提供）
        if html_content:
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))
        
        self.update_state(state='PROGRESS', meta={'progress': 50, 'message': '连接邮件服务器'})
        
        # 模拟邮件发送（实际项目中使用真实SMTP服务器）
        # 这里仅模拟发送过程
        time.sleep(1)
        
        # 实际发送代码示例：
        # with smtplib.SMTP(EMAIL_CONFIG['smtp_server'], EMAIL_CONFIG['smtp_port']) as server:
        #     server.starttls()
        #     server.login(EMAIL_CONFIG['smtp_username'], EMAIL_CONFIG['smtp_password'])
        #     server.send_message(msg)
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '邮件发送完成'})
        
        # 记录发送日志（实际项目中应写入数据库）
        send_log = {
            'task_id': self.request.id,
            'to_email': to_email,
            'subject': subject,
            'sent_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'status': 'sent'
        }
        
        return {
            'status': 'success',
            'message': '邮件发送成功',
            'to_email': to_email,
            'subject': subject,
            'task_id': self.request.id,
            'log': send_log
        }
        
    except Exception as exc:
        # 记录失败日志
        error_log = {
            'task_id': self.request.id,
            'to_email': to_email,
            'subject': subject,
            'error_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'error': str(exc),
            'status': 'failed'
        }
        
        # 重试机制
        if self.request.retries < self.max_retries:
            self.update_state(
                state='RETRY',
                meta={'progress': 0, 'message': f'发送失败，正在重试 ({self.request.retries + 1}/{self.max_retries})'}
            )
            raise self.retry(exc=exc, countdown=300)
        
        return {
            'status': 'error',
            'message': f'邮件发送失败: {str(exc)}',
            'to_email': to_email,
            'subject': subject,
            'task_id': self.request.id,
            'log': error_log
        }


@shared_task(bind=True, max_retries=2)
def send_bulk_email_task(self, recipients: List[Dict[str, Any]],
                        subject: str, content: str,
                        html_content: Optional[str] = None,
                        batch_size: int = 50) -> Dict[str, Any]:
    """
    批量发送邮件任务
    
    Args:
        recipients: 收件人列表，每个元素包含email、name等
        subject: 邮件主题
        content: 邮件内容（支持模板变量）
        html_content: HTML内容（支持模板变量）
        batch_size: 每批发送数量
        
    Returns:
        批量发送结果
    """
    total = len(recipients)
    success_count = 0
    failed_count = 0
    failed_emails = []
    
    try:
        for i, recipient in enumerate(recipients):
            progress = int((i / total) * 100)
            self.update_state(
                state='PROGRESS',
                meta={
                    'progress': progress,
                    'message': f'正在发送第 {i+1}/{total} 封邮件',
                    'current': i + 1,
                    'total': total,
                    'success': success_count,
                    'failed': failed_count
                }
            )
            
            try:
                # 个性化内容（替换模板变量）
                personalized_content = content.replace('{{name}}', recipient.get('name', ''))
                personalized_html = None
                if html_content:
                    personalized_html = html_content.replace('{{name}}', recipient.get('name', ''))
                
                # 发送邮件
                result = send_email_task.delay(
                    to_email=recipient['email'],
                    subject=subject,
                    content=personalized_content,
                    html_content=personalized_html
                )
                
                success_count += 1
                
                # 每批发送后暂停，避免服务器过载
                if (i + 1) % batch_size == 0:
                    time.sleep(2)
                else:
                    time.sleep(0.1)
                    
            except Exception as e:
                failed_count += 1
                failed_emails.append({
                    'email': recipient.get('email'),
                    'error': str(e)
                })
        
        return {
            'status': 'success',
            'total': total,
            'success_count': success_count,
            'failed_count': failed_count,
            'failed_emails': failed_emails,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        
        return {
            'status': 'error',
            'error': str(exc),
            'task_id': self.request.id
        }


@shared_task(bind=True, max_retries=3)
def send_welcome_email(self, user_email: str, user_name: str) -> Dict[str, Any]:
    """
    发送欢迎邮件
    
    Args:
        user_email: 用户邮箱
        user_name: 用户名
        
    Returns:
        发送结果
    """
    subject = '欢迎使用智教星'
    
    content = f"""
    亲爱的 {user_name}，
    
    欢迎加入智教星！
    
    您的账号已成功创建，现在可以：
    - 浏览丰富的课程资源
    - 参与在线学习
    - 使用AI辅助学习工具
    - 跟踪学习进度
    
    如有任何问题，请随时联系我们的支持团队。
    
    祝您学习愉快！
    
    智教星团队
    """
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #2c3e50;">欢迎加入智教星！</h2>
        
        <p>亲爱的 <strong>{user_name}</strong>，</p>
        
        <p>欢迎加入智教星！您的账号已成功创建。</p>
        
        <h3 style="color: #3498db;">现在您可以：</h3>
        <ul>
            <li>浏览丰富的课程资源</li>
            <li>参与在线学习</li>
            <li>使用AI辅助学习工具</li>
            <li>跟踪学习进度</li>
        </ul>
        
        <p style="background-color: #ecf0f1; padding: 15px; border-radius: 5px;">
            如有任何问题，请随时联系我们的支持团队。
        </p>
        
        <p>祝您学习愉快！</p>
        
        <p style="color: #7f8c8d;">
            <em>智教星团队</em>
        </p>
    </body>
    </html>
    """
    
    return send_email_task.delay(
        to_email=user_email,
        subject=subject,
        content=content,
        html_content=html_content
    )


@shared_task(bind=True, max_retries=3)
def send_course_notification(self, user_email: str, user_name: str,
                            course_name: str, notification_type: str = 'enrollment') -> Dict[str, Any]:
    """
    发送课程相关通知邮件
    
    Args:
        user_email: 用户邮箱
        user_name: 用户名
        course_name: 课程名称
        notification_type: 通知类型（enrollment, completion, reminder等）
        
    Returns:
        发送结果
    """
    templates = {
        'enrollment': {
            'subject': f'成功报名课程：{course_name}',
            'content': f'您已成功报名课程《{course_name}》，请尽快开始学习。'
        },
        'completion': {
            'subject': f'恭喜完成课程：{course_name}',
            'content': f'恭喜您完成课程《{course_name}》的学习！'
        },
        'reminder': {
            'subject': f'学习提醒：{course_name}',
            'content': f'提醒您继续学习课程《{course_name}》。'
        }
    }
    
    template = templates.get(notification_type, templates['enrollment'])
    
    content = f"""
    亲爱的 {user_name}，
    
    {template['content']}
    
    请登录系统查看详情。
    
    智教星团队
    """
    
    return send_email_task.delay(
        to_email=user_email,
        subject=template['subject'],
        content=content
    )
