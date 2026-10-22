import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LevelsService } from '../levels/levels.service';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';

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

    const mock = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      appSetting: {findUnique:jest.fn().mockResolvedValue(null)},
      $queryRaw: jest.fn().mockResolvedValue([{id:'player-1'}]),
      levelProgress: { findUnique: levelProgressFindUnique },
      gameSession: {
        updateMany: gameSessionUpdateMany,
        create: gameSessionCreate,
      },
    };
    const prisma = {...mock, $transaction: (fn: (tx:typeof mock)=>unknown)=>fn(mock)} as unknown as PrismaService;

    service = new GameService(
      prisma,
      new LevelsService(),
      new JwtService({secret:'test-only-secret'}),
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
