import subprocess
import tempfile
import os

from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth

code_execution_bp = Blueprint('code_execution', __name__)

DANGEROUS_KEYWORDS = [
    'os.system',
    'os.remove',
    'os.rmdir',
    'subprocess',
    'socket',
    'requests',
    'urllib',
    'http',
    'shutil',
    'pickle',
    'eval',
    'exec',
    '__import__',
    'compile',
]


def _contains_dangerous_code(code):
    for keyword in DANGEROUS_KEYWORDS:
        if keyword in code:
            return True
    if "open(" in code and "'w'" in code:
        return True
    if "open(" in code and '"w"' in code:
        return True
    return False


@code_execution_bp.route('/code-execution/run', methods=['POST'])
@require_auth
def run_code():
    data = request.get_json()
    if not data or 'code' not in data:
        return jsonify({'error': '缺少代码参数', 'exit_code': 1}), 400

    code = data['code']

    if _contains_dangerous_code(code):
        return jsonify({
            'error': '代码包含危险操作，已被安全策略拦截',
            'exit_code': 1,
        }), 403

    tmp_dir = tempfile.gettempdir()

    try:
        proc = subprocess.Popen(
            ['python', '-c', code],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=tmp_dir,
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
