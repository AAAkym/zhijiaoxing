"""
代码安全校验工具

提供基于 AST 的 Python 代码安全校验，防止沙箱逃逸。
比正则表达式更难绕过：能识别 __import__('os')、getattr 等动态访问模式。
"""
import ast
import re
from typing import Optional


# 危险模块黑名单（导入即拦截，含其子模块如 os.path）
_DANGEROUS_MODULES = {
    'os', 'sys', 'subprocess', 'socket', 'shutil', 'pickle', 'ctypes',
    'multiprocessing', 'threading', 'signal', 'pty', 'posix', 'nt',
    'pathlib', 'importlib', 'imp', 'builtins', 'io',
    'http', 'urllib', 'xmlrpc', 'ftplib', 'smtplib', 'telnetlib',
    'socketserver', 'webbrowser', 'code', 'codeop', 'pdb', 'bdb',
    'platform', 'distutils', 'setuptools', 'ensurepip', 'venv',
    'cProfile', 'profile', 'pstats', 'timeit', 'trace', 'tracemalloc',
    'gc', 'inspect', 'symtable', 'tokenize', 'py_compile', 'compileall',
    'dis', 'pickletools', 'marshal', 'copyreg', 'ctypes',
}

# 危险内置函数/方法名（调用即拦截）
_DANGEROUS_BUILTINS = {
    'eval', 'exec', 'compile', '__import__', 'open', 'breakpoint',
    'globals', 'locals', 'vars',
    'getattr', 'setattr', 'delattr',
}

# 危险 dunder 属性（访问即拦截，防止逃逸链）
_DANGEROUS_DUNDERS = {
    '__class__', '__subclasses__', '__bases__', '__mro__', '__base__',
    '__builtins__', '__globals__', '__import__', '__code__',
    '__defaults__', '__closure__', '__dict__', '__module__',
    '__reduce__', '__reduce_ex__', '__getstate__', '__setstate__',
}


class _SafetyVisitor(ast.NodeVisitor):
    """遍历 AST 检测危险节点，收集违规列表。"""

    def __init__(self):
        self.violations = []

    def visit_Import(self, node):
        for alias in node.names:
            root_module = alias.name.split('.')[0]
            if alias.name in _DANGEROUS_MODULES or root_module in _DANGEROUS_MODULES:
                self.violations.append(f'禁止导入模块: {alias.name}')
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if node.module:
            root_module = node.module.split('.')[0]
            if node.module in _DANGEROUS_MODULES or root_module in _DANGEROUS_MODULES:
                self.violations.append(f'禁止从模块导入: {node.module}')
        self.generic_visit(node)

    def visit_Call(self, node):
        func_name = self._get_call_name(node.func)
        if func_name in _DANGEROUS_BUILTINS:
            self.violations.append(f'禁止调用: {func_name}()')
        self.generic_visit(node)

    def visit_Attribute(self, node):
        if node.attr in _DANGEROUS_DUNDERS:
            self.violations.append(f'禁止访问属性: {node.attr}')
        self.generic_visit(node)

    @staticmethod
    def _get_call_name(node):
        """提取调用表达式的函数名，支持 Name 与 Attribute 形式。"""
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            return node.attr
        return None


def validate_python_code_safety(code: str) -> Optional[str]:
    """
    校验 Python 代码安全性，返回错误消息或 None。

    使用 AST 解析检测危险操作，比正则更难绕过：
    - 禁止导入 os/sys/subprocess 等系统模块
    - 禁止调用 eval/exec/compile/__import__/open 等
    - 禁止访问 __subclasses__/__builtins__ 等 dunder 属性

    Args:
        code: 待校验的 Python 源代码

    Returns:
        错误消息字符串；若代码安全则返回 None
    """
    if not code or not code.strip():
        return '代码为空'

    try:
        tree = ast.parse(code)
    except SyntaxError:
        # 语法错误交由执行器处理，不在此拦截
        return None

    visitor = _SafetyVisitor()
    visitor.visit(tree)

    if visitor.violations:
        # 只返回第一条违规，避免泄露过多沙箱细节
        return visitor.violations[0]

    return None


def validate_js_code_safety(code: str) -> Optional[str]:
    """
    校验 JavaScript 代码安全性（基于正则）。

    Args:
        code: 待校验的 JavaScript 源代码

    Returns:
        错误消息字符串；若代码安全则返回 None
    """
    if not code or not code.strip():
        return '代码为空'

    forbidden_patterns = [
        r'\brequire\s*\(\s*[\'\"]fs[\'\"]',
        r'\brequire\s*\(\s*[\'\"]child_process[\'\"]',
        r'\brequire\s*\(\s*[\'\"]net[\'\"]',
        r'\brequire\s*\(\s*[\'\"]http[\'\"]',
        r'\brequire\s*\(\s*[\'\"]https[\'\"]',
        r'\brequire\s*\(\s*[\'\"]os[\'\"]',
        r'\brequire\s*\(\s*[\'\"]path[\'\"]',
        r'\brequire\s*\(\s*[\'\"]crypto[\'\"]',
        r'\bprocess\b',
        r'\beval\s*\(',
        r'\bFunction\s*\(',
    ]
    for pattern in forbidden_patterns:
        if re.search(pattern, code):
            return '代码包含不允许的操作'
    return None
