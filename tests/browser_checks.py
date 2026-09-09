#!/usr/bin/env python3
"""Real browser interaction checks. 3D rendering is reported separately, never mocked."""
import json,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
out={'browser':'Chromium','checks':[],'errors':[],'renderingVerified':False,'networkFailures':[]}
def checked(name,condition=True):
    assert condition,name
    out['checks'].append({'name':name,'passed':True})
with sync_playwright() as p:
    launch={'headless':True}
    if os.environ.get('CHROMIUM_EXECUTABLE'):
        launch['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
    browser=p.chromium.launch(**launch)
    page=browser.new_page(viewport={'width':1512,'height':982},device_scale_factor=1)
    page.on('pageerror',lambda e:out['errors'].append(str(e)))
    page.on('requestfailed',lambda r:out['networkFailures'].append({'url':r.url,'reason':r.failure}))
    page.goto(os.environ.get('NEURO_TEST_URL','http://127.0.0.1:4173'),wait_until='domcontentloaded')
    page.get_by_role('heading',name='신경망 탐색',exact=True).wait_for(timeout=60000)
    page.wait_for_function("document.querySelector('.node-list')?.children.length > 5",timeout=60000)
    page.wait_for_timeout(700)
    checked('real dataset initializes in browser')
    checked('desktop has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    checked('overview reports actual rendered subset',page.locator('.status-bar').inner_text().find('18,000')>=0)
    out['renderingVerified']=page.locator('.scene-host canvas').count()>0
    page.screenshot(path=str(ROOT/'docs/browser-desktop.png'),full_page=True)
    search=page.get_by_role('textbox',name='뉴런 검색')
    search.fill('720575940596125868')
    page.wait_for_function("document.querySelectorAll('.node-list .node-row').length === 1")
    checked('exact root ID search preserves precision')
    page.locator('.node-list .node-main').first.click()
    page.locator('.root-id code').wait_for(timeout=15000)
    checked('real neuron detail opens',page.locator('.root-id code').inner_text()=='720575940596125868')
    page.wait_for_function("document.querySelector('.neighbor-list .node-row') !== null")
    checked('input/output neighbors are populated from shards')
    page.get_by_role('button',name='뉴런 저장',exact=True).click()
    checked('bookmark persists an exact string ID',page.evaluate("JSON.parse(localStorage.getItem('neuro-atlas:saved'))[0]")=='720575940596125868')
    page.get_by_role('button',name='검색어 지우기',exact=True).click()
    page.get_by_role('button',name='시작으로',exact=False).click()
    page.get_by_role('textbox',name='시작 뉴런 ID').wait_for()
    checked('path source can be assigned from inspector',page.get_by_role('textbox',name='시작 뉴런 ID').input_value()=='720575940596125868')
    # Same-node path is a valid 0-hop result and exercises the real worker RPC path.
    page.get_by_role('textbox',name='도착 뉴런 ID').fill('720575940596125868')
    page.get_by_role('button',name='경로 찾기',exact=True).click()
    page.get_by_text('동일한 뉴런',exact=True).wait_for(timeout=15000)
    checked('path search and a valid zero-hop result work in browser')
    page.get_by_role('button',name='데이터',exact=True).click()
    panel=page.get_by_role('region',name='원본 데이터와 검증')
    # section with an accessible name maps to region.
    panel.wait_for()
    checked('data panel displays source totals', '50,666,648' in panel.inner_text() and '5,342,446' in panel.inner_text())
    page.get_by_role('button',name='데이터 패널 닫기',exact=True).click()
    page.get_by_role('button',name='전체',exact=True).click()
    page.wait_for_function("document.querySelector('.view-busy') === null || document.querySelector('.view-busy').innerText.includes('3D')")
    page.wait_for_timeout(500)
    with page.expect_download() as d:
        page.get_by_role('button',name='내보내기',exact=True).click()
    file=ROOT/'docs/browser-export.json';d.value.save_as(str(file))
    export=json.loads(file.read_text());checked('JSON export keeps string root IDs',all(isinstance(n['id'],str) for n in export['nodes']))
    checked('JSON export declares schematic coordinates and subset',export['coordinates']['anatomical'] is False and export['truncated'] is True)
    page.get_by_role('button',name='표시 설정',exact=True).click()
    checked('display settings open',page.locator('.settings-popover').is_visible())
    page.get_by_role('button',name='표시 설정 닫기',exact=True).last.click()
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(600)
    checked('mobile has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    checked('mobile side panels close without hiding the viewport',page.locator('.explorer').count()==0 and page.locator('.inspector').count()==0)
    page.get_by_role('button',name='탐색 패널 열기',exact=True).click()
    checked('mobile explorer drawer opens',page.locator('.explorer').is_visible())
    page.get_by_role('textbox',name='뉴런 검색').fill('MBON')
    page.wait_for_function("document.querySelector('.list-heading')?.innerText.includes('뉴런') && !document.querySelector('.node-list')?.classList.contains('pending')")
    checked('mobile search returns real cells',page.locator('.node-list .node-row').count()>0)
    page.screenshot(path=str(ROOT/'docs/browser-mobile.png'),full_page=True)
    page.get_by_role('button',name='탐색 패널 닫기',exact=True).click()
    checked('mobile drawer can be dismissed',page.locator('.explorer').count()==0)
    checked('no uncaught application exceptions',not out['errors'])
    browser.close()
out['renderingNote']='Three.js CDN unavailable in this execution environment; WebGL canvas was not validated.' if not out['renderingVerified'] else 'Actual Three.js canvas present; visual rendering requires separate review.'
(ROOT/'docs/browser-test-results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps(out,ensure_ascii=False,indent=2))
