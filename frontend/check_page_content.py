from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    print("导航到页面...")
    page.goto('http://localhost:5173/', timeout=30000)
    page.wait_for_load_state('networkidle', timeout=30000)
    
    # 截图
    page.screenshot(path='/tmp/page_screenshot.png', full_page=True)
    print("截图已保存到 /tmp/page_screenshot.png")
    
    # 获取页面内容
    html = page.content()
    print(f"\n页面HTML长度: {len(html)}")
    
    # 获取body内容
    body = page.query_selector('body')
    if body:
        body_html = body.inner_html()
        print(f"Body HTML长度: {len(body_html)}")
        
        # 获取body文本
        body_text = body.inner_text()
        print(f"\nBody文本内容 (前500字符):")
        print(body_text[:500])
    
    # 检查root元素
    root = page.query_selector('#root')
    if root:
        root_html = root.inner_html()
        print(f"\nRoot元素HTML长度: {len(root_html)}")
        
        # 检查root内有什么元素
        children = root.query_selector_all('> *')
        print(f"Root直接子元素数量: {len(children)}")
        
        for i, child in enumerate(children[:5]):  # 只显示前5个
            tag = child.evaluate('el => el.tagName')
            classes = child.evaluate('el => el.className')
            text = child.inner_text()[:100] if child.inner_text() else ''
            print(f"  子元素{i+1}: <{tag}> class='{classes}' text='{text}...'")
    
    # 检查是否有登录表单
    login_form = page.query_selector('form')
    if login_form:
        print("\n发现登录表单!")
        inputs = login_form.query_selector_all('input')
        print(f"  输入框数量: {len(inputs)}")
        for inp in inputs:
            inp_type = inp.get_attribute('type') or 'text'
            inp_name = inp.get_attribute('name') or inp.get_attribute('placeholder') or ''
            print(f"    - type={inp_type}, name/placeholder={inp_name}")
    
    # 检查是否有错误提示
    error_elements = page.query_selector_all('[class*="error"], [class*="alert"], [role="alert"]')
    if error_elements:
        print(f"\n发现 {len(error_elements)} 个错误/警告元素:")
        for err in error_elements[:3]:
            print(f"  - {err.inner_text()[:100]}")
    
    browser.close()
