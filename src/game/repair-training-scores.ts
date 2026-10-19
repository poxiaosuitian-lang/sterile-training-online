import { Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LevelsService } from '../levels/levels.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';

// Regrade only completed training affected by the old hunt/maze penalties.
// Keep original ScoreEvents as audit history; do not create another attempt.
export async function repairTrainingScores(
  prisma: PrismaService, levels: LevelsService, leaderboard: LeaderboardService,
  apply = false,
) {
  let cursor: string | undefined;
  let eligible = 0;
  let updated = 0;
  const levelIds = ['level-2-glove-forceps-hunt', 'level-3-container-maze'];
  for (;;) {
    const batch = await prisma.gameSession.findMany({
      where: {levelId:{in:levelIds}, status:{in:[SessionStatus.COMPLETED, SessionStatus.FAILED]}},
      orderBy:{id:'asc'}, take:100, ...(cursor ? {cursor:{id:cursor},skip:1} : {}),
    });
    if (!batch.length) break;
    for (const candidate of batch) {
      const saved = await prisma.$transaction(async tx => {
        // Use the same player lock as normal submissions.
        await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${candidate.playerId} FOR UPDATE`;
        const session = await tx.gameSession.findUniqueOrThrow({where:{id:candidate.id}});
        if (!session.submission || !session.receipt || !session.completedAt) return null;
        const level = levels.sessionLevel(levels.find(session.levelId), session.challenge as Record<string, unknown>);
        const validation = levels.validate(level, session.submission as Record<string, unknown>);
        if (!validation.passed || validation.score <= (session.score ?? 0)) return null;
        eligible++;
        if (!apply) return null;
        const key = {playerId:session.playerId, levelId:session.levelId};
        const progress = await tx.levelProgress.findUnique({where:{playerId_levelId:key}});
        // Missing progress means an inconsistent record requiring manual review.
        if (!progress) throw new Error(`Missing progress for session ${session.id}`);
        const next = levels.next(session.levelId);
        const corrected = await tx.levelProgress.update({where:{playerId_levelId:key}, data:{
          completed:true, unlocked:true,
          bestScore:Math.max(progress.bestScore, validation.score),
          bestStars:Math.max(progress.bestStars, validation.stars),
          completedAt:progress.completedAt ?? session.completedAt,
        }});
        await tx.gameSession.update({where:{id:session.id},data:{
          score:validation.score, stars:validation.stars, status:SessionStatus.COMPLETED,
          receipt:{...validation,bestScore:corrected.bestScore,bestStars:corrected.bestStars,
            nextLevelId:next?.id ?? null, scoringCorrection:{
              previousReceipt:session.receipt, rule:'training-completion-2026-10-19',
              correctedAt:new Date().toISOString(),
            }} as unknown as Prisma.InputJsonValue,
        }});
        if (next) await tx.levelProgress.upsert({
          where:{playerId_levelId:{playerId:session.playerId,levelId:next.id}},
          create:{playerId:session.playerId,levelId:next.id,unlocked:true},
          update:{unlocked:true},
        });
        return corrected;
      });
      if (saved) {
        updated++;
        const player = await prisma.player.findUniqueOrThrow({where:{id:saved.playerId}});
        const total = await prisma.levelProgress.aggregate({where:{playerId:saved.playerId},_sum:{bestScore:true}});
        await leaderboard.recordBestEffort({playerId:player.id,nickname:player.nickname,
          levelId:saved.levelId,levelScore:saved.bestScore,overallScore:total._sum.bestScore ?? 0});
      }
    }
    cursor = batch[batch.length - 1].id;
  }
  return {mode:apply ? 'apply' : 'dry-run', eligible, updated};
}
