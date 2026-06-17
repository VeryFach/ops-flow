import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EditUserDto } from './dto/edit-user.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { Prisma, TaskStatus } from '@prisma/client';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  async getMe(currentUser: CurrentUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async editUser(
    currentUser: CurrentUser,
    targetUserId: string,
    dto: EditUserDto,
  ) {
    // Regular USER can only edit their own profile
    if (currentUser.role !== 'SUPER_ADMIN' && targetUserId !== currentUser.id) {
      throw new ForbiddenException('You can only edit your own profile');
    }

    // Capture old values for audit
    const existing = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { name: true, email: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { ...dto },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    // Persist audit log via AuditLogService
    await this.auditLogService.logAction({
      action: 'UPDATE',
      entity: 'User',
      entityId: targetUserId,
      userId: currentUser.id,
      oldValue: { name: existing.name, email: existing.email },
      newValue: { name: user.name, email: user.email },
    });

    return user;
  }

  async getUserWorkspaces(currentUser: CurrentUser) {
    // SUPER_ADMIN: global access — return all workspaces
    if (currentUser.role === 'SUPER_ADMIN') {
      const allMemberships = await this.prisma.workspaceMember.findMany({
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              ownerId: true,
            },
          },
        },
      });

      return allMemberships.map((m) => ({
        ...m.workspace,
        role: m.role,
        joinedAt: m.createdAt,
      }));
    }

    // USER: scoped to own memberships
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId: currentUser.id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
      joinedAt: m.createdAt,
    }));
  }

  async getUserProjects(currentUser: CurrentUser) {
    // SUPER_ADMIN: global access — return all projects
    if (currentUser.role === 'SUPER_ADMIN') {
      const allProjects = await this.prisma.project.findMany({
        include: {
          projectMembers: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      });

      return {
        memberOf: allProjects,
        created: allProjects,
      };
    }

    // USER: scoped to own memberships and created projects
    const projectMemberships = await this.prisma.projectMember.findMany({
      where: { userId: currentUser.id },
      include: { project: true },
    });

    const createdProjects = await this.prisma.project.findMany({
      where: { createdById: currentUser.id },
    });

    return {
      memberOf: projectMemberships.map((m) => m.project),
      created: createdProjects,
    };
  }

  async getUserTasks(currentUser: CurrentUser, query?: TaskQueryDto) {
    // SUPER_ADMIN: global access — return all tasks
    if (currentUser.role === 'SUPER_ADMIN') {
      const allAssignments = await this.prisma.taskAssignee.findMany({
        ...(query?.status
          ? { where: { task: { status: query.status as TaskStatus } } }
          : {}),
        include: {
          task: {
            include: {
              project: true,
            },
          },
        },
      });

      return allAssignments.map((a) => ({
        ...a.task,
        assignedAt: a.assignedAt,
      }));
    }

    // USER: scoped to own assignments
    const whereCondition: Prisma.TaskAssigneeWhereInput = {
      userId: currentUser.id,
      ...(query?.status
        ? { task: { status: query.status as TaskStatus } }
        : {}),
    };

    const assignments = await this.prisma.taskAssignee.findMany({
      where: whereCondition,
      include: {
        task: {
          include: {
            project: true,
          },
        },
      },
    });

    return assignments.map((a) => ({
      ...a.task,
      assignedAt: a.assignedAt,
    }));
  }

  async getUserRoleInWorkspace(currentUser: CurrentUser, workspaceId: string) {
    // SUPER_ADMIN: implicit owner-level access
    if (currentUser.role === 'SUPER_ADMIN') {
      // Verify workspace exists
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      });

      if (!workspace) {
        throw new NotFoundException('Workspace not found');
      }

      return { role: 'OWNER' };
    }

    // USER: must be an explicit member
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUser.id,
        },
      },
    });

    if (!member) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    return { role: member.role };
  }

  async getUserDeployments(currentUser: CurrentUser) {
    // SUPER_ADMIN: global access — return all deployments
    if (currentUser.role === 'SUPER_ADMIN') {
      const deployments = await this.prisma.deployment.findMany({
        include: {
          project: true,
          tasks: {
            include: { task: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return deployments;
    }

    // USER: scoped to own deployments
    const deployments = await this.prisma.deployment.findMany({
      where: { deployedById: currentUser.id },
      include: {
        project: true,
        tasks: {
          include: { task: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return deployments;
  }
}
