import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LevelsService } from '../levels/levels.service';
import { SubmitLevelDto } from './dto/submit-level.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GameService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly levels: LevelsService,
    private readonly jwt: JwtService,
  ) {}

  async progress(playerId: string) {
    const progress = await this.prisma.levelProgress.findMany({
      where: { playerId },
    });
    const progressMap = new Map(progress.map((item) => [item.levelId, item]));

    return this.levels.listPublic().map((level) => {
      const saved = progressMap.get(level.id);
      return {
        ...level,
        progress: {
          unlocked: level.order === 1 || saved?.unlocked === true,
          completed: saved?.completed ?? false,
          attempts: saved?.attempts ?? 0,
          bestScore: saved?.bestScore ?? 0,
          bestStars: saved?.bestStars ?? 0,
        },
      };
    });
  }

  async start(
    playerId: string,
    levelId: string,
    developerMode = false,
    developerToken?: string,
  ) {
    if (developerMode) {
      try {
        const grant = await this.jwt.verifyAsync(developerToken ?? '');
        const setting = await this.prisma.appSetting.findUnique({where:{key:'developerAccess'}});
        const access = setting?.value as {hash?:string;version?:string} | null;
        const player = await this.prisma.player.findUnique({where:{id:playerId}});
        if (!access?.hash || grant.role !== 'developer-grant' || grant.playerId !== playerId ||
          grant.codeVersion !== access.version || grant.authVersion !== player?.authVersion) throw new Error();
      } catch { throw new ForbiddenException('开发者授权无效，请重新输入校验码'); }
    }
    const level = this.levels.find(levelId);
    const challenge = {...this.levels.createChallenge(level), ...(developerMode ? {developerMode:true} : {})};
    const expiresAt = level.timeLimitSeconds > 0
      ? new Date(Date.now() + level.timeLimitSeconds * 1000)
      : new Date('9999-12-31T23:59:59.999Z');
    const session = await this.prisma.$transaction(async tx => {
      const players = await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "Player" WHERE id = ${playerId} FOR UPDATE`;
      if (!players.length) throw new NotFoundException('玩家账号不存在');
      const progress = await tx.levelProgress.findUnique({where:{playerId_levelId:{playerId,levelId}}});
      if (!developerMode && level.order !== 1 && !progress?.unlocked) throw new ForbiddenException('请先完成上一关');
      return tx.gameSession.create({data:{playerId,levelId,levelVersion:level.version,challenge,expiresAt}});
    });

    return {
      sessionId: session.id,
      challenge,
      expiresAt: session.expiresAt,
      level: this.levels.toPublic(this.levels.sessionLevel(level, challenge)),
    };
  }

  async submit(
    playerId: string,
    sessionId: string,
    input: SubmitLevelDto,
  ) {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.playerId !== playerId) {
      throw new NotFoundException('游戏会话不存在');
    }
    const level = this.levels.find(session.levelId);
    if (level.timeLimitSeconds > 0 && session.expiresAt.getTime() < Date.now()) {
      await this.prisma.gameSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.EXPIRED },
      });
      throw new BadRequestException('本次关卡已超时，请重新开始');
    }

    const challenge = session.challenge as Record<string, unknown>;
    if (challenge.nonce !== input.challengeNonce) {
      throw new BadRequestException('关卡挑战码无效');
    }

    if (session.receipt) return session.receipt;
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('该游戏会话已结束');
    }
    const validation = this.levels.validate(this.levels.sessionLevel(level, challenge), input.result);
    const nextLevel = validation.passed ? this.levels.next(level.id) : undefined;

    const outcome = await this.prisma.$transaction(async (tx) => {
      // Serialize all score writes for a player, including concurrent retries and
      // different sessions. The saved receipt makes a lost HTTP response retryable.
      await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${playerId} FOR UPDATE`;
      const latest = await tx.gameSession.findUnique({where:{id:session.id}});
      if (!latest) throw new NotFoundException('游戏记录已重置，请重新开始');
      if (latest.receipt) return {receipt:latest.receipt, saved:null};
      if (latest.status !== SessionStatus.ACTIVE) throw new BadRequestException('该游戏会话已结束');
      const current = await tx.levelProgress.findUnique({
        where: {
          playerId_levelId: { playerId, levelId: level.id },
        },
      });
      const completedAt =
        validation.passed && !current?.completed
          ? new Date()
          : current?.completedAt;

      const progress = await tx.levelProgress.upsert({
        where: {
          playerId_levelId: { playerId, levelId: level.id },
        },
        create: {
          playerId,
          levelId: level.id,
          unlocked: true,
          completed: validation.passed,
          attempts: 1,
          bestScore: validation.score,
          bestStars: validation.stars,
          completedAt,
        },
        update: {
          completed: current?.completed || validation.passed,
          attempts: { increment: 1 },
          bestScore: Math.max(current?.bestScore ?? 0, validation.score),
          bestStars: Math.max(current?.bestStars ?? 0, validation.stars),
          completedAt,
        },
      });

      const receipt = {
        ...validation, bestScore:progress.bestScore, bestStars:progress.bestStars,
        nextLevelId:nextLevel?.id ?? null,
      };
      await tx.gameSession.update({
        where: { id: session.id },
        data: {
          status: validation.passed
            ? SessionStatus.COMPLETED
            : SessionStatus.FAILED,
          submission: input.result as Prisma.InputJsonValue,
          receipt: receipt as unknown as Prisma.InputJsonValue,
          score: validation.score,
          stars: validation.stars,
          completedAt: new Date(),
        },
      });

      await tx.scoreEvent.create({
        data: {
          playerId,
          levelId: level.id,
          score: validation.score,
          stars: validation.stars,
        },
      });

      if (nextLevel) {
        await tx.levelProgress.upsert({
          where: {
            playerId_levelId: {
              playerId,
              levelId: nextLevel.id,
            },
          },
          create: {
            playerId,
            levelId: nextLevel.id,
            unlocked: true,
          },
          update: { unlocked: true },
        });
      }
      return {receipt, saved:progress};
    });

    return outcome.receipt;
  }
}
