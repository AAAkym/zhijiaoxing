from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    page.goto('http://localhost:5173/login')
    page.wait_for_load_state('networkidle')
    time.sleep(2)
    page.screenshot(path='/tmp/login_page.png')

    inputs = page.locator('input')
    print(f"Found {inputs.count()} inputs on login page")
    for i in range(inputs.count()):
        inp = inputs.nth(i)
        print(f"  Input {i}: type={inp.get_attribute('type')}, placeholder={inp.get_attribute('placeholder')}, name={inp.get_attribute('name')}")

    buttons = page.locator('button')
    print(f"Found {buttons.count()} buttons")
    for i in range(buttons.count()):
        btn = buttons.nth(i)
        print(f"  Button {i}: text={btn.text_content()}")

    browser.close()
