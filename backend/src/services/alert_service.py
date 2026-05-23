"""
告警服务
支持多种告警通知渠道
"""
import json
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class AlertSeverity(Enum):
    """告警级别"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class AlertChannel(Enum):
    """告警渠道"""
    EMAIL = "email"
    WECHAT = "wechat"
    DINGTALK = "dingtalk"
    FEISHU = "feishu"
    SLACK = "slack"
    SMS = "sms"


class AlertService:
    """告警服务"""
    
    def __init__(self):
        self.webhook_urls = {
            AlertChannel.WECHAT: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send",
            AlertChannel.DINGTALK: "https://oapi.dingtalk.com/robot/send",
            AlertChannel.FEISHU: "https://open.feishu.cn/open-apis/bot/v2/hook/",
            AlertChannel.SLACK: ""
        }
    
    def send_alert(
        self,
        title: str,
        message: str,
        severity: AlertSeverity = AlertSeverity.WARNING,
        channels: List[AlertChannel] = None,
        extra_data: Dict[str, Any] = None
    ) -> Dict[str, bool]:
        """
        发送告警
        
        Args:
            title: 告警标题
            message: 告警消息
            severity: 告警级别
            channels: 通知渠道列表
            extra_data: 额外数据
        
        Returns:
            各渠道发送结果
        """
        if channels is None:
            channels = [AlertChannel.EMAIL]
        
        results = {}
        
        for channel in channels:
            try:
                if channel == AlertChannel.WECHAT:
                    results[channel.value] = self._send_wechat(title, message, severity, extra_data)
                elif channel == AlertChannel.DINGTALK:
                    results[channel.value] = self._send_dingtalk(title, message, severity, extra_data)
                elif channel == AlertChannel.FEISHU:
                    results[channel.value] = self._send_feishu(title, message, severity, extra_data)
                elif channel == AlertChannel.SLACK:
                    results[channel.value] = self._send_slack(title, message, severity, extra_data)
                elif channel == AlertChannel.SMS:
                    results[channel.value] = self._send_sms(message, extra_data)
                else:
                    results[channel.value] = False
            except Exception as e:
                results[channel.value] = False
                print(f"Failed to send alert via {channel.value}: {str(e)}")
        
        return results
    
    def _send_wechat(
        self,
        title: str,
        message: str,
        severity: AlertSeverity,
        extra_data: Dict[str, Any] = None
    ) -> bool:
        """发送企业微信通知"""
        webhook_key = extra_data.get('wechat_key') if extra_data else None
        if not webhook_key:
            return False
        
        url = f"{self.webhook_urls[AlertChannel.WECHAT]}?key={webhook_key}"
        
        # 根据级别设置颜色
        color_map = {
            AlertSeverity.CRITICAL: "red",
            AlertSeverity.WARNING: "yellow",
            AlertSeverity.INFO: "blue"
        }
        
        data = {
            "msgtype": "markdown",
            "markdown": {
                "content": f"""<font color=\"{color_map.get(severity, 'blue')}\">**{title}**</font>
                
> {message}

**时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**级别**: {severity.value}
"""
            }
        }
        
        response = requests.post(url, json=data, timeout=10)
        return response.status_code == 200
    
    def _send_dingtalk(
        self,
        title: str,
        message: str,
        severity: AlertSeverity,
        extra_data: Dict[str, Any] = None
    ) -> bool:
        """发送钉钉通知"""
        webhook_token = extra_data.get('dingtalk_token') if extra_data else None
        if not webhook_token:
            return False
        
        url = f"{self.webhook_urls[AlertChannel.DINGTALK]}?access_token={webhook_token}"
        
        # 根据级别设置表情
        emoji_map = {
            AlertSeverity.CRITICAL: "🚨",
            AlertSeverity.WARNING: "⚠️",
            AlertSeverity.INFO: "ℹ️"
        }
        
        data = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": f"""{emoji_map.get(severity, 'ℹ️')} **{title}**

{message}

---
时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
级别: {severity.value}
"""
            }
        }
        
        response = requests.post(url, json=data, timeout=10)
        return response.status_code == 200
    
    def _send_feishu(
        self,
        title: str,
        message: str,
        severity: AlertSeverity,
        extra_data: Dict[str, Any] = None
    ) -> bool:
        """发送飞书通知"""
        webhook_key = extra_data.get('feishu_key') if extra_data else None
        if not webhook_key:
            return False
        
        url = f"{self.webhook_urls[AlertChannel.FEISHU]}{webhook_key}"
        
        # 根据级别设置颜色
        color_map = {
            AlertSeverity.CRITICAL: "red",
            AlertSeverity.WARNING: "orange",
            AlertSeverity.INFO: "blue"
        }
        
        data = {
            "msg_type": "interactive",
            "card": {
                "config": {"wide_screen_mode": True},
                "header": {
                    "title": {
                        "tag": "plain_text",
                        "content": title
                    },
                    "template": color_map.get(severity, "blue")
                },
                "elements": [
                    {
                        "tag": "div",
                        "text": {
                            "tag": "lark_md",
                            "content": message
                        }
                    },
                    {
                        "tag": "note",
                        "elements": [
                            {
                                "tag": "plain_text",
                                "content": f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | 级别: {severity.value}"
                            }
                        ]
                    }
                ]
            }
        }
        
        response = requests.post(url, json=data, timeout=10)
        return response.status_code == 200
    
    def _send_slack(
        self,
        title: str,
        message: str,
        severity: AlertSeverity,
        extra_data: Dict[str, Any] = None
    ) -> bool:
        """发送 Slack 通知"""
        webhook_url = extra_data.get('slack_webhook') if extra_data else None
        if not webhook_url:
            return False
        
        # 根据级别设置颜色
        color_map = {
            AlertSeverity.CRITICAL: "#FF0000",
            AlertSeverity.WARNING: "#FFA500",
            AlertSeverity.INFO: "#0000FF"
        }
        
        data = {
            "attachments": [
                {
                    "color": color_map.get(severity, "#0000FF"),
                    "title": title,
                    "text": message,
                    "fields": [
                        {
                            "title": "Severity",
                            "value": severity.value,
                            "short": True
                        },
                        {
                            "title": "Time",
                            "value": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                            "short": True
                        }
                    ],
                    "footer": "智教星 Monitoring",
                    "ts": int(datetime.now().timestamp())
                }
            ]
        }
        
        response = requests.post(webhook_url, json=data, timeout=10)
        return response.status_code == 200
    
    def _send_sms(self, message: str, extra_data: Dict[str, Any] = None) -> bool:
        """发送短信通知（需要集成短信服务商）"""
        # 这里需要集成具体的短信服务商（如阿里云、腾讯云等）
        # 示例代码：
        phone_numbers = extra_data.get('phone_numbers', []) if extra_data else []
        if not phone_numbers:
            return False
        
        # TODO: 集成短信服务商 API
        # 例如阿里云短信服务、腾讯云短信服务等
        
        return True
    
    def send_system_alert(
        self,
        alert_type: str,
        description: str,
        severity: AlertSeverity = AlertSeverity.WARNING
    ):
        """
        发送系统告警
        
        Args:
            alert_type: 告警类型
            description: 告警描述
            severity: 告警级别
        """
        title = f"系统告警: {alert_type}"
        
        channels = [AlertChannel.EMAIL]
        if severity == AlertSeverity.CRITICAL:
            channels.extend([AlertChannel.WECHAT, AlertChannel.DINGTALK])
        
        return self.send_alert(
            title=title,
            message=description,
            severity=severity,
            channels=channels
        )
    
    def send_business_alert(
        self,
        business_type: str,
        metric_name: str,
        current_value: float,
        threshold: float,
        severity: AlertSeverity = AlertSeverity.WARNING
    ):
        """
        发送业务指标告警
        
        Args:
            business_type: 业务类型
            metric_name: 指标名称
            current_value: 当前值
            threshold: 阈值
            severity: 告警级别
        """
        title = f"业务告警: {business_type}"
        message = f"""
**指标**: {metric_name}
**当前值**: {current_value}
**阈值**: {threshold}
**状态**: {'超过' if current_value > threshold else '低于'}阈值
"""
        
        return self.send_alert(
            title=title,
            message=message,
            severity=severity,
            channels=[AlertChannel.EMAIL, AlertChannel.WECHAT]
        )


# 全局告警服务实例
alert_service = AlertService()
