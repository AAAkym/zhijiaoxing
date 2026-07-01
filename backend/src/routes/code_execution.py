import subprocess
import tempfile
import os
import sys

from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
from src.utils.code_safety import validate_python_code_safety

code_execution_bp = Blueprint('code_execution', __name__)


@code_execution_bp.route('/code-execution/run', methods=['POST'])
@require_auth
def run_code():
    data = request.get_json()
    if not data or 'code' not in data:
        return jsonify({'error': '缺少代码参数', 'exit_code': 1}), 400

    code = data['code']
    language = data.get('language', 'python')

    # 仅支持 Python 在服务端直接执行；其他语言仅做语法保存，不在此端点执行
    if language != 'python':
        return jsonify({
            'error': f'暂不支持的语言: {language}',
            'exit_code': 1,
        }), 400

    # AST 白名单校验：禁止导入危险模块、调用 eval/exec 等、访问 __subclasses__ 等逃逸链属性
    safety_error = validate_python_code_safety(code)
    if safety_error:
        return jsonify({
            'error': f'代码包含危险操作，已被安全策略拦截：{safety_error}',
            'exit_code': 1,
        }), 403

    tmp_dir = tempfile.gettempdir()

    # 构建子进程环境变量，强制使用 UTF-8 编码输出，解决中文乱码问题
    env = os.environ.copy()
    env['PYTHONIOENCODING'] = 'utf-8'
    env['PYTHONUTF8'] = '1'
    env['LANG'] = 'en_US.UTF-8'

    # 使用 sys.executable 确保找到 Python 解释器
    python_executable = sys.executable or 'python'

    try:
        # 使用 -u 参数禁用输出缓冲，确保 UTF-8 输出立即刷新
        proc = subprocess.Popen(
            [python_executable, '-u', '-c', code],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=tmp_dir,
            env=env,
        )
        try:
            stdout, stderr = proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()
            return jsonify({
                'error': '执行超时（10秒限制）',
                'exit_code': -1,
            })

        # 使用 UTF-8 解码，errors='replace' 处理极端情况下的残留乱码
        output = stdout.decode('utf-8', errors='replace')
        error_output = stderr.decode('utf-8', errors='replace')

        if proc.returncode == 0:
            return jsonify({
                'output': output,
                'error': None,
                'exit_code': 0,
            })
        else:
            return jsonify({
                'output': output,
                'error': error_output,
                'exit_code': proc.returncode,
            })
    except Exception as e:
        return jsonify({
            'output': '',
            'error': str(e),
            'exit_code': 1,
        })
