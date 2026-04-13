from playwright.sync_api import sync_playwright
import json

def diagnose_page():
    results = {
        'console_errors': [],
        'network_errors': [],
        'javascript_errors': [],
        'resource_loading': [],
        'dom_state': {},
        'screenshots': []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # 收集控制台消息
        def handle_console(msg):
            error_info = {
                'type': msg.type,
                'text': msg.text,
                'location': msg.location
            }
            results['console_errors'].append(error_info)
            print(f"[Console {msg.type}] {msg.text}")
        
        page.on('console', handle_console)
        
        # 收集网络错误
        def handle_request_failed(request):
            error_info = {
                'url': request.url,
                'failure': request.failure,
                'method': request.method
            }
            results['network_errors'].append(error_info)
            print(f"[Network Failed] {request.url} - {request.failure}")
        
        page.on('requestfailed', handle_request_failed)
        
        # 收集页面错误
        def handle_page_error(error):
            error_info = {
                'message': str(error),
                'stack': getattr(error, 'stack', None)
            }
            results['javascript_errors'].append(error_info)
            print(f"[Page Error] {error}")
        
        page.on('pageerror', handle_page_error)
        
        # 收集响应信息
        def handle_response(response):
            if response.status >= 400:
                error_info = {
                    'url': response.url,
                    'status': response.status,
                    'status_text': response.status_text
                }
                results['resource_loading'].append(error_info)
                print(f"[Response Error] {response.url} - {response.status}")
        
        page.on('response', handle_response)
        
        print("=" * 60)
        print("开始诊断管理员页面...")
        print("=" * 60)
        
        try:
            # 导航到页面
            print("\n[1] 导航到 http://localhost:5173/")
            page.goto('http://localhost:5173/', timeout=30000)
            
            # 等待网络空闲
            print("[2] 等待网络空闲...")
            page.wait_for_load_state('networkidle', timeout=30000)
            
            # 截图
            print("[3] 截取页面截图...")
            page.screenshot(path='/tmp/admin_page_initial.png', full_page=True)
            results['screenshots'].append('/tmp/admin_page_initial.png')
            
            # 检查DOM状态
            print("[4] 检查DOM状态...")
            html_content = page.content()
            results['dom_state']['html_length'] = len(html_content)
            results['dom_state']['title'] = page.title()
            
            # 检查根元素
            root_element = page.query_selector('#root')
            if root_element:
                root_html = root_element.inner_html()
                results['dom_state']['root_inner_html_length'] = len(root_html)
                results['dom_state']['root_has_content'] = len(root_html.strip()) > 0
            else:
                results['dom_state']['root_exists'] = False
            
            # 检查是否有vite-error-overlay
            error_overlay = page.query_selector('vite-error-overlay')
            if error_overlay:
                results['dom_state']['has_vite_error_overlay'] = True
                error_text = error_overlay.inner_text()
                results['dom_state']['vite_error_text'] = error_text[:500] if error_text else 'No text'
                print(f"[Error] 发现Vite错误覆盖层: {error_text[:200]}...")
            
            # 检查body内容
            body_text = page.evaluate('() => document.body.innerText')
            results['dom_state']['body_text_length'] = len(body_text)
            results['dom_state']['body_text_preview'] = body_text[:200] if body_text else ''
            
            # 检查是否有React错误
            react_root = page.query_selector('[data-reactroot]')
            results['dom_state']['has_react_root'] = react_root is not None
            
            # 检查CSS加载
            stylesheets = page.query_selector_all('link[rel="stylesheet"]')
            results['dom_state']['stylesheet_count'] = len(stylesheets)
            
            # 检查脚本加载
            scripts = page.query_selector_all('script')
            results['dom_state']['script_count'] = len(scripts)
            
            # 等待一段时间看是否有延迟加载
            print("[5] 等待5秒检查延迟加载...")
            page.wait_for_timeout(5000)
            
            # 再次截图
            page.screenshot(path='/tmp/admin_page_after_wait.png', full_page=True)
            results['screenshots'].append('/tmp/admin_page_after_wait.png')
            
            # 检查最终状态
            final_html = page.content()
            results['dom_state']['final_html_length'] = len(final_html)
            
            # 检查是否有可见内容
            visible_elements = page.query_selector_all('body > *:not(script):not(style):not(link)')
            results['dom_state']['visible_element_count'] = len(visible_elements)
            
            print("\n" + "=" * 60)
            print("诊断结果摘要:")
            print("=" * 60)
            print(f"页面标题: {results['dom_state'].get('title', 'N/A')}")
            print(f"HTML长度: {results['dom_state'].get('html_length', 0)}")
            print(f"Root元素内容长度: {results['dom_state'].get('root_inner_html_length', 0)}")
            print(f"Body文本长度: {results['dom_state'].get('body_text_length', 0)}")
            print(f"可见元素数量: {results['dom_state'].get('visible_element_count', 0)}")
            print(f"控制台错误数量: {len(results['console_errors'])}")
            print(f"网络错误数量: {len(results['network_errors'])}")
            print(f"JavaScript错误数量: {len(results['javascript_errors'])}")
            print(f"资源加载错误数量: {len(results['resource_loading'])}")
            
            if results['dom_state'].get('has_vite_error_overlay'):
                print("\n[严重] 发现Vite错误覆盖层!")
            
            if results['javascript_errors']:
                print("\n[JavaScript错误]:")
                for err in results['javascript_errors']:
                    print(f"  - {err['message']}")
            
            if results['console_errors']:
                print("\n[控制台消息]:")
                for err in results['console_errors'][-10:]:  # 只显示最后10条
                    print(f"  [{err['type']}] {err['text'][:100]}")
            
        except Exception as e:
            results['exception'] = str(e)
            print(f"\n[异常] {e}")
        
        finally:
            browser.close()
    
    return results

if __name__ == '__main__':
    results = diagnose_page()
    
    # 保存完整结果
    with open('/tmp/diagnosis_results.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2, default=str)
    
    print("\n完整诊断结果已保存到: /tmp/diagnosis_results.json")
