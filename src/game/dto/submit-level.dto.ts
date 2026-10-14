import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class SubmitLevelDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  challengeNonce: string;

  @ApiProperty({
    example: {
      steps: ['open_sterile_gate', 'select_disinfectant'],
    },
  })
  @IsObject()
  result: Record<string, unknown>;
}
