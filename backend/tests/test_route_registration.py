"""路由注册回归测试。

背景：``main.py`` 的 SPA 兜底路由曾把**所有未匹配路径**（含 ``/api/*``）都返回
200 + index.html，导致"路由未注册"与"接口正常"在 HTTP 层面无法区分，掩盖了
"后端未重启 / blueprint 未挂载"这类故障。

因此本文件的断言一律以**运行态 url_map 与显式 Content-Type** 为准，不以页面
表现或裸 200 状态码为准。
"""

BASE_PATH = "/api"


def _rule_strings(app):
    return {str(rule) for rule in app.url_map.iter_rules()}


def test_class_learning_groups_route_is_registered(app):
    """新路由必须真的注册进 url_map —— 无需启动服务即可发现"路由没注册"。"""
    rules = _rule_strings(app)

    assert "/api/classes/<int:class_id>/learning-groups" in rules


def test_student_resource_basis_route_is_registered(app):
    """学生端资源依据路由同样必须在 url_map 中。"""
    rules = _rule_strings(app)

    assert (
        "/api/student/personalized-deliveries/<string:delivery_id>"
        "/resources/<string:resource_key>/basis"
    ) in rules


def test_agent_execution_history_route_is_registered(app):
    """今夜新增的智能体执行历史端点同样必须在 url_map 中。"""
    rules = _rule_strings(app)

    assert "/api/resource-generation/agents/history" in rules


def test_agent_execution_history_route_resolves_to_json_not_spa_fallback(client):
    """已注册的 API 路由即使鉴权失败，也必须返回 JSON，绝不能落到 SPA 兜底。"""
    response = client.get("/api/resource-generation/agents/history")

    assert response.status_code == 401
    assert response.is_json
    assert not response.get_data(as_text=True).lstrip().startswith("<!DOCTYPE")


def test_learning_groups_route_resolves_to_json_not_spa_fallback(client):
    """已注册的 API 路由即使鉴权失败，也必须返回 JSON，绝不能落到 SPA 兜底。"""
    response = client.get("/api/classes/1/learning-groups")

    assert response.status_code == 401
    assert response.is_json
    assert not response.get_data(as_text=True).lstrip().startswith("<!DOCTYPE")


def test_unknown_api_route_returns_json_404_instead_of_spa_fallback(client):
    """核心修复：未匹配的 /api/* 返回 JSON 404，而不是 200 + index.html。"""
    response = client.get("/api/this-route-does-not-exist")

    assert response.status_code == 404
    assert response.is_json
    payload = response.get_json()
    assert "error" in payload
    body = response.get_data(as_text=True)
    assert "<!DOCTYPE" not in body
    assert "<html" not in body


def test_unknown_api_subpath_returns_json_404(client):
    """多级未匹配 API 路径同样不得被兜底吞掉。"""
    response = client.get("/api/classes/1/no-such-action")

    assert response.status_code == 404
    assert response.is_json


def test_spa_root_still_serves_frontend(app):
    """修复不得破坏 SPA 行为：根路径仍走前端兜底，而不是 JSON 404。"""
    app.config["TESTING"] = True
    spa_client = app.test_client()

    response = spa_client.get("/")

    # 静态目录下没有 index.html 时，兜底返回 404 纯文本；关键是**不是** JSON 404。
    assert not response.is_json
    assert response.status_code in (200, 404)


def test_spa_client_side_route_is_not_treated_as_api(app):
    """前端 history 路由（非 api/ 前缀）不应被 API 404 分支拦截。"""
    spa_client = app.test_client()

    response = spa_client.get("/teacher/dashboard")

    assert not response.is_json
