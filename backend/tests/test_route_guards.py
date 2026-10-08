"""全路由未认证守卫测试（上轮路线图 R-5 的第三件，也是最后一件）。

背景：前两轮已经确认过两次"测试绿但行为错"的静默失效：
  1. 组件引用了不存在的导出，测试 mock 盖住了，构建是红的；
  2. jest 配置硬编码排除 6 个文件 102 个用例，"全绿"名存实亡。
后端的风险不在"被排除"（本仓库无 pytest 排除），而在"注册了但行为不对"。
本文件遍历 url_map 中全部允许 GET 的 /api/* 路由，逐一断言：
  未认证访问必须返回 JSON 错误（401/403/404/400...），绝不能是
  200 成功数据（缺守卫）或 HTML（SPA 兜底 / 错误页）。

方法参考：
  - alphagov/notifications-admin tests/app/main/test_init.py 的
    url_map 全遍历 + 违规聚合报错（一次点名所有不合格路由）；
  - roxy-wi tests/security/test_routes.py 的 is_json 断言。

设计取舍：
  - 只探测 GET：POST/PUT/DELETE 是状态变更方法，对它们做真实调用会执行
    处理函数（可能触发外部调用），不宜在测试里穷举；它们的守卫由各自
    的路由级测试覆盖。本测试守的是"读路径不泄露、不落 HTML"。
  - /api/sse/* 显式豁免：SSE 端点的鉴权失败是**流内** error 事件
    （HTTP 200 + event:error，见 sse_routes.require_auth_sse），
    这是 SSE 协议的惯例，浏览器按事件处理，不是守卫缺失。
  - /api/search/* 显式豁免并记录在案：autocomplete/suggestions 等 4 条
    路由未认证可访问，属于产品层取舍（是否向未登录用户暴露搜索联想），
    已写入晨报"风险与待决策"，不擅自加守卫。
"""

BASE_PATH = "/api"

from flask import url_for

# 前缀豁免：SSE 流内鉴权（见上）。
# 注：/api/search/* 曾按"公开搜索联想"豁免，第二轮 D-1 已采纳推荐方案
# 为全部搜索读路由补上 @require_auth（见 search_routes.py），故不再豁免。
EXEMPT_PREFIXES = ("/api/sse/",)

# 精确豁免：认证入口本身必然 200/400
EXEMPT_RULES = {
    "/api/login",
    "/api/register",
}


def _api_get_rules(app):
    """收集全部挂载在 /api 下、允许 GET 的路由规则（不含 static）。"""
    rules = []
    for rule in app.url_map.iter_rules():
        path = str(rule)
        if not path.startswith(BASE_PATH):
            continue
        if rule.endpoint == "static":
            continue
        if "GET" not in rule.methods:
            continue
        if path in EXEMPT_RULES or path.startswith(EXEMPT_PREFIXES):
            continue
        rules.append(rule)
    return rules


def _build_path(app, rule):
    """按转换器类型填占位值，生成可请求的真实路径。"""
    values = {}
    for name, converter in rule._converters.items():
        kind = type(converter).__name__
        if kind == "IntegerConverter":
            values[name] = 1
        elif kind == "PathConverter":
            values[name] = "a/b"
        else:
            values[name] = "x"
    with app.test_request_context():
        return url_for(rule.endpoint, **values)


def test_all_api_get_routes_reject_unauthenticated_with_json(app):
    """未认证访问任何 /api/* GET 路由：不得 200，不得 HTML，必须是 JSON。"""
    bad_routes = []
    skipped = []

    client = app.test_client()
    for rule in _api_get_rules(app):
        try:
            path = _build_path(app, rule)
        except Exception as exc:  # 极少数端点 url_for 失败（如缺失默认参数）
            skipped.append((str(rule), repr(exc)))
            continue

        response = client.get(path)

        problems = []
        if response.status_code == 200:
            problems.append("未认证仍返回 200")
        body = response.get_data(as_text=True)
        if not response.is_json:
            problems.append(f"响应不是 JSON（content-type={response.content_type}）")
        if body.lstrip().startswith("<!DOCTYPE") or "<html" in body[:200].lower():
            problems.append("返回了 HTML 页面")
        if problems:
            bad_routes.append(f"{path} [{response.status_code}]：{'；'.join(problems)}")

    # 聚合报错：一次列出所有不合格路由，而不是修一条跑一次发现下一条
    assert not bad_routes, (
        f"{len(bad_routes)} 条 /api/* GET 路由未认证行为不合格：\n  "
        + "\n  ".join(bad_routes)
    )
    # url_for 失败的路由必须显式暴露，不允许静默跳过
    assert not skipped, (
        f"{len(skipped)} 条路由无法生成测试路径（需人工确认）：\n  "
        + "\n  ".join(f"{p}：{reason}" for p, reason in skipped)
    )


def test_search_routes_now_require_auth(app):
    """第二轮 D-1：搜索读路由曾未认证公开，现已补 @require_auth。
    本测试锁定该决策，防止将来被无意回退为公开。"""
    client = app.test_client()
    for path in ("/api/search/autocomplete", "/api/search/suggestions", "/api/search/courses"):
        response = client.get(path)
        assert response.status_code in (401, 403), f"{path} 应拒绝未认证访问"
        assert response.is_json, f"{path} 应返回 JSON 错误而非 HTML"
