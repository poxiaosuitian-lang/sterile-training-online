"""Optional local browser QA against the isolated integration-test server."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='msedge' if os.name == 'nt' else None)
    page = browser.new_page(viewport={"width":1365,"height":900}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(os.environ['ADMIN_URL'])
    page.locator('#username').fill(os.environ['ADMIN_USERNAME'])
    page.locator('#password').fill(os.environ['ADMIN_PASSWORD'])
    page.locator('#loginButton').click()
    page.locator('#players tr').first.wait_for()
    assert page.locator('#players tr').count() == 2
    assert '测试甲' in page.locator('#players').inner_text()
    output = Path('tmp/online-review')
    output.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(output/'admin-dashboard.png'), full_page=True)
    page.locator('#search').fill('alice')
    page.locator('#refresh').click()
    page.wait_for_function("document.querySelector('#players').children.length === 1")
    assert '20%' in page.locator('#players').inner_text()
    with page.expect_download() as download:
        page.locator('#export').click()
    download.value.save_as(str(output/'training-results.csv'))
    assert '测试甲' in (output/'training-results.csv').read_text(encoding='utf-8-sig')
    page.get_by_role('button',name='查看详情').click()
    page.locator('#sessions tr').first.wait_for()
    assert page.locator('#progress tr').count() == 5
    assert '已通过' in page.locator('#sessions').inner_text()
    page.screenshot(path=str(output/'admin-player-detail.png'),full_page=True)
    page.locator('#closeDetail').click()
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path=str(output/'admin-mobile.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.locator('#logout').click()
    assert page.locator('#login').is_visible()
    assert not errors, errors
    browser.close()
    print('Admin browser login, search, details, CSV and mobile layout passed.')
