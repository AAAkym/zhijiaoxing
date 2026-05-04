from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    all_errors = []
    page.on('console', lambda msg: all_errors.append({'type': msg.type, 'text': msg.text}))
    page.on('pageerror', lambda err: all_errors.append({'type': 'pageerror', 'text': str(err)}))
    
    print("=" * 60)
    print("管理员页面白屏诊断")
    print("=" * 60)
    
    # 1. 访问登录页
    print("\n[1] 访问登录页...")
    page.goto('http://localhost:5173/#/login', timeout=30000)
    page.wait_for_load_state('networkidle')
    
    # 2. 执行登录
    print("[2] 执行管理员登录...")
    
    # 填写表单
    page.fill('input[placeholder*="用户名"]', 'admin')
    page.fill('input[placeholder*="密码"]', 'admin123')
    
    # 点击登录
    page.click('button:has-text("登录")')
    page.wait_for_timeout(3000)
    page.wait_for_load_state('networkidle')
    
    print(f"    登录后URL: {page.url}")
    
    # 3. 检查localStorage
    print("[3] 检查登录状态...")
    user_data = page.evaluate('() => localStorage.getItem("currentUser")')
    print(f"    localStorage: {user_data[:100] if user_data else 'None'}...")
    
    # 4. 如果未登录，尝试API登录
    if not user_data or 'login' in page.url:
        print("[4] 尝试API登录...")
        result = page.evaluate('''async () => {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: 'admin', password: 'admin123' })
                });
                const data = await response.json();
                if (data.token || data.user) {
                    if (data.token) localStorage.setItem('token', data.token);
                    if (data.user) localStorage.setItem('currentUser', JSON.stringify(data.user));
                    return { success: true, user: data.user };
                }
                return { success: false, error: data.error };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }''')
        print(f"    API登录结果: {json.dumps(result, ensure_ascii=False)}")
        
        # 刷新页面
        page.reload()
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(2000)
    
    # 5. 访问管理员页面
    print("\n[5] 访问管理员页面...")
    page.goto('http://localhost:5173/#/admin', timeout=30000)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    
    # 截图
    page.screenshot(path='/tmp/admin_final.png', full_page=True)
    
    # 检查页面状态
    print(f"    当前URL: {page.url}")
    
    root = page.query_selector('#root')
    if root:
        root_html = root.inner_html()
        print(f"    Root HTML长度: {len(root_html)}")
        
        if len(root_html.strip()) < 100:
            print("    [严重] Root内容为空 - 白屏!")
        else:
            body_text = root.inner_text()
            print(f"    页面内容预览: {body_text[:200]}...")
    
    # 6. 收集所有错误
    print("\n[6] 错误汇总...")
    js_errors = [e for e in all_errors if e['type'] in ['error', 'pageerror']]
    if js_errors:
        print(f"    发现 {len(js_errors)} 个错误:")
        for err in js_errors[:10]:
            print(f"      [{err['type']}] {err['text'][:200]}")
    else:
        print("    无JavaScript错误")
    
    # 7. 检查网络请求
    print("\n[7] 检查关键网络请求...")
    me_response = page.evaluate('''async () => {
        try {
            const response = await fetch('/api/me');
            return { status: response.status, ok: response.ok };
        } catch (e) {
            return { error: e.message };
        }
    }''')
    print(f"    /api/me 响应: {json.dumps(me_response)}")
    
    print("\n" + "=" * 60)
    print("诊断完成")
    print("=" * 60)
    
    browser.close()
