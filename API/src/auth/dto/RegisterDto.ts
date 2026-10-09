import { IsString, Length, Matches } from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH,
} from 'src/common/constants';
import { EMAIL_REGEX } from 'src/common/lib/regex/email.regex';
import { PASSWORD_REGEX } from 'src/common/lib/regex/password.regex';

export class RegisterDto {
  @IsString()
  @Length(MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH)
  name: string;

  @IsString()
  @Matches(EMAIL_REGEX)
  email: string;

  @IsString()
  @Length(MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH)
  @Matches(PASSWORD_REGEX)
  password: string;
}
