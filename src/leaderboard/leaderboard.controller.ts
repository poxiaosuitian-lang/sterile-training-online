import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LevelsService } from '../levels/levels.service';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('排行榜')
@Controller('leaderboards')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly levels: LevelsService,
  ) {}

  @Get('overall')
  @ApiOperation({ summary: '获取总成绩排行榜' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  overall(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.leaderboard.list('overall', limit);
  }

  @Get('levels/:levelId')
  @ApiOperation({ summary: '获取指定关卡排行榜' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  byLevel(
    @Param('levelId') levelId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.levels.find(levelId);
    return this.leaderboard.list(levelId, limit);
  }
}
