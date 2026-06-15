import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { TaskStatus, Priority, Prisma } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateTaskDto) {
    // Check if user has access to project
    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: dto.projectId,
          userId: userId,
        },
      },
    });

    if (!projectMember) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Create task
    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status || TaskStatus.TODO,
        priority: dto.priority || Priority.MEDIUM,
        projectId: dto.projectId,
      },
    });

    // Assign assignees if provided
    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      await this.prisma.taskAssignee.createMany({
        data: dto.assigneeIds.map((assigneeId) => ({
          taskId: task.id,
          userId: assigneeId,
        })),
        skipDuplicates: true,
      });
    }

    // Return task with assignees
    return this.findOne(task.id, userId);
  }

  async findAll(userId: string, query: TaskQueryDto) {
    const whereCondition: Prisma.TaskWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.assigneeId
        ? { assignees: { some: { userId: query.assigneeId } } }
        : {
            OR: [
              { assignees: { some: { userId } } },
              { project: { projectMembers: { some: { userId } } } },
            ],
          }),
    };

    const tasks = await this.prisma.task.findMany({
      where: whereCondition,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            workspaceId: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          take: 5,
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        deploymentTasks: {
          include: {
            deployment: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tasks;
  }

  async findOne(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          {
            assignees: {
              some: {
                userId: userId,
              },
            },
          },
          {
            project: {
              projectMembers: {
                some: {
                  userId: userId,
                },
              },
            },
          },
        ],
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            workspaceId: true,
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'desc' },
          include: {
            changedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        deploymentTasks: {
          include: {
            deployment: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found or you do not have access');
    }

    return task;
  }

  async update(taskId: string, userId: string, dto: UpdateTaskDto) {
    // Check access
    await this.checkAccess(taskId, userId);

    // Get old status for history tracking
    const oldTask = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    // Update task
    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: dto.status,
      },
    });

    // Track status change if status changed
    if (dto.status && oldTask && oldTask.status !== dto.status) {
      await this.prisma.taskStatusHistory.create({
        data: {
          taskId: taskId,
          changedById: userId,
          fromStatus: oldTask.status,
          toStatus: dto.status,
        },
      });
    }

    // Update assignees if provided
    if (dto.assigneeIds) {
      // Remove existing assignees
      await this.prisma.taskAssignee.deleteMany({
        where: { taskId },
      });

      // Add new assignees
      if (dto.assigneeIds.length > 0) {
        await this.prisma.taskAssignee.createMany({
          data: dto.assigneeIds.map((assigneeId) => ({
            taskId: taskId,
            userId: assigneeId,
          })),
        });
      }
    }

    return this.findOne(taskId, userId);
  }

  async updateStatus(taskId: string, userId: string, status: TaskStatus) {
    // Check access
    await this.checkAccess(taskId, userId);

    const oldTask = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!oldTask) {
      throw new NotFoundException('Task not found');
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    });

    // Track status change
    await this.prisma.taskStatusHistory.create({
      data: {
        taskId: taskId,
        changedById: userId,
        fromStatus: oldTask.status,
        toStatus: status,
      },
    });

    return task;
  }

  async remove(taskId: string, userId: string) {
    // Check if user is project admin or workspace admin
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            projectMembers: true,
            workspace: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const isProjectAdmin = task.project.projectMembers.some(
      (m) => m.userId === userId && m.role === 'ADMIN',
    );

    const workspaceMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: task.project.workspaceId!,
        userId: userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!isProjectAdmin && !workspaceMember) {
      throw new ForbiddenException(
        'Only project admin or workspace admin can delete tasks',
      );
    }

    // Soft delete
    await this.prisma.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Task deleted successfully' };
  }

  private async checkAccess(taskId: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          {
            assignees: {
              some: {
                userId: userId,
              },
            },
          },
          {
            project: {
              projectMembers: {
                some: {
                  userId: userId,
                },
              },
            },
          },
        ],
      },
    });

    if (!task) {
      throw new ForbiddenException('You do not have access to this task');
    }

    return task;
  }
}
