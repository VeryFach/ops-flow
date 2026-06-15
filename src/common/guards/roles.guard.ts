/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new HttpException(
        'Access denied. The user profile does not have valid access rights.',
        HttpStatus.FORBIDDEN,
      );
    }

    const hasRole = requiredRoles.includes(user.role.toLowerCase());

    if (!hasRole) {
      throw new HttpException(
        `Access denied. Your current role (${user.role.toUpperCase()}) does not have permission to access this endpoint.`,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
