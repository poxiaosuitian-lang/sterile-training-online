import express = require('express');
import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import { installWebClient } from './web-client';

describe('Browser client delivery', () => {
  let server: Server;
  let base: string;
  beforeAll(done => {
    const app = express();
    installWebClient({use:app.use.bind(app)} as unknown as INestApplication);
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
      done();
    });
  });
  afterAll(done => { server.close(done); });
  it('serves player entry, local renderer and assets with revalidation', async () => {
    const page = await fetch(base+'/play/');
    expect(page.status).toBe(200);
    expect(page.headers.get('cache-control')).toBe('no-cache');
    expect(await page.text()).toContain('无菌方舟');
    for (const path of ['flutter_bootstrap.js','main.dart.js','audio.js','manifest.json',
      'canvaskit/canvaskit.wasm','assets/assets/fonts/NotoSansSC.ttf',
      'assets/assets/generated/cover/ark_route_cover_background_clean.png']) {
      const r = await fetch(base+'/play/'+path,{method:'HEAD'});
      expect(r.status).toBe(200);
      if (path.endsWith('.wasm')) expect(r.headers.get('content-type')).toContain('application/wasm');
      if (path.endsWith('.png')) expect(r.headers.get('content-type')).toContain('image/png');
      if (path.endsWith('.js')) expect(r.headers.get('content-type')).toContain('javascript');
    }
    expect((await fetch(base+'/play/missing.js')).status).toBe(404);
    expect((await fetch(base+'/api/v1/admin')).status).toBe(404);
    const bootstrap = await (await fetch(base+'/play/flutter_bootstrap.js')).text();
    expect(bootstrap).toContain('fontFallbackBaseUrl: \'font-fallback/\'');
    expect(bootstrap).toContain('initializeEngine(engineConfig)');
  });
});
