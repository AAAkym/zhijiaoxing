from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    
    print("=" * 60)
    print("完整验证AI内容审核模块")
    print("=" * 60)
    
    # 1. 先通过API登录
    print("\n[1] 通过API登录...")
    page.goto('http://localhost:5173/', timeout=30000)
    page.wait_for_load_state('networkidle')
    
    # 执行登录API调用
    result = page.evaluate('''async () => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'admin', password: 'admin123' })
            });
            const data = await response.json();
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            if (data.user) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
            }
            return { success: true, user: data.user };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }''')
    print(f"    登录结果: {json.dumps(result, ensure_ascii=False)[:200]}")
    
    # 2. 刷新页面让App.jsx重新检查登录状态
    print("\n[2] 刷新页面...")
    page.reload()
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)
    
    # 3. 访问管理员页面
    print("\n[3] 访问管理员页面...")
    page.goto('http://localhost:5173/#/admin', timeout=30000)
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(3000)
    
    # 截图
    page.screenshot(path='/tmp/admin_page_final.png', full_page=True)
    
    # 检查页面内容
    root = page.query_selector('#root')
    if root:
        root_html = root.inner_html()
        root_text = root.inner_text()
        print(f"    Root HTML长度: {len(root_html)}")
        print(f"    Root 文本长度: {len(root_text)}")
        
        # 检查关键内容
        checks = {
            'AI内容审核': 'AI内容审核' in root_text,
            '系统概览': '系统概览' in root_text,
            '用户管理': '用户管理' in root_text,
            '课程管理': '课程管理' in root_text,
            '数据分析': '数据分析' in root_text,
            '系统设置': '系统设置' in root_text,
            '欢迎回来': '欢迎回来' in root_text,
            '快速操作': '快速操作' in root_text
        }
        
        print("\n[4] 页面内容检查:")
        for key, found in checks.items():
            status = "✓" if found else "✗"
            print(f"    {status} {key}: {'存在' if found else '缺失'}")
        
        # 5. 点击AI内容审核
        if checks['AI内容审核']:
            print("\n[5] 点击AI内容审核菜单...")
            ai_menu = page.query_selector('text=AI内容审核')
            if ai_menu:
                ai_menu.click()
                page.wait_for_timeout(2000)
                page.wait_for_load_state('networkidle')
                page.screenshot(path='/tmp/ai_review_page_final.png', full_page=True)
                
                # 检查AI审核页面内容
                root_text = page.query_selector('#root').inner_text()
                ai_checks = {
                    '待审核列表': '待审核列表' in root_text,
                    '质量评分': '质量评分' in root_text,
                    '版本对比': '版本对比' in root_text,
                    '审核机制': '审核机制' in root_text,
                    '数据分析': '数据分析' in root_text,
                    '操作日志': '操作日志' in root_text,
                    '三重审核': '三重审核' in root_text,
                    'AI内容审核中心': 'AI内容审核中心' in root_text
                }
                
                print("\n[6] AI内容审核页面检查:")
                for key, found in ai_checks.items():
                    status = "✓" if found else "✗"
                    print(f"    {status} {key}: {'存在' if found else '缺失'}")
                
                if all(ai_checks.values()):
                    print("\n" + "=" * 60)
                    print("✓ AI内容审核模块完全正常!")
                    print("=" * 60)
                else:
                    print("\n[警告] 部分功能缺失")
            else:
                print("    未找到AI内容审核菜单元素")
        else:
            print("\n[问题] 页面中未找到AI内容审核菜单")
            print(f"    页面内容预览: {root_text[:500]}...")
    else:
        print("    [错误] Root元素不存在!")
    
    browser.close()
