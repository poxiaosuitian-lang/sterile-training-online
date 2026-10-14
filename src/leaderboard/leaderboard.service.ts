import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

interface RecordScoreInput {
  playerId: string;
  nickname: string;
  levelId: string;
  levelScore: number;
  overallScore: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly nicknameKey = 'leaderboard:nicknames';

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async recordBestEffort(input: RecordScoreInput) {
    try {
      await this.redis.client
        .multi()
        .hSet(this.nicknameKey, input.playerId, input.nickname)
        .zAdd(`leaderboard:level:${input.levelId}`, {
          score: input.levelScore,
          value: input.playerId,
        }, { GT: true })
        .zAdd('leaderboard:overall', {
          score: input.overallScore,
          value: input.playerId,
        }, { GT: true })
        .exec();
    } catch (error) {
      this.logger.warn(
        `Redis 排行榜同步失败，成绩已保存在 PostgreSQL：${String(error)}`,
      );
    }
  }

  async list(scope: string, limit: number) {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const key =
      scope === 'overall'
        ? 'leaderboard:overall'
        : `leaderboard:level:${scope}`;

    try {
      const [scores, nicknames] = await Promise.all([
        this.redis.client.zRangeWithScores(key, 0, safeLimit - 1, {
          REV: true,
        }),
        this.redis.client.hGetAll(this.nicknameKey),
      ]);
      if (scores.length > 0) {
        return scores.map((entry: {value:string; score:number}, index: number) => ({
          rank: index + 1,
          playerId: entry.value,
          nickname: nicknames[entry.value] ?? '匿名训练员',
          score: entry.score,
        }));
      }
    } catch (error) {
      this.logger.warn(`Redis 排行榜读取失败，切换数据库查询：${String(error)}`);
    }

    return scope === 'overall'
      ? this.overallFallback(safeLimit)
      : this.levelFallback(scope, safeLimit);
  }

  private async levelFallback(levelId: string, limit: number) {
    const rows = await this.prisma.levelProgress.findMany({
      where: { levelId, bestScore: { gt: 0 } },
      orderBy: { bestScore: 'desc' },
      take: limit,
      include: { player: { select: { nickname: true } } },
    });
    return rows.map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      nickname: row.player.nickname,
      score: row.bestScore,
    }));
  }

  private async overallFallback(limit: number) {
    const rows = await this.prisma.levelProgress.groupBy({
      by: ['playerId'],
      _sum: { bestScore: true },
      orderBy: { _sum: { bestScore: 'desc' } },
      take: limit,
    });
    const players = await this.prisma.player.findMany({
      where: { id: { in: rows.map((row) => row.playerId) } },
      select: { id: true, nickname: true },
    });
    const names = new Map(players.map((player) => [player.id, player.nickname]));
    return rows.map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      nickname: names.get(row.playerId) ?? '匿名训练员',
      score: row._sum.bestScore ?? 0,
    }));
  }
}
