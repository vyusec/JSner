"""Check the unpacked extension in Chromium against an isolated local fixture."""
from contextlib import ExitStack
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Fixture(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b'<title>JSner fixture</title><script src="/app.js"></script>' if self.path == '/' else b'window.route = "/api/from-bundle";'
        self.send_response(200)
        self.send_header('Content-Type', 'text/html' if self.path == '/' else 'application/javascript')
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_):
        pass

with ExitStack() as stack:
    temporary = stack.enter_context(TemporaryDirectory(prefix='jsner-ui-'))
    server = ThreadingHTTPServer(('127.0.0.1', 0), Fixture)
    stack.callback(server.server_close)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    stack.callback(server.shutdown)
    playwright = stack.enter_context(sync_playwright())
    browser = playwright.chromium.launch_persistent_context(
        temporary, channel='chromium', headless=True,
        args=[f'--disable-extensions-except={ROOT}', f'--load-extension={ROOT}'],
        viewport={'width': 480, 'height': 600},
    )
    stack.callback(browser.close)
    worker = browser.service_workers[0] if browser.service_workers else browser.wait_for_event('serviceworker')
    extension = worker.url.rsplit('/', 1)[0]
    site = browser.new_page()
    site.goto(f'http://127.0.0.1:{server.server_port}/')
    popup = browser.new_page()
    errors = []
    popup.on('pageerror', lambda error: errors.append(str(error)))
    popup.goto(extension + '/popup.html')
    version = json.loads((ROOT / 'manifest.json').read_text())['version']
    popup.wait_for_function('version => document.querySelector(".footer-version").textContent === "v" + version', arg=version)
    site.bring_to_front()
    popup.evaluate('() => document.getElementById("scanButton").click()')
    popup.wait_for_function('() => !document.getElementById("scanButton").disabled')
    assert '/api/from-bundle' in popup.evaluate('() => extractedData.endpoints')
    print('PASS quick scan reads linked JavaScript')
    results = browser.new_page()
    results.on('pageerror', lambda error: errors.append(str(error)))
    results.goto(extension + '/results.html')
    popup.evaluate('''() => chrome.storage.local.set({extractedData:{endpoints:[],apis:[],graphql:[],config:['config.json'],other:['soap-service']}})''')
    results.wait_for_function('() => document.getElementById("configStat").textContent === "1"')
    results.locator('[data-filter="apis"]').click()
    assert results.locator('.category-section').count() == 0
    assert results.locator('#emptyState').is_visible()
    results.locator('[data-filter="all"]').click()
    assert results.locator('.category-section').count() == 2
    assert results.locator('button.action-icon').count() == 4
    print('PASS live results, category filtering, and keyboard actions')
    for width in [480, 320]:
        popup.set_viewport_size({'width': width, 'height': 600})
        for theme in ['light', 'dark']:
            popup.evaluate('theme => chrome.storage.local.set({uiTheme:theme})', theme)
            popup.wait_for_function('theme => document.documentElement.dataset.theme === theme', arg=theme)
            for panel in ['scan', 'results', 'bridge']:
                popup.locator('#tab-' + panel).click()
                bounds = popup.evaluate('() => ({width:document.body.scrollWidth,height:document.body.scrollHeight})')
                assert bounds['width'] <= width and bounds['height'] <= 600, bounds
                if width == 480:
                    assert popup.evaluate('() => {const p=document.querySelector(".panel-scroll");return p.scrollHeight <= p.clientHeight;}'), panel
        results.set_viewport_size({'width': width, 'height': 600})
        assert results.evaluate('() => document.body.scrollWidth') <= width
    assert not errors, errors
    print('PASS version display, light/dark popup sizes, and no runtime errors')
