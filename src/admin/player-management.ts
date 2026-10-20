import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { hashPassword } from '../auth/password';

export class RegistrationDto {
  @IsBoolean()
  registrationEnabled: boolean;
}
export class DeveloperCodeDto {
  @IsString()
  @Length(0,64)
  code: string;
}
export class ResetPlayersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @ArrayUnique()
  @IsUUID('all', {each:true})
  playerIds: string[];
}
export class RosterPlayerDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/)
  username: string;

  @IsString()
  @Matches(/\S/)
  @Length(1,32)
  nickname: string;
}
export class ImportPlayersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({each:true})
  @Type(() => RosterPlayerDto)
  players: RosterPlayerDto[];

  @IsString()
  @Length(8,128)
  initialPassword: string;
}
export class CreatePlayerDto extends RosterPlayerDto {
  @IsString()
  @Length(8,128)
  initialPassword: string;
}

@Injectable()
export class PlayerManagementService {
  constructor(private readonly prisma:PrismaService) {}

  async create(input:CreatePlayerDto) {
    const passwordHash = await hashPassword(input.initialPassword);
    try {
      return await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(82491021)`;
        return tx.player.create({data:{
        username:input.username.toLowerCase(),nickname:input.nickname.trim(),
        deviceId:`account-${randomUUID()}`,passwordHash,
      },select:{id:true,username:true,nickname:true}});
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('学号已存在，请核对后再添加');
      }
      throw error;
    }
  }

  async settings() {
    const value = await this.prisma.appSetting.findUnique({where:{key:'registrationEnabled'}});
    const developer = await this.prisma.appSetting.findUnique({where:{key:'developerAccess'}});
    const access = developer?.value as {hash?:string} | null;
    return {registrationEnabled:value?.value !== false,developerCodeConfigured:!!access?.hash};
  }
  async setDeveloperCode(input:DeveloperCodeDto) {
    if (input.code && (input.code.length < 6 || input.code.trim() !== input.code)) {
      throw new BadRequestException('校验码需为 6–64 位，且首尾不能有空格');
    }
    const value = {hash:input.code ? await hashPassword(input.code) : '',version:randomUUID()};
    await this.prisma.appSetting.upsert({where:{key:'developerAccess'},
      create:{key:'developerAccess',value},update:{value}});
    return {developerCodeConfigured:!!input.code};
  }
  async setRegistration(input:RegistrationDto) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(82491021)`;
      await tx.appSetting.upsert({where:{key:'registrationEnabled'},
        create:{key:'registrationEnabled',value:input.registrationEnabled},
        update:{value:input.registrationEnabled}});
      return input;
    });
  }
  async ids(search:string) {
    const players = await this.prisma.player.findMany({where:{username:{not:null},
      ...(search ? {OR:[{username:{contains:search,mode:'insensitive' as const}},
        {nickname:{contains:search,mode:'insensitive' as const}}]} : {})},
      select:{id:true},orderBy:{id:'asc'},take:10001});
    if (players.length > 10000) throw new BadRequestException('请缩小搜索范围后再全选（最多 10000 人）');
    return {playerIds:players.map(p=>p.id)};
  }
  async reset(input:ResetPlayersDto) {
    return this.prisma.$transaction(async tx => {
      const ids = [...input.playerIds].sort();
      const rows = await tx.$queryRaw<Array<{id:string}>>(Prisma.sql`SELECT id FROM "Player"
        WHERE id IN (${Prisma.join(ids)}) AND username IS NOT NULL ORDER BY id FOR UPDATE`);
      const playerId = {in:rows.map(p=>p.id)};
      await tx.gameSession.deleteMany({where:{playerId}});
      await tx.scoreEvent.deleteMany({where:{playerId}});
      await tx.levelProgress.deleteMany({where:{playerId}});
      return {resetCount:rows.length};
    },{timeout:30000});
  }
  async remove(id:string) {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "Player" WHERE id = ${id} AND username IS NOT NULL FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('玩家账号不存在');
      await tx.player.delete({where:{id}});
      return {deleted:true};
    });
  }
  async importPlayers(input:ImportPlayersDto, apply=true) {
    const unique = new Map<string,string>();
    for (const p of input.players) {
      const key = p.username.toLowerCase(), name = p.nickname.trim();
      if (unique.has(key) && unique.get(key) !== name) {
        throw new BadRequestException('名单包含同账号不同姓名，请先核对');
      }
      unique.set(key,name);
    }
    const existing = await this.prisma.player.findMany({
      where:{username:{in:[...unique.keys()]}},select:{username:true,nickname:true},
    });
    const names = new Map(existing.map(p=>[p.username!,p.nickname]));
    const conflicts = [...unique].filter(([u,n])=>names.has(u) && names.get(u)!==n).map(([username])=>username);
    const pending = [...unique].filter(([u])=>!names.has(u));
    const report = {total:unique.size,duplicates:input.players.length-unique.size,
      existing:existing.length,conflicts,created:0,wouldCreate:pending.length};
    if (conflicts.length) throw new BadRequestException({message:'名单与已有账号姓名冲突，未导入',conflicts});
    if (!apply) return report;
    // Hash separately so every account receives an independent random salt.
    const data: Prisma.PlayerCreateManyInput[] = [];
    for (const [username,nickname] of pending) data.push({
      username,nickname,deviceId:`account-${randomUUID()}`,passwordHash:await hashPassword(input.initialPassword),
    });
    // A single atomic insert; concurrent imports never replace existing credentials.
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(82491021)`;
      const current = await tx.player.findMany({where:{username:{in:[...unique.keys()]}},
        select:{username:true,nickname:true}});
      if (current.some(p=>unique.get(p.username!)!==p.nickname)) {
        throw new ConflictException('导入期间账号信息发生变化，请核对后重试');
      }
      const result = await tx.player.createMany({data,skipDuplicates:true});
      return {...report,created:result.count,existing:unique.size-result.count};
    });
  }
}
