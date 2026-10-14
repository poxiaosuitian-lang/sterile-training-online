import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { LevelsService } from '../levels/levels.service';
import { GameService } from './game.service';

describe('GameService developer mode', () => {
  const lockedLevelId = 'level-2-glove-forceps-hunt';
  let service: GameService;
  let levelProgressFindUnique: jest.Mock;
  let gameSessionUpdateMany: jest.Mock;
  let gameSessionCreate: jest.Mock;

  beforeEach(() => {
    levelProgressFindUnique = jest.fn().mockResolvedValue(null);
    gameSessionUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    gameSessionCreate = jest.fn().mockImplementation(({ data }) => ({
      id: 'developer-session',
      expiresAt: data.expiresAt,
    }));

    const prisma = {
      levelProgress: { findUnique: levelProgressFindUnique },
      gameSession: {
        updateMany: gameSessionUpdateMany,
        create: gameSessionCreate,
      },
    } as unknown as PrismaService;

    service = new GameService(
      prisma,
      new LevelsService(),
      {} as LeaderboardService,
    );
  });

  it('keeps a locked level blocked by default', async () => {
    await expect(
      service.start('player-1', lockedLevelId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(gameSessionCreate).not.toHaveBeenCalled();
  });

  it('rejects developer mode in online testing', async () => {
    await expect(service.start('player-1', lockedLevelId, true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(gameSessionCreate).not.toHaveBeenCalled();
  });
});
