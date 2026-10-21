import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JWTAuthGuard } from './guards/jwt-auth.guard.js';
import { MembersModule } from '../members/members.module.js';

@Module({
  imports: [JwtModule.register({}), MembersModule],
  providers: [AuthService, JWTAuthGuard],
  controllers: [AuthController],
  exports: [JwtModule, JWTAuthGuard],
})
export class AuthModule {}
