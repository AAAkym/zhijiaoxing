from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)

    page.goto('http://localhost:5173/login')
    page.wait_for_load_state('networkidle')
    time.sleep(1)

    page.fill('input[placeholder*="用户名"], input[type="text"]', 'teacher1')
    page.fill('input[placeholder*="密码"], input[type="password"]', 'teacher123')
    page.click('button:has-text("登录")')
    time.sleep(3)
    page.wait_for_load_state('networkidle')

    page.screenshot(path='/tmp/step1_login.png')

    page.goto('http://localhost:5173/teacher')
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    page.screenshot(path='/tmp/step2_teacher.png')

    content_gen_tab = page.locator('text=内容生成')
    if content_gen_tab.count() > 0:
        content_gen_tab.first.click()
        time.sleep(1)
        page.screenshot(path='/tmp/step3_content_gen.png')

    course_select = page.locator('select').first
    if course_select.count() > 0:
        course_select.select_option(index=1)
        time.sleep(0.5)

    topic_input = page.locator('input[placeholder*="主题"], input[placeholder*="topic"]')
    if topic_input.count() > 0:
        topic_input.fill('Python基础')
    else:
        inputs = page.locator('input[type="text"]')
        for i in range(inputs.count()):
            inp = inputs.nth(i)
            placeholder = inp.get_attribute('placeholder') or ''
            if '主题' in placeholder or 'topic' in placeholder.lower():
                inp.fill('Python基础')
                break

    page.screenshot(path='/tmp/step4_filled.png')

    generate_btn = page.locator('button:has-text("生成")')
    if generate_btn.count() > 0:
        generate_btn.first.click()
        print("Clicked generate button, waiting for response...")
        time.sleep(60)
        page.wait_for_load_state('networkidle')
        page.screenshot(path='/tmp/step5_generated.png')

        mindmap_tab = page.locator('button:has-text("思维导图"), [value="mindmap"]')
        if mindmap_tab.count() > 0:
            mindmap_tab.first.click()
            time.sleep(2)
            page.screenshot(path='/tmp/step6_mindmap.png')
            print("Mindmap tab found and clicked")
        else:
            print("Mindmap tab NOT found in results")

        page_content = page.content()
        if 'InteractiveMindMap' in page_content or 'mind-map-node' in page_content or 'mindmap' in page_content.lower():
            print("Mindmap component found in DOM")
        else:
            print("Mindmap component NOT found in DOM")

        if '暂无数据' in page_content:
            print("Mindmap shows 'no data' message")
    else:
        print("Generate button not found")

    print("\nConsole errors:")
    for err in console_errors[-20:]:
        print(f"  {err}")

    browser.close()
