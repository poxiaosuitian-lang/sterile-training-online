import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LevelsModule } from '../levels/levels.module';
import { AdminController, AdminGuard } from './admin.controller';
import { ReleaseController } from './release.controller';
import { PlayerManagementService } from './player-management';

@Module({imports: [AuthModule, LevelsModule], controllers: [AdminController, ReleaseController], providers: [AdminGuard, PlayerManagementService]})
export class AdminModule {}
