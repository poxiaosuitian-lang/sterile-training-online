import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from './auth-user';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('请先登录');
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthUser>(token);
      if (!request.user.playerId || request.user.role === 'admin') {
        throw new UnauthorizedException('请使用玩家账号登录');
      }
      return true;
    } catch {
      throw new UnauthorizedException('登录凭证无效或已过期');
    }
  }
}
