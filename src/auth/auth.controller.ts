import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { LoginDto, RegisterDto } from './dto/account.dto';
import { LoginRateGuard } from './login-rate.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { GuestLoginDto } from './dto/guest-login.dto';

@ApiTags('登录')
@Controller('auth')
@UseGuards(LoginRateGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() input: RegisterDto) { return this.authService.register(input); }

  @Post('login')
  login(@Body() input: LoginDto) { return this.authService.login(input); }

  @Post('guest')
  @ApiOperation({ summary: '使用设备标识创建或恢复游客账号' })
  guestLogin(@Body() input: GuestLoginDto) {
    return this.authService.guestLogin(input);
  }
}
