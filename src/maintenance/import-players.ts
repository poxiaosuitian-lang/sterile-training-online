import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { ImportPlayersDto, PlayerManagementService } from '../admin/player-management';

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--file');
  if (index < 0 || !args[index+1]) throw new Error('用法: node dist/maintenance/import-players.js --file /tmp/players.json [--apply]');
  const document = JSON.parse(await readFile(args[index+1], 'utf8'));
  const input = plainToInstance(ImportPlayersDto, {
    players:document.players, initialPassword:process.env.ROSTER_INITIAL_PASSWORD,
  });
  if ((await validate(input,{whitelist:true,forbidNonWhitelisted:true})).length) {
    throw new Error('名单格式或初始密码无效；请通过 ROSTER_INITIAL_PASSWORD 环境变量提供 8–128 位初始密码');
  }
  const prisma = new PrismaService();
  try {
    const report = await new PlayerManagementService(prisma).importPlayers(input,args.includes('--apply'));
    console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'dry-run',...report}));
  } finally { await prisma.$disconnect(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
