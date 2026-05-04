"""
数据导出任务

处理数据导出相关任务，包括：
- 数据查询和格式化
- Excel/CSV导出
- 报表生成
- 文件存储和下载链接生成
"""
import os
import time
import json
import csv
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from celery import shared_task

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# 导出文件存储路径
EXPORT_STORAGE_PATH = os.environ.get('EXPORT_STORAGE_PATH', 'exports')


@shared_task(bind=True, max_retries=3)
def export_data_task(self, model_name: str, filters: Optional[Dict[str, Any]] = None,
                    export_format: str = 'xlsx', fields: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    导出数据任务
    
    Args:
        model_name: 模型名称（如 'User', 'Course' 等）
        filters: 查询过滤条件
        export_format: 导出格式（xlsx, csv, json）
        fields: 要导出的字段列表
        
    Returns:
        导出结果，包含文件路径和下载链接
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 10, 'message': '准备导出数据'})
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{model_name}_export_{timestamp}.{export_format}"
        
        # 确保导出目录存在
        export_dir = os.path.join(EXPORT_STORAGE_PATH, model_name.lower())
        os.makedirs(export_dir, exist_ok=True)
        
        file_path = os.path.join(export_dir, filename)
        
        self.update_state(state='PROGRESS', meta={'progress': 30, 'message': '查询数据'})
        
        # 模拟数据查询（实际项目中从数据库查询）
        # 这里生成模拟数据
        data = generate_mock_data(model_name, filters, fields)
        
        self.update_state(state='PROGRESS', meta={'progress': 60, 'message': '格式化数据'})
        
        # 根据格式导出
        if export_format == 'xlsx':
            export_to_excel(data, file_path, fields)
        elif export_format == 'csv':
            export_to_csv(data, file_path, fields)
        elif export_format == 'json':
            export_to_json(data, file_path)
        else:
            raise ValueError(f'不支持的导出格式: {export_format}')
        
        self.update_state(state='PROGRESS', meta={'progress': 90, 'message': '生成下载链接'})
        
        # 生成下载链接（实际项目中应使用文件存储服务）
        download_url = f"/api/exports/download/{model_name.lower()}/{filename}"
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '导出完成'})
        
        return {
            'status': 'success',
            'message': '数据导出成功',
            'model': model_name,
            'format': export_format,
            'file_path': file_path,
            'download_url': download_url,
            'filename': filename,
            'record_count': len(data),
            'task_id': self.request.id,
            'created_at': datetime.now().isoformat()
        }
        
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc, countdown=60)
        
        return {
            'status': 'error',
            'message': f'导出失败: {str(exc)}',
            'model': model_name,
            'task_id': self.request.id
        }


@shared_task(bind=True, max_retries=2)
def generate_report_task(self, report_type: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    生成报表任务
    
    Args:
        report_type: 报表类型（如 'user_stats', 'course_stats', 'learning_progress'）
        params: 报表参数
        
    Returns:
        报表生成结果
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 10, 'message': '准备生成报表'})
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{report_type}_report_{timestamp}.xlsx"
        
        # 确保导出目录存在
        export_dir = os.path.join(EXPORT_STORAGE_PATH, 'reports')
        os.makedirs(export_dir, exist_ok=True)
        
        file_path = os.path.join(export_dir, filename)
        
        self.update_state(state='PROGRESS', meta={'progress': 40, 'message': '收集数据'})
        
        # 根据报表类型生成数据
        report_data = generate_report_data(report_type, params)
        
        self.update_state(state='PROGRESS', meta={'progress': 70, 'message': '生成报表文件'})
        
        # 生成Excel报表
        export_to_excel(report_data, file_path)
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '报表生成完成'})
        
        download_url = f"/api/reports/download/{filename}"
        
        return {
            'status': 'success',
            'message': '报表生成成功',
            'report_type': report_type,
            'file_path': file_path,
            'download_url': download_url,
            'filename': filename,
            'task_id': self.request.id,
            'created_at': datetime.now().isoformat()
        }
        
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc)
        
        return {
            'status': 'error',
            'message': f'报表生成失败: {str(exc)}',
            'report_type': report_type,
            'task_id': self.request.id
        }


@shared_task(bind=True)
def generate_weekly_report(self) -> Dict[str, Any]:
    """
    生成周报表（定时任务）
    
    Returns:
        周报表生成结果
    """
    # 计算上周时间范围
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    params = {
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'period': 'weekly'
    }
    
    return generate_report_task.delay('weekly_summary', params)


@shared_task(bind=True)
def cleanup_old_exports(self, days: int = 30) -> Dict[str, Any]:
    """
    清理旧的导出文件
    
    Args:
        days: 保留天数
        
    Returns:
        清理结果
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0
        
        if os.path.exists(EXPORT_STORAGE_PATH):
            for root, dirs, files in os.walk(EXPORT_STORAGE_PATH):
                for file in files:
                    file_path = os.path.join(root, file)
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    if file_mtime < cutoff_date:
                        os.remove(file_path)
                        deleted_count += 1
        
        return {
            'status': 'success',
            'message': f'清理完成，删除 {deleted_count} 个旧文件',
            'deleted_count': deleted_count,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'清理失败: {str(exc)}',
            'task_id': self.request.id
        }


# ============ 辅助函数 ============

def generate_mock_data(model_name: str, filters: Optional[Dict] = None, 
                       fields: Optional[List[str]] = None) -> List[Dict]:
    """生成模拟数据（实际项目中从数据库查询）"""
    
    if model_name == 'User':
        data = [
            {'id': i, 'username': f'user{i}', 'email': f'user{i}@example.com', 
             'role': 'student', 'created_at': datetime.now().isoformat()}
            for i in range(1, 101)
        ]
    elif model_name == 'Course':
        data = [
            {'id': i, 'title': f'课程{i}', 'description': f'这是课程{i}的描述',
             'teacher': f'教师{i}', 'created_at': datetime.now().isoformat()}
            for i in range(1, 51)
        ]
    else:
        data = [{'id': i, 'name': f'记录{i}'} for i in range(1, 21)]
    
    # 应用字段过滤
    if fields:
        data = [{k: v for k, v in item.items() if k in fields} for item in data]
    
    return data


def export_to_excel(data: List[Dict], file_path: str, fields: Optional[List[str]] = None):
    """导出为Excel格式"""
    try:
        import openpyxl
        from openpyxl import Workbook
        
        wb = Workbook()
        ws = wb.active
        
        if data:
            # 写入表头
            headers = fields if fields else list(data[0].keys())
            ws.append(headers)
            
            # 写入数据
            for item in data:
                row = [item.get(field, '') for field in headers]
                ws.append(row)
        
        wb.save(file_path)
    except ImportError:
        # 如果没有openpyxl，使用CSV格式
        csv_path = file_path.replace('.xlsx', '.csv')
        export_to_csv(data, csv_path, fields)


def export_to_csv(data: List[Dict], file_path: str, fields: Optional[List[str]] = None):
    """导出为CSV格式"""
    if data:
        headers = fields if fields else list(data[0].keys())
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)


def export_to_json(data: List[Dict], file_path: str):
    """导出为JSON格式"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def generate_report_data(report_type: str, params: Optional[Dict] = None) -> List[Dict]:
    """生成报表数据"""
    
    if report_type == 'user_stats':
        return [
            {'metric': '总用户数', 'value': 1000, 'change': '+5%'},
            {'metric': '活跃用户', 'value': 800, 'change': '+3%'},
            {'metric': '新注册用户', 'value': 50, 'change': '+10%'},
        ]
    elif report_type == 'course_stats':
        return [
            {'course': 'Python基础', 'students': 200, 'completion_rate': '85%'},
            {'course': 'Web开发', 'students': 150, 'completion_rate': '75%'},
            {'course': '数据分析', 'students': 100, 'completion_rate': '90%'},
        ]
    elif report_type == 'learning_progress':
        return [
            {'user': 'user1', 'course': 'Python基础', 'progress': '80%', 'last_active': '2024-01-15'},
            {'user': 'user2', 'course': 'Web开发', 'progress': '60%', 'last_active': '2024-01-14'},
        ]
    else:
        return [{'data': '示例数据'}]
