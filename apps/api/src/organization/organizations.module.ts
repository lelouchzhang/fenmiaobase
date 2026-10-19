import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrganizationService } from './organizations.service.js';
import { OrganizationController } from './organizations.controller.js';

@Module({
  imports: [AuthModule],
  providers: [OrganizationService],
  controllers: [OrganizationController],
  exports: [OrganizationService],
})
export class OrganizationsModule {}
