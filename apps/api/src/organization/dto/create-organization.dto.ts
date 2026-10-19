import { createOrganizationInput } from '@fmbase/types';
import { IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto implements createOrganizationInput {
  @IsString()
  @MinLength(2)
  name!: string;
}
