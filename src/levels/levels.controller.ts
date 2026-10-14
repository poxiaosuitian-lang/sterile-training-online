import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LevelsService } from './levels.service';

@ApiTags('关卡')
@Controller('levels')
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get()
  @ApiOperation({ summary: '获取五关公开配置' })
  list() {
    return this.levelsService.listPublic();
  }

  @Get(':levelId')
  @ApiOperation({ summary: '获取单个关卡公开配置' })
  get(@Param('levelId') levelId: string) {
    return this.levelsService.toPublic(this.levelsService.find(levelId));
  }
}
