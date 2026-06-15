import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { TASK_ROLES_KEY } from '../decorators/task-roles.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class TaskRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      TASK_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const taskId = request.params.taskId;

    if (!taskId) {
      throw new ForbiddenException('Task ID is required');
    }

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get task with project and members
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
        assignees: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check if user is assigned to task
    const isAssignee = task.assignees.some((a) => a.userId === user.id);

    // Check if user is project admin
    const isProjectAdmin = task.project.projectMembers.some(
      (m) => m.userId === user.id && m.role === 'ADMIN',
    );

    // Check if user is workspace admin (via project workspace)
    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: task.project.workspaceId!,
        userId: user.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    const hasRequiredRole = requiredRoles.some((role) => {
      if (role === 'ASSIGNEE' && isAssignee) return true;
      if (role === 'PROJECT_ADMIN' && isProjectAdmin) return true;
      if (role === 'WORKSPACE_ADMIN' && workspaceMember) return true;
      return false;
    });

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
