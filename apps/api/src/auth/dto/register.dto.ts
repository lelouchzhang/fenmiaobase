import { IsEmail, MinLength, IsString } from 'class-validator';
import type { RegisterInput } from '@fmbase/types';
export class RegisterDto implements RegisterInput {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;
}
