import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LevelsModule } from '../levels/levels.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginRateGuard } from './login-rate.guard';

@Module({
  imports: [
    LevelsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'development-only-secret'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', '30d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, LoginRateGuard],
  exports: [AuthGuard, JwtModule, LoginRateGuard],
})
export class AuthModule {}
