import { LoginInput } from '@fmbase/types';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto implements LoginInput {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
