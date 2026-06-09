from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    page.goto('http://localhost:5173/login')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    login_btn = page.locator('button:has-text("登录")').first
    login_btn.click()
    time.sleep(3)
    page.wait_for_load_state('networkidle')
    page.screenshot(path='/tmp/after_login_click.png')

    inputs = page.locator('input')
    print(f"Found {inputs.count()} inputs")
    for i in range(min(inputs.count(), 10)):
        inp = inputs.nth(i)
        print(f"  Input {i}: type={inp.get_attribute('type')}, placeholder={inp.get_attribute('placeholder')}")

    if inputs.count() >= 2:
        inputs.nth(0).fill('teacher1')
        inputs.nth(1).fill('teacher123')
        time.sleep(0.5)

        submit = page.locator('button:has-text("登录"), button[type="submit"]')
        if submit.count() > 0:
            submit.first.click()
            time.sleep(3)
            page.wait_for_load_state('networkidle')
            page.screenshot(path='/tmp/after_login.png')
            print(f"After login, URL: {page.url}")

            page.goto('http://localhost:5173/teacher')
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            page.screenshot(path='/tmp/teacher_page.png')

            content_gen = page.locator('text=内容生成')
            if content_gen.count() > 0:
                content_gen.first.click()
                time.sleep(1)
                page.screenshot(path='/tmp/content_gen.png')
                print("Clicked content generation tab")
            else:
                print("Content generation tab not found")
                menu_items = page.locator('button, [role="tab"], nav a')
                print(f"Found {menu_items.count()} menu items")
                for i in range(min(menu_items.count(), 20)):
                    item = menu_items.nth(i)
                    text = item.text_content()
                    if text and text.strip():
                        print(f"  Menu item: {text.strip()[:50]}")
        else:
            print("Submit button not found")
    else:
        print("Not enough input fields found")

    browser.close()
