import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class StartLevelDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  developerMode?: boolean;
}
