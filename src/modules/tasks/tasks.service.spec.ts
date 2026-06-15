import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskStatus, Priority } from '@prisma/client';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaService;

  const mockUserId = 'user-1';
  const mockProjectId = 'project-1';
  const mockTaskId = 'task-1';

  const mockTask = {
    id: mockTaskId,
    title: 'Test Task',
    description: 'Test Description',
    status: TaskStatus.TODO,
    priority: Priority.MEDIUM,
    projectId: mockProjectId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockProjectMember = {
    projectId: mockProjectId,
    userId: mockUserId,
    role: 'ADMIN',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: PrismaService,
          useValue: {
            task: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            projectMember: {
              findUnique: jest.fn(),
            },
            taskAssignee: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            taskStatusHistory: {
              create: jest.fn(),
            },
            workspaceMember: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto = {
      title: 'New Task',
      description: 'Task Description',
      projectId: mockProjectId,
      assigneeIds: ['user-2', 'user-3'],
    };

    it('should create a task successfully', async () => {
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(
        mockProjectMember,
      );
      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);
      (prisma.taskAssignee.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.create(mockUserId, createDto);

      expect(result).toEqual(mockTask);
      expect(prisma.task.create).toHaveBeenCalled();
      expect(prisma.taskAssignee.createMany).toHaveBeenCalled();});

    it('should throw ForbiddenException if user has no access to project', async () => {
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a task if user has access', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.findOne(mockTaskId, mockUserId);

      expect(result).toEqual(mockTask);
    });

    it('should throw NotFoundException if task not found', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(mockTaskId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update task status and create history', async () => {
      const oldTask = { ...mockTask, status: TaskStatus.TODO };
      const updatedTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };

      (prisma.task.findFirst as jest.Mock).mockResolvedValue(oldTask);
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(oldTask);
      (prisma.task.update as jest.Mock).mockResolvedValue(updatedTask);
      (prisma.taskStatusHistory.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateStatus(
        mockTaskId,
        mockUserId,
        TaskStatus.IN_PROGRESS,
      );

      expect(result).toEqual(updatedTask);
      expect(prisma.taskStatusHistory.create).toHaveBeenCalledWith({
        data: {
          taskId: mockTaskId,
          changedById: mockUserId,
          fromStatus: TaskStatus.TODO,
          toStatus: TaskStatus.IN_PROGRESS,
        },
      });
    });
  });
});
