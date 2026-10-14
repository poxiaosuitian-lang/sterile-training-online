import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';
import { LevelsModule } from '../levels/levels.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [AuthModule, LevelsModule, LeaderboardModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
