import sys; sys.path.insert(0, '.')
from shot import ensure_backend
from playwright.sync_api import sync_playwright
ensure_backend()
BASE = "http://localhost:5173"
def click_text(pg, text):
    for sel in ("button", "a"):
        loc = pg.locator(f'{sel}:has-text("{text}")')
        for i in range(loc.count()):
            if loc.nth(i).is_visible():
                loc.nth(i).click(); return True
    return False
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.goto(BASE + "/#/login", wait_until="domcontentloaded"); pg.wait_for_timeout(1500)
    pg.locator('input[placeholder="请输入用户名"]').first.fill("student")
    pg.locator('input[placeholder="请输入密码（至少6位）"]').first.fill("student123")
    pg.locator('button[type="submit"]').first.click(); pg.wait_for_timeout(4000)
    pg.goto(BASE + "/#/student", wait_until="networkidle"); pg.wait_for_timeout(3000)
    click_text(pg, "知识图谱"); pg.wait_for_timeout(6000)
    sel = pg.locator("select").first
    sel.select_option(label="Python程序设计"); pg.wait_for_timeout(4000)
    inp = pg.locator('input[placeholder*="语义检索"]')
    inp.first.fill("函数默认值为什么会变")
    click_text(pg, "语义检索"); pg.wait_for_timeout(10000)
    txt = pg.evaluate("() => document.body.innerText")
    i = txt.find("语义检索")
    print("CTX:", txt[i:i+300].replace("\n","|"))
    chips = pg.locator("button").filter(has_text="%")
    print("pct-buttons:", chips.count())
    for j in range(min(chips.count(),6)):
        print(" chip:", chips.nth(j).inner_text().replace("\n"," "))
    pg.screenshot(path="../docs/screenshots/enrichment/T8-after-kg3d-semantic.png")
    b.close(); print("done")
