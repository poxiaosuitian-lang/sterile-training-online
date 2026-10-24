"""Browser smoke test with synthetic API responses; never contacts real accounts."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import threading,http.server,json,os,re
from datetime import datetime,timezone,timedelta
import argparse
root=Path(__file__).resolve().parent.parent
os.chdir(root)
(root/'tmp').mkdir(exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--engine',choices=['webkit','chromium'],default='webkit')
args=parser.parse_args()
# Set PLAYWRIGHT_BROWSERS_PATH if your browser binaries use a custom location.
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory='public',**kw)
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
 browser=(p.webkit.launch(headless=True) if args.engine=='webkit' else p.chromium.launch(channel='msedge' if os.name=='nt' else None,headless=True))
 page=browser.new_page(viewport={'width':844,'height':390},device_scale_factor=1,has_touch=True)
 errors=[];external=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:print('Browser console:',m.text,flush=True) if m.type=='error' else None)
 page.on('request',lambda r:external.append(r.url) if not r.url.startswith(base) and r.url.startswith('http') else None)
 page.on('response',lambda r:failed.append((r.status,r.url)) if r.status>=400 else None)
 locked=True
 paths=[]
 def route(r):
  path=r.request.url.split('/api/v1')[1];paths.append(path)
  if path=='/auth/options':data={'registrationEnabled':False}
  elif path=='/auth/login':data={'accessToken':'synthetic-token','player':{'id':'test','nickname':'测试玩家'}}
  elif path=='/app/access':data={'locked':locked,'title':'维护公告','message':'周一上午再开放'}
  elif path=='/game/progress':
   data=json.loads(Path('src/levels/standalone-contract.json').read_text(encoding='utf-8'))['levels']
   for l in data:l['progress']={'unlocked':True,'completed':False,'attempts':0,'bestScore':0,'bestStars':0}
  elif path.endswith('/start'):
   level=next(l for l in json.loads(Path('src/levels/standalone-contract.json').read_text(encoding='utf-8'))['levels'] if l['id']==path.split('/')[-2])
   data={'sessionId':'synthetic-session','challenge':{'nonce':'test'},'expiresAt':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat(),'level':level}
  else:data={}
  r.fulfill(json=data)
 page.route('**/api/v1/**',route)
 page.goto(base+'/play/')
 page.get_by_role('button',name='进入方舟').click(timeout=120000)
 page.wait_for_timeout(6000)
 page.locator('flt-semantics-placeholder').dispatch_event('click')
 page.wait_for_timeout(1500)
 page.get_by_role('textbox',name='账号',exact=True).click()
 page.keyboard.type('teststudent',delay=40)
 page.locator('input[type=password]').click()
 page.keyboard.type('test-password',delay=40)
 page.get_by_role('button',name='登录',exact=True).click()
 page.wait_for_timeout(2000)
 page.screenshot(path='tmp/web-login-result.png')
 page.get_by_text('周一上午再开放',exact=True).wait_for(timeout=8000)
 page.screenshot(path='tmp/webkit-maintenance.png')
 locked=False
 page.get_by_role('button',name='刷新状态').click()
 page.wait_for_timeout(4000)
 page.get_by_role('button',name='设置',exact=True).wait_for()
 page.screenshot(path='tmp/webkit-dashboard.png')
 for number,title in enumerate(['第一关','第二关','第三关','第四关','第五关'],1):
  page.get_by_role('button',name=re.compile('^'+title)).click()
  page.wait_for_timeout(9000)
  assert any(x.endswith('/start') for x in paths)
  page.screenshot(path=f'tmp/webkit-level-{number}.png')
  assert not errors, errors
  assert '正在进入关卡' not in page.locator('body').inner_text()
  print('Level',number,'opened',flush=True)
  page.reload()
  page.get_by_role('button',name='进入方舟').click(timeout=60000)
  page.wait_for_timeout(1800)
  if page.locator('flt-semantics-placeholder').count():page.locator('flt-semantics-placeholder').dispatch_event('click')
  page.get_by_role('button',name='设置',exact=True).wait_for()
 assert paths.count('/auth/login')==1, paths
 assert not any(x=='/app/release' for x in paths),paths
 assert not failed, failed
 assert not external, external
 assert not errors, errors
 page.set_viewport_size({'width':390,'height':844})
 page.wait_for_timeout(1200)
 page.screenshot(path='tmp/webkit-portrait.png')
 assert page.locator('#rotate').is_visible()
 print('PASS',args.engine,'login, maintenance, reopen, five level entries, session restore and local-only resources',flush=True)
 browser.close()
server.shutdown()
