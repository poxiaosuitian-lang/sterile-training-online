import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class GuestLoginDto {
  @ApiProperty({ example: 'android-7f3c10d4' })
  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  @Matches(/^[a-zA-Z0-9._:-]+$/)
  deviceId: string;

  @ApiProperty({ example: '无菌训练员' })
  @IsString()
  @Length(1, 24)
  nickname: string;
}
