#!/usr/bin/env python3
"""Check the GT3 picker, its 71 hosted photos and the 30 confirmed selections."""
import argparse
import functools
import http.server
import json
import shutil
import threading
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url')
args = parser.parse_args()
server = None
if args.url:
    address = args.url
else:
    root = Path(__file__).resolve().parents[1]
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    address = f'http://127.0.0.1:{server.server_port}/choix-livrees/'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1360, 'height': 900})
    page = context.new_page()
    errors, bad_responses = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: bad_responses.append({'url': response.url, 'status': response.status})
            if response.status >= 400 else None)
    # Photos must all work without contacting their original websites.
    host = urlparse(address).netloc
    context.route('**/*', lambda route: route.continue_()
                  if urlparse(route.request.url).netloc == host else route.abort())
    response = page.goto(address)
    assert response.status == 200, response.status
    photos = page.evaluate('''async () => {
      for (const image of document.images) image.loading = 'eager';
      await Promise.all([...document.images].map(image => image.decode()));
      return [...document.images].map(image => ({loaded: image.naturalWidth > 0,
        local: new URL(image.currentSrc).origin === location.origin}));
    }''')
    assert len(photos) == 71 and all(photo['loaded'] and photo['local'] for photo in photos)
    assert page.locator('#catalogue section').count() == 10
    confirmed = json.loads(page.locator('#confirmed-data').text_content())['ids']
    selected = page.locator('[data-choose][aria-pressed="true"]').evaluate_all(
        '(buttons) => buttons.map(button => button.dataset.choose)')
    assert len(confirmed) == 30 and set(selected) == set(confirmed)
    assert page.locator('[data-choose="AST8"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('[data-id="AST8"] .meta').inner_text().find('n°') == -1
    rows = page.locator('#livery-data').text_content()
    rows = json.loads(rows)
    groups = list(dict.fromkeys(row['model'] for row in rows))
    for group in groups:
        entries = [row for row in rows if row['model'] == group]
        assert len(entries) == (8 if group == 'aston' else 7)
        extra = next(entry for entry in entries if entry['id'] not in confirmed)
        page.locator(f'[data-choose="{extra["id"]}"]').click()
        assert page.locator(f'#{group} [aria-pressed="true"]').count() == 3
    assert page.locator('#total').inner_text() == '30 / 30 choix'
    recap = page.locator('#choices').input_value()
    assert len(recap.splitlines()) == 10
    page.locator('[data-choose="POR1"]').click()
    page.locator('[data-choose="POR7"]').click()
    page.reload()
    assert page.locator('[data-choose][aria-pressed="true"]').count() == 30
    assert page.locator('[data-choose="POR7"]').get_attribute('aria-pressed') == 'true'
    page.locator('[data-choose="POR7"]').click()
    page.locator('[data-choose="POR1"]').click()
    assert page.locator('#choices').input_value() == recap
    assert page.locator('#total').inner_text() == '30 / 30 choix'
    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.locator('[data-choose][aria-pressed="true"]').evaluate_all(
        '(buttons) => buttons.forEach(button => button.click())')
    page.reload()
    assert page.locator('[data-choose][aria-pressed="true"]').count() == 0
    assert not errors, errors
    assert not bad_responses, bad_responses
    print(json.dumps({'url': address, 'photos': len(photos), 'sameOrigin': True,
                      'models': len(groups), 'limitThree': True, 'thirtySelections': True,
                      'confirmedDefaults': True, 'astonGreenYellow': True, 'emptySelectionPersists': True,
                      'persistence': True, 'replaceSelection': True, 'mobileOverflow': False,
                      'errors': errors, 'badResponses': bad_responses}, ensure_ascii=False))
    browser.close()
if server:
    server.shutdown()
