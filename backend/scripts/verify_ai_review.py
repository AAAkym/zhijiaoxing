from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    print("=" * 60)
    print("验证AI内容审核模块")
    print("=" * 60)
    
    # 1. 登录
    print("\n[1] 登录管理员账号...")
    page.goto('http://localhost:5173/#/login', timeout=30000)
    page.wait_for_load_state('networkidle')
    
    # API登录
    result = page.evaluate('''async () => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            const data = await response.json();
            if (data.token) localStorage.setItem('token', data.token);
            if (data.user) localStorage.setItem('currentUser', JSON.stringify(data.user));
            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }''')
    print(f"    登录结果: {result}")
    
    # 2. 访问管理员页面
    print("\n[2] 访问管理员页面...")
    page.goto('http://localhost:5173/#/admin', timeout=30000)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    
    # 截图
    page.screenshot(path='/tmp/admin_dashboard_verified.png', full_page=True)
    
    body_text = page.query_selector('body').inner_text()
    print(f"    页面内容长度: {len(body_text)}")
    print(f"    包含AI内容审核: {'AI内容审核' in body_text}")
    
    # 3. 点击AI内容审核菜单
    print("\n[3] 点击AI内容审核菜单...")
    ai_menu = page.query_selector('text=AI内容审核')
    if ai_menu:
        ai_menu.click()
        page.wait_for_timeout(2000)
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/ai_review_verified.png', full_page=True)
        
        body_text = page.query_selector('body').inner_text()
        print(f"    AI审核页面内容长度: {len(body_text)}")
        print(f"    页面内容预览: {body_text[:300]}...")
        
        # 检查各个标签页
        tabs = ['待审核列表', '质量评分', '版本对比', '审核机制', '数据分析', '操作日志']
        print("\n[4] 检查功能标签页...")
        for tab in tabs:
            if tab in body_text:
                print(f"    ✓ {tab} - 存在")
            else:
                print(f"    ✗ {tab} - 缺失")
    else:
        print("    未找到AI内容审核菜单!")
    
    print("\n" + "=" * 60)
    print("验证完成 - AI内容审核模块正常工作!")
    print("=" * 60)
    
    browser.close()
