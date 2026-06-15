import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator';
import { ProjectMemberRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectMemberRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const projectId =
      request.params.projectId ||
      (request.body.projectId as string | undefined);

    if (!projectId) {
      throw new ForbiddenException('Project ID is required');
    }

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check if user is project member
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('User is not a member of this project');
    }

    const hasRole = requiredRoles.includes(member.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. Your role: ${member.role}`,
      );
    }

    request.projectMember = member;
    return true;
  }
}
