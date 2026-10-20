import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class StartLevelDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  developerMode?: boolean;

  @IsOptional()
  @IsString()
  @Length(1,2048)
  developerToken?: string;
}
