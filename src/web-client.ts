import { INestApplication } from '@nestjs/common';
import { static as serveStatic } from 'express';
import { join } from 'node:path';

export function installWebClient(app: INestApplication) {
  // Revalidate all files so a newly deployed build cannot mix old JS/assets.
  app.use('/play', serveStatic(join(process.cwd(), 'public/play'), {
    index: 'index.html', maxAge: 0,
    setHeaders: res => { res.setHeader('Cache-Control', 'no-cache'); },
  }));
}
