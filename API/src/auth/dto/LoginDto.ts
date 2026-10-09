import { IsString, Length, Matches } from 'class-validator';
import { PASSWORD_REGEX } from 'src/common/lib/regex/password.regex';

export class LoginDto {
  @IsString()
  @Length(3, 20)
  loginKey: string;

  @IsString()
  @Length(8, 50)
  @Matches(PASSWORD_REGEX)
  password: string;
}
