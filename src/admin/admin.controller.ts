import { Body, CanActivate, Controller, Delete, ExecutionContext, Get, Header, Injectable, Param, ParseUUIDPipe, Post, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CreatePlayerDto, DeveloperCodeDto, GameAccessDto, ImportPlayersDto, PlayerManagementService, RegistrationDto, ResetPlayersDto } from './player-management';
import { JwtService } from '@nestjs/jwt';
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { LevelsService } from '../levels/levels.service';
import { LoginDto } from '../auth/dto/account.dto';
import { LoginRateGuard } from '../auth/login-rate.guard';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const header = context.switchToHttp().getRequest().headers.authorization as string | undefined;
    try {
      const payload = await this.jwt.verifyAsync(header?.startsWith('Bearer ') ? header.slice(7) : '');
      if (payload.role !== 'admin') throw new Error();
      return true;
    } catch { throw new UnauthorizedException('请登录管理后台'); }
  }
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService,
    private readonly levels: LevelsService, private readonly management:PlayerManagementService) {}

  @Get('settings')
  @UseGuards(AdminGuard)
  settings() { return this.management.settings(); }

  @Post('game-access')
  @UseGuards(AdminGuard)
  gameAccess(@Body() input:GameAccessDto) { return this.management.setGameAccess(input); }

  @Post('players')
  @UseGuards(AdminGuard)
  createPlayer(@Body() input:CreatePlayerDto) { return this.management.create(input); }

  @Post('developer-code')
  @UseGuards(AdminGuard)
  developerCode(@Body() input:DeveloperCodeDto) { return this.management.setDeveloperCode(input); }

  @Post('settings')
  @UseGuards(AdminGuard)
  setSettings(@Body() input:RegistrationDto) { return this.management.setRegistration(input); }

  @Get('players/ids')
  @UseGuards(AdminGuard)
  ids(@Query('search') search='') { return this.management.ids(search.slice(0,64)); }

  @Post('players/reset')
  @UseGuards(AdminGuard)
  reset(@Body() input:ResetPlayersDto) { return this.management.reset(input); }

  @Post('players/import')
  @UseGuards(AdminGuard)
  importPlayers(@Body() input:ImportPlayersDto) { return this.management.importPlayers(input); }

  @Delete('players/:id')
  @UseGuards(AdminGuard)
  remove(@Param('id',ParseUUIDPipe) id:string) { return this.management.remove(id); }

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  page() { return readFile(join(process.cwd(), 'public/admin.html'), 'utf8'); }

  @Post('login')
  @UseGuards(LoginRateGuard)
  async login(@Body() input: LoginDto) {
    const expected = process.env.ADMIN_PASSWORD;
    const digest = (text: string) => createHash('sha256').update(text).digest();
    if (!expected || expected.length < 12 || input.username !== process.env.ADMIN_USERNAME ||
      !timingSafeEqual(digest(input.password), digest(expected))) {
      throw new UnauthorizedException('管理员账号或密码错误');
    }
    return { accessToken: await this.jwt.signAsync({ role: 'admin' }, { expiresIn: '8h' }) };
  }

  private async players(search = '', page = 1, all = false) {
    const where = { username: { not: null }, ...(search ? { OR: [
      { username: { contains: search, mode: 'insensitive' as const } },
      { nickname: { contains: search, mode: 'insensitive' as const } },
    ] } : {}) };
    const [total, players] = await Promise.all([
      this.prisma.player.count({ where }),
      this.prisma.player.findMany({where, orderBy: {createdAt:'desc'},
        ...(all ? {} : {skip:(page - 1) * 50, take:50}),
        select: {id:true, username:true, nickname:true, createdAt:true, lastLoginAt:true,
          progress:true, _count:{select:{sessions:true, scoreEvents:true}}},
      }),
    ]);
    const levels = this.levels.listPublic();
    return { total, page, pageSize:50, players: players.map(p => {
      const progress = levels.map(l => ({levelId:l.id, title:l.title,
        completed:p.progress.find(v => v.levelId === l.id)?.completed ?? false,
        bestScore:p.progress.find(v => v.levelId === l.id)?.bestScore ?? 0,
        attempts:p.progress.find(v => v.levelId === l.id)?.attempts ?? 0}));
      return {...p, progress, completed:progress.filter(v => v.completed).length,
        completionRate:Math.round(progress.filter(v => v.completed).length / levels.length * 100),
        totalScore:progress.reduce((sum, v) => sum + v.bestScore, 0)};
    }) };
  }

  @Get('players')
  @UseGuards(AdminGuard)
  list(@Query('search') search = '', @Query('page') page = '1') {
    return this.players(search.slice(0, 64), Math.max(1, Math.floor(Number(page) || 1)));
  }

  @Get('players/:id/sessions')
  @UseGuards(AdminGuard)
  async sessions(@Param('id') id: string, @Query('page') page = '1') {
    const offset = Math.max(1, Math.floor(Number(page) || 1));
    const [total, items] = await Promise.all([
      this.prisma.gameSession.count({where:{playerId:id}}),
      this.prisma.gameSession.findMany({where:{playerId:id}, orderBy:{startedAt:'desc'},
        skip:(offset-1)*50, take:50,
        select:{id:true,levelId:true,status:true,score:true,stars:true,startedAt:true,completedAt:true,submission:true}}),
    ]);
    return {total, page:offset, pageSize:50, items:items.map(s => {
      const input = s.submission as Record<string, unknown> | null;
      return {...s, title:this.levels.find(s.levelId).title,
        elapsedSeconds: typeof input?.elapsedSeconds === 'number' ? input.elapsedSeconds : null};
    })};
  }

  @Get('export')
  @UseGuards(AdminGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="training-results.csv"')
  async export(@Query('search') search = '') {
    const data = await this.players(search.slice(0,64), 1, true);
    const rows: unknown[][] = [['账号','昵称','完成关数','完成率','总成绩','关卡','已通过','最高分','提交次数','最近登录']];
    for (const p of data.players) for (const l of p.progress) rows.push([
      p.username,p.nickname,p.completed,`${p.completionRate}%`,p.totalScore,l.title,
      l.completed ? '是':'否',l.bestScore,l.attempts,p.lastLoginAt?.toISOString() ?? '',
    ]);
    return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  }
}
