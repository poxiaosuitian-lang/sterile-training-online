import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

@Controller('app')
export class ReleaseController {
  private readonly directory = process.env.RELEASE_DIR || join(process.cwd(), 'deploy/releases');

  @Get('release')
  @Header('Cache-Control','no-store')
  async latest() {
    try {
      const data = JSON.parse(await readFile(join(this.directory, 'latest.json'), 'utf8'));
      if (!Number.isInteger(data.versionCode) || data.versionCode < 1 ||
        !/^[a-zA-Z0-9._-]+\.apk$/.test(data.fileName) ||
        typeof data.versionName !== 'string' || typeof data.notes !== 'string') throw new Error();
      await stat(join(this.directory, data.fileName));
      return {versionCode:data.versionCode, versionName:data.versionName, notes:data.notes,
        downloadPath:`/app/download/${data.fileName}`};
    } catch { return {versionCode:0, versionName:'', notes:'', downloadPath:null}; }
  }

  @Get('download/:file')
  async download(@Param('file') file: string) {
    if (!/^[a-zA-Z0-9._-]+\.apk$/.test(file)) throw new NotFoundException();
    const path = join(this.directory, file);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('安装包不存在');
    return new StreamableFile(createReadStream(path), {
      type:'application/vnd.android.package-archive', length:info.size,
      disposition:`attachment; filename="${file}"`,
    });
  }
}
