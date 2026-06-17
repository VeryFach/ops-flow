import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../notifications/telegram.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentStatusDto } from './dto/update-deployment-status.dto';
import { DeploymentStatus, Prisma } from '@prisma/client';
import { DeploymentQueue } from '../../jobs/deployment.queue';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';

@Injectable()
export class DeploymentsService {
  constructor(
    private prisma: PrismaService,
    private telegramService: TelegramService,
    private deploymentQueue: DeploymentQueue,
  ) {}

  async create(currentUser: CurrentUser, dto: CreateDeploymentDto) {
    // Check if user has access to project
    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: dto.projectId,
          userId: currentUser.id,
        },
      },
      include: {
        project: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!projectMember) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Check if tasks exist and belong to project
    if (dto.taskIds && dto.taskIds.length > 0) {
      const tasks = await this.prisma.task.findMany({
        where: {
          id: { in: dto.taskIds },
          projectId: dto.projectId,
        },
      });

      if (tasks.length !== dto.taskIds.length) {
        throw new NotFoundException(
          'One or more tasks not found in this project',
        );
      }
    }

    // Create deployment
    const deployment = await this.prisma.deployment.create({
      data: {
        version: dto.version,
        status: DeploymentStatus.PENDING,
        projectId: dto.projectId,
        deployedById: currentUser.id,
      },
    });

    // Link tasks if provided
    if (dto.taskIds && dto.taskIds.length > 0) {
      await this.prisma.deploymentTask.createMany({
        data: dto.taskIds.map((taskId) => ({
          deploymentId: deployment.id,
          taskId: taskId,
        })),
      });
    }

    // Send notification
    if (process.env.NODE_ENV !== 'test') {
      await this.sendDeploymentNotification(deployment.id, 'started');
    }

    // Enqueue async deployment processing via BullMQ
    await this.deploymentQueue.addDeployment({
      deploymentId: deployment.id,
      userId: currentUser.id,
      version: dto.version,
      projectId: dto.projectId,
      taskIds: dto.taskIds ?? [],
    });

    return this.findOne(deployment.id, currentUser);
  }

  async findAll(currentUser: CurrentUser, projectId?: string) {
    // SUPER_ADMIN: global access — return all deployments
    if (currentUser.role === 'SUPER_ADMIN') {
      return this.prisma.deployment.findMany({
        ...(projectId ? { where: { projectId } } : {}),
        include: {
          project: {
            select: { id: true, name: true, workspaceId: true },
          },
          deployedBy: {
            select: { id: true, name: true, email: true },
          },
          tasks: {
            include: {
              task: {
                select: { id: true, title: true, status: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // USER: scoped to projects they belong to
    const whereCondition: Prisma.DeploymentWhereInput = {
      project: {
        projectMembers: {
          some: { userId: currentUser.id },
        },
      },
      ...(projectId ? { projectId } : {}),
    };

    return this.prisma.deployment.findMany({
      where: whereCondition,
      include: {
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
        deployedBy: {
          select: { id: true, name: true, email: true },
        },
        tasks: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(deploymentId: string, currentUser: CurrentUser) {
    const includeClause = {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          workspaceId: true,
          workspace: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
      deployedBy: {
        select: { id: true, name: true, email: true },
      },
      tasks: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
            },
          },
        },
      },
    };

    // SUPER_ADMIN: global access — find by ID only
    if (currentUser.role === 'SUPER_ADMIN') {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: includeClause,
      });

      if (!deployment) {
        throw new NotFoundException('Deployment not found');
      }

      return deployment;
    }

    // USER: must belong to the deployment's project
    const deployment = await this.prisma.deployment.findFirst({
      where: {
        id: deploymentId,
        project: {
          projectMembers: {
            some: { userId: currentUser.id },
          },
        },
      },
      include: includeClause,
    });

    if (!deployment) {
      throw new NotFoundException(
        'Deployment not found or you do not have access',
      );
    }

    return deployment;
  }

  async updateStatus(
    deploymentId: string,
    currentUser: CurrentUser,
    dto: UpdateDeploymentStatusDto,
  ) {
    // Check if user is project admin or deployment executor
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          include: {
            projectMembers: true,
          },
        },
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const isProjectAdmin = deployment.project.projectMembers.some(
      (m) => m.userId === currentUser.id && m.role === 'ADMIN',
    );
    const isDeployer = deployment.deployedById === currentUser.id;

    if (!isProjectAdmin && !isDeployer) {
      throw new ForbiddenException(
        'Only project admin or deployment executor can update status',
      );
    }

    const updatedDeployment = await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status: dto.status },
    });

    // Send notification on status change
    await this.sendDeploymentNotification(
      deploymentId,
      dto.status.toLowerCase(),
    );

    // If deployment is successful, update task statuses if needed
    if (dto.status === DeploymentStatus.SUCCESS) {
      await this.updateLinkedTasksStatus(deploymentId);
    }

    return updatedDeployment;
  }

  async remove(deploymentId: string, currentUser: CurrentUser) {
    // Check if user is workspace admin or project admin
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          include: {
            projectMembers: true,
            workspace: true,
          },
        },
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const isProjectAdmin = deployment.project.projectMembers.some(
      (m) => m.userId === currentUser.id && m.role === 'ADMIN',
    );

    const isWorkspaceAdmin = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: deployment.project.workspaceId!,
        userId: currentUser.id,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!isProjectAdmin && !isWorkspaceAdmin) {
      throw new ForbiddenException(
        'Only project admin or workspace admin can delete deployments',
      );
    }

    await this.prisma.deployment.delete({
      where: { id: deploymentId },
    });

    return { message: 'Deployment deleted successfully' };
  }

  private async sendDeploymentNotification(
    deploymentId: string,
    status: string,
  ) {
    try {
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: {
          project: true,
          deployedBy: true,
          tasks: {
            include: { task: true },
          },
        },
      });

      if (!deployment) return;

      const taskList = deployment.tasks
        .map((t) => `  • ${t.task.title}`)
        .join('\n');

      const statusMap: Record<string, string> = {
        started: '🚀 Started',
        running: '🔄 Running',
        success: '✅ Success',
        failed: '❌ Failed',
      };

      const message = `
🚀 Deployment Update

Project: ${deployment.project.name}
Version: ${deployment.version}
By: ${deployment.deployedBy?.name ?? 'Unknown'}
Time: ${new Date().toLocaleString()}

Tasks:
${taskList || '- No linked tasks'}

Status: ${statusMap[status] ?? '⚪ Unknown'}
`;

      await this.telegramService.sendMessage(message);
    } catch (error) {
      console.error('Failed to send Telegram notification:', error);
    }
  }

  private async updateLinkedTasksStatus(deploymentId: string) {
    const deploymentTasks = await this.prisma.deploymentTask.findMany({
      where: { deploymentId },
      include: { task: true },
    });

    for (const dt of deploymentTasks) {
      if (dt.task.status !== 'DONE') {
        await this.prisma.task.update({
          where: { id: dt.taskId },
          data: { status: 'DONE' },
        });
      }
    }
  }
}
