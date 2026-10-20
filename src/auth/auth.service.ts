import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/account.dto';
import { hashPassword, verifyPassword } from './password';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { LevelsService } from '../levels/levels.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly levels: LevelsService,
  ) {}

  async guestLogin(input: GuestLoginDto) {
    if (process.env.ALLOW_GUEST_LOGIN !== 'true') {
      throw new ForbiddenException('请注册或使用账号密码登录');
    }
    const player = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.player.upsert({
        where: { deviceId: input.deviceId },
        create: { deviceId: input.deviceId, nickname: input.nickname },
        update: { nickname: input.nickname },
      });

      await tx.levelProgress.upsert({
        where: {
          playerId_levelId: {
            playerId: saved.id,
            levelId: this.levels.firstLevelId,
          },
        },
        create: {
          playerId: saved.id,
          levelId: this.levels.firstLevelId,
          unlocked: true,
        },
        update: { unlocked: true },
      });
      return saved;
    });

    return {
      accessToken: await this.jwt.signAsync({
        playerId: player.id,
        deviceId: player.deviceId,
        authVersion: player.authVersion,
      }),
      player: {
        id: player.id,
        nickname: player.nickname,
      },
    };
  }

  async register(input: RegisterDto) {
    const passwordHash = await hashPassword(input.password);
    try {
      const player = await this.prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(82491021)`;
        const setting = await tx.appSetting.findUnique({where:{key:'registrationEnabled'}});
        if (setting?.value === false) throw new ForbiddenException('注册已关闭，请使用分配的账号登录');
        return tx.player.create({ data: {
        username: input.username.toLowerCase(), nickname: input.nickname.trim(),
        deviceId: `account-${randomUUID()}`, passwordHash,
        lastLoginAt: new Date(),
        } });
      });
      return this.issueToken(player);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('账号已存在，请换一个账号或直接登录');
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const player = await this.prisma.player.findUnique({
      where: { username: input.username.toLowerCase() },
    });
    // Run the same password derivation for unknown accounts.
    const fallback = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPassword(input.password, player?.passwordHash ?? fallback);
    if (!player || !valid) throw new UnauthorizedException('账号或密码错误');
    await this.prisma.player.update({ where: { id: player.id }, data: { lastLoginAt: new Date() } });
    return this.issueToken(player);
  }

  async options() {
    const setting = await this.prisma.appSetting.findUnique({where:{key:'registrationEnabled'}});
    return {registrationEnabled: setting?.value !== false};
  }

  async changePassword(playerId: string, input: ChangePasswordDto) {
    if (input.currentPassword === input.newPassword) throw new BadRequestException('新密码不能与原密码相同');
    const passwordHash = await hashPassword(input.newPassword);
    const player = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${playerId} FOR UPDATE`;
      const current = await tx.player.findUnique({where:{id:playerId}});
      if (!current?.passwordHash || !await verifyPassword(input.currentPassword, current.passwordHash)) {
        throw new BadRequestException('原密码不正确');
      }
      return tx.player.update({where:{id:playerId}, data:{passwordHash, authVersion:{increment:1}}});
    });
    return this.issueToken(player);
  }

  private async issueToken(player: { id: string; deviceId: string; nickname: string; username: string | null; authVersion:number }) {
    return {
      accessToken: await this.jwt.signAsync({ playerId: player.id, deviceId: player.deviceId, role: 'player', authVersion:player.authVersion }),
      player: { id: player.id, nickname: player.nickname, username: player.username },
    };
  }
}
