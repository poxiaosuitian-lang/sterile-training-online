import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LevelsModule } from '../levels/levels.module';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [AuthModule, LevelsModule],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
