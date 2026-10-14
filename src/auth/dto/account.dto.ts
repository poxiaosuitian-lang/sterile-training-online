import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{3,32}$/)
  username: string;

  @IsString()
  @Length(8, 128)
  password: string;
}
export class RegisterDto extends LoginDto {
  @IsString()
  @Matches(/\S/)
  @Length(1, 32)
  nickname: string;
}
