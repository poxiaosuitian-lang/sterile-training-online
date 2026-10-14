import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';

@Injectable()
export class LoginRateGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ ip: string }>();
    const now = Date.now();
    for (const [key, value] of this.attempts) {
      if (value.until <= now) this.attempts.delete(key);
    }
    const entry = this.attempts.get(request.ip) ?? { count: 0, until: now + 60000 };
    if (++entry.count > 20 || this.attempts.size > 10000) {
      throw new HttpException('操作过于频繁，请稍后再试', 429);
    }
    this.attempts.set(request.ip, entry);
    return true;
  }
}
