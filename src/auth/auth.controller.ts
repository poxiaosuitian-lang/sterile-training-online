import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordDto, DeveloperVerifyDto, LoginDto, RegisterDto } from './dto/account.dto';
import { AuthGuard } from './auth.guard';
import { AuthUser } from './auth-user';
import { LoginRateGuard } from './login-rate.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@ApiTags('登录')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('options')
  options() { return this.authService.options(); }

  @Post('developer/verify')
  @UseGuards(LoginRateGuard, AuthGuard)
  verifyDeveloper(@Req() req:{user:AuthUser}, @Body() input:DeveloperVerifyDto) {
    return this.authService.verifyDeveloperCode(req.user.playerId,input.code);
  }

  @Post('password')
  @UseGuards(LoginRateGuard, AuthGuard)
  changePassword(@Req() req: {user:AuthUser}, @Body() input:ChangePasswordDto) {
    return this.authService.changePassword(req.user.playerId, input);
  }

  @Post('register')
  @UseGuards(LoginRateGuard)
  register(@Body() input: RegisterDto) { return this.authService.register(input); }

  @Post('login')
  @UseGuards(LoginRateGuard)
  login(@Body() input: LoginDto) { return this.authService.login(input); }

  @Post('guest')
  @UseGuards(LoginRateGuard)
  @ApiOperation({ summary: '使用设备标识创建或恢复游客账号' })
  guestLogin(@Body() input: GuestLoginDto) {
    return this.authService.guestLogin(input);
  }
}
