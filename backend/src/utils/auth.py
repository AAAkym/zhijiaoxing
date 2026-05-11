from functools import wraps
from typing import Iterable

from flask import jsonify, session


def require_auth(f):
    """Require an authenticated Flask session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)

    return decorated_function


def require_role(roles: Iterable[str]):
    """Require the current user to have one of the allowed roles."""
    allowed_roles = set(roles)

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            if session.get('user_role') not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def require_admin(f):
    """Require an authenticated admin user."""
    return require_role(('admin',))(f)
