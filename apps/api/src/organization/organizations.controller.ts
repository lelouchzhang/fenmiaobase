import { OrganizationService } from './organizations.service.js';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '@fmbase/types';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';

@Controller('organizations')
@UseGuards(JWTAuthGuard)
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  //
  @Get()
  getMyOrganizations(@CurrentUser() user: JwtPayload) {
    return this.organizationService.getMyOrganizations(user.sub);
  }

  @Get(':slug')
  getOrganizationBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.organizationService.getOrganizationBySlug(slug, user.sub);
  }

  @Post()
  createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.organizationService.createOrganization(dto, user.sub);
  }
}
