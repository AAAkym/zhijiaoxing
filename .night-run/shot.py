#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""夜间丰富化任务截图器：playwright + 系统 Chrome。
用法: python shot.py --user student --pwd student123 --url "http://localhost:5173/#/student" --out out.png --steps '[{"click_text":"错题本"},{"wait_ms":2000}]'
"""
import argparse, json, sys
import socket, subprocess, time
def ensure_backend():
    def up():
        try:
            s=socket.create_connection(("127.0.0.1",5000),2); s.close(); return True
        except OSError: return False
    if up(): return True
    cmd=("powershell -NoProfile -Command \"$r=Invoke-CimMethod -ClassName Win32_Process -MethodName Create "
         "-Arguments @{CommandLine='cmd /c cd /d C:\\Users\\33552\\Desktop\\project_code\\backend "
         "&& venv\\Scripts\\python.exe -X utf8 src/main.py 1> C:\\Users\\33552\\Desktop\\project_code\\logs\\backend-run.log "
         "2> C:\\Users\\33552\\Desktop\\project_code\\logs\\backend-run-err.log'}; $r.ReturnValue\"")
    print("[ensure_backend] spawning...")
    subprocess.run(cmd, shell=True, capture_output=True, timeout=60)
    for _ in range(40):
        if up(): print("[ensure_backend] up"); return True
        time.sleep(1)
    return False

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"

def main():
    if not ensure_backend():
        print("BACKEND_DOWN"); sys.exit(3)
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default="student")
    ap.add_argument("--pwd", default="student123")
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--steps", default="[]")
    ap.add_argument("--viewport", default="1440x900")
    ap.add_argument("--full", action="store_true")
    args = ap.parse_args()
    w, h = (int(x) for x in args.viewport.split("x"))
    steps = json.loads(args.steps)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1.5)
        page = ctx.new_page()
        # 登录：走真实 UI 表单，应用会把 currentUser 写进 localStorage 作为路由门禁
        page.goto(BASE + "/#/login", wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(1500)
        try:
            page.locator('input[placeholder="请输入用户名"]').first.fill(args.user, timeout=6000)
            page.locator('input[placeholder="请输入密码（至少6位）"]').first.fill(args.pwd, timeout=6000)
            page.locator('button[type="submit"]').first.click(timeout=6000)
        except Exception as ex:
            print("LOGIN_FORM_FAIL", type(ex).__name__, str(ex)[:150]); sys.exit(2)
        page.wait_for_timeout(3000)
        page.goto(args.url, wait_until="networkidle", timeout=45000)
        page.wait_for_timeout(1800)
        for i, s in enumerate(steps):
            try:
                if "click_text" in s:
                    page.get_by_text(s["click_text"], exact=s.get("exact", False)).first.click(timeout=6000)
                elif "click_role" in s:
                    page.get_by_role(s["click_role"], name=s.get("name")).first.click(timeout=6000)
                elif "click_selector" in s:
                    page.locator(s["click_selector"]).first.click(timeout=6000)
                elif "scroll_bottom" in s:
                    page.evaluate("()=>{const el=document.scrollingElement||document.documentElement;el.scrollTop=el.scrollHeight}")
                elif "scroll_selector" in s:
                    page.evaluate("(sel)=>{const el=document.querySelector(sel);if(el)el.scrollTop=el.scrollHeight}", s["scroll_selector"])
                elif "eval" in s:
                    page.evaluate(s["eval"])
                if "wait_ms" in s:
                    page.wait_for_timeout(int(s["wait_ms"]))
                else:
                    page.wait_for_timeout(1500)
            except Exception as e:
                print(f"STEP{i}_WARN {s}: {type(e).__name__} {str(e)[:120]}")
        page.wait_for_timeout(1200)
        page.screenshot(path=args.out, full_page=args.full)
        browser.close()
        print("OK", args.out)

if __name__ == "__main__":
    main()
