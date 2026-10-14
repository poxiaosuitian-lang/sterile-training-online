import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LevelsModule } from '../levels/levels.module';
import { AdminController, AdminGuard } from './admin.controller';
import { ReleaseController } from './release.controller';

@Module({imports: [AuthModule, LevelsModule], controllers: [AdminController, ReleaseController], providers: [AdminGuard]})
export class AdminModule {}
