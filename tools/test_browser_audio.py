"""Exercise the shipped Web Audio bridge with real browser decoding and playback."""
from pathlib import Path
import http.server
import os
import threading
import argparse
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--engine', choices=['webkit', 'chromium', 'both'], default='both')
args = parser.parse_args()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root / 'public'), **kwargs)
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
with sync_playwright() as p:
    for name in (['webkit', 'chromium'] if args.engine == 'both' else [args.engine]):
        browser = (p.webkit.launch() if name == 'webkit' else
                   p.chromium.launch(channel='msedge' if os.name == 'nt' else None))
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.route('**/audio-test', lambda r: r.fulfill(content_type='text/html', body='<base href="/play/"><button>开始</button>'))
        page.goto(f'http://127.0.0.1:{server.server_port}/audio-test')
        if not page.evaluate('!!(window.AudioContext||window.webkitAudioContext)'):
            page.add_script_tag(url='/play/audio.js')
            page.get_by_role('button').click()
            page.evaluate("arkAudio('initialize',0,'');arkAudio('effect',0,'merge')")
            assert not errors, errors
            print(f'SKIP {name} playback: this browser build has no Web Audio; graceful fallback passed', flush=True)
            browser.close()
            continue
        page.evaluate('''() => {
          const Original=window.AudioContext||window.webkitAudioContext;
          window.probe={starts:[],stops:0};
          window.AudioContext=class extends Original {
            constructor(){super(); window.probe.context=this;}
            createBufferSource(){
              const source=super.createBufferSource(), start=source.start.bind(source), stop=source.stop.bind(source);
              source.start=(...args)=>{probe.starts.push({loop:source.loop,duration:source.buffer.duration});start(...args);};
              source.stop=(...args)=>{probe.stops++;stop(...args);};
              return source;
            }
          };
        }''')
        page.add_script_tag(url='/play/audio.js')
        page.evaluate("arkAudio('initialize',0,'')")
        page.get_by_role('button').click()
        page.wait_for_function("probe.context.state==='running'")
        page.evaluate("arkAudio('music',.35,'')")
        page.wait_for_function('probe.starts.some(s=>s.loop)', timeout=20000)
        for sound in ['merge', 'incorrect', 'complete']:
            count = page.evaluate('probe.starts.length')
            page.evaluate('(n)=>window.beforeSound=n', count)
            page.wait_for_function("name => {arkAudio('effect',0,name); return probe.starts.length>beforeSound;}", arg=sound, polling=200)
        assert len(set(page.evaluate('probe.starts.filter(s=>!s.loop).map(s=>s.duration)'))) >= 2
        count = page.evaluate('probe.starts.length')
        page.evaluate("arkAudio('volume',0,'');arkAudio('effect',0,'merge')")
        assert page.evaluate('probe.starts.length') == count
        page.evaluate("arkAudio('pause',0,'')")
        assert page.evaluate('probe.stops') >= 1
        page.evaluate("arkAudio('music',.2,'')")
        page.wait_for_function('(n)=>probe.starts.length>n', arg=count)
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))")
        count = page.evaluate('probe.starts.length')
        page.evaluate("arkAudio('volume',.7,'');arkAudio('effect',0,'incorrect')")
        assert page.evaluate('probe.starts.length') == count
        page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))")
        page.wait_for_function('(n)=>probe.starts.length>n', arg=count)
        page.evaluate("arkAudio('close',0,'')")
        assert not errors, errors
        print(f'PASS {name}: gesture unlock, music, correct/error/pass sounds, mute and visibility lifecycle', flush=True)
        browser.close()
server.shutdown()
