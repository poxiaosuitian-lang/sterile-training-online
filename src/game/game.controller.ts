import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { StartLevelDto } from './dto/start-level.dto';
import { SubmitLevelDto } from './dto/submit-level.dto';
import { GameService } from './game.service';

@ApiTags('游戏')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('progress')
  @ApiOperation({ summary: '获取当前玩家五关解锁与最佳成绩' })
  progress(@CurrentUser() user: AuthUser) {
    return this.gameService.progress(user.playerId);
  }

  @Post('levels/:levelId/start')
  @ApiOperation({ summary: '开始或重新开始一个关卡' })
  start(
    @CurrentUser() user: AuthUser,
    @Param('levelId') levelId: string,
    @Body() input: StartLevelDto,
  ) {
    return this.gameService.start(
      user.playerId,
      levelId,
      input?.developerMode ?? false,
      input?.developerToken,
    );
  }

  @Post('sessions/:sessionId/submit')
  @ApiOperation({ summary: '提交关卡结果并由服务端评分' })
  submit(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Body() input: SubmitLevelDto,
  ) {
    return this.gameService.submit(user.playerId, sessionId, input);
  }
}
