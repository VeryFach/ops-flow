/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { DeploymentsService } from './deployments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../notifications/telegram.service';
import { DeploymentQueue } from '../../jobs/deployment.queue';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeploymentStatus } from '@prisma/client';

describe('DeploymentsService', () => {
  let service: DeploymentsService;
  let prisma: PrismaService;
  let deploymentQueue: DeploymentQueue;

  const mockUserId = 'user-1';
  const mockCurrentUser = { id: mockUserId, role: 'USER' };
  const mockProjectId = 'project-1';
  const mockDeploymentID = 'deployment-1';
  const mockDeployment = {
    id: mockDeploymentID,
    version: 'v1.0.0',
    status: DeploymentStatus.PENDING,
    projectId: mockProjectId,
    deployedById: mockUserId,
    deployedAt: new Date(),
    createdAt: new Date(),
  };
  const mockProjectMember = {
    projectId: mockProjectId,
    userId: mockUserId,
    role: 'ADMIN',
    project: {
      id: mockProjectId,
      workspace: {
        id: 'workspace-1',
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeploymentsService,
        {
          provide: PrismaService,
          useValue: {
            projectMember: { findUnique: jest.fn() },
            task: { findMany: jest.fn() },
            deployment: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            deploymentTask: { createMany: jest.fn(), findMany: jest.fn() },
            workspaceMember: { findFirst: jest.fn() },
          },
        },
        {
          provide: TelegramService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
        {
          provide: DeploymentQueue,
          useValue: {
            addDeployment: jest.fn().mockResolvedValue('job-1'),
          },
        },
      ],
    }).compile();

    service = module.get<DeploymentsService>(DeploymentsService);
    prisma = module.get<PrismaService>(PrismaService);
    deploymentQueue = module.get<DeploymentQueue>(DeploymentQueue);
  });

  describe('create', () => {
    const createDto = {
      version: 'v1.0.0',
      projectId: mockProjectId,
      taskIds: ['task-1', 'task-2'],
    };

    it('should create a deployment and enqueue job', async () => {
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(
        mockProjectMember,
      );

      (prisma.task.findMany as jest.Mock).mockResolvedValue([
        { id: 'task-1' },
        { id: 'task-2' },
      ]);

      (prisma.deployment.create as jest.Mock).mockResolvedValue(mockDeployment);

      (prisma.deploymentTask.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      (prisma.deployment.findFirst as jest.Mock).mockResolvedValue(
        mockDeployment,
      );

      const result = await service.create(mockCurrentUser, createDto);

      expect(result).toEqual(mockDeployment);
      expect(prisma.deployment.create).toHaveBeenCalled();
      expect(deploymentQueue.addDeployment).toHaveBeenCalledWith({
        deploymentId: mockDeploymentID,
        userId: mockUserId,
        version: 'v1.0.0',
        projectId: mockProjectId,
        taskIds: ['task-1', 'task-2'],
      });
    });

    it('should enqueue with empty taskIds when none provided', async () => {
      const dtoNoTasks = { version: 'v1.0.0', projectId: mockProjectId };

      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(
        mockProjectMember,
      );
      (prisma.deployment.create as jest.Mock).mockResolvedValue(mockDeployment);
      (prisma.deployment.findFirst as jest.Mock).mockResolvedValue(
        mockDeployment,
      );

      await service.create(mockCurrentUser, dtoNoTasks);

      expect(deploymentQueue.addDeployment).toHaveBeenCalledWith({
        deploymentId: mockDeploymentID,
        userId: mockUserId,
        version: 'v1.0.0',
        projectId: mockProjectId,
        taskIds: [],
      });
    });

    it('should throw ForbiddenException if user not in project', async () => {
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if some tasks not found', async () => {
      (prisma.projectMember.findUnique as jest.Mock).mockResolvedValue(
        mockProjectMember,
      );
      (prisma.task.findMany as jest.Mock).mockResolvedValue([{ id: 'task-1' }]); // only one found
      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return deployments for user', async () => {
      (prisma.deployment.findMany as jest.Mock).mockResolvedValue([
        mockDeployment,
      ]);
      const result = await service.findAll(mockCurrentUser);
      expect(result).toEqual([mockDeployment]);
      expect(prisma.deployment.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return deployment if user has access', async () => {
      (prisma.deployment.findFirst as jest.Mock).mockResolvedValue(
        mockDeployment,
      );
      const result = await service.findOne(mockDeploymentID, mockCurrentUser);
      expect(result).toEqual(mockDeployment);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.deployment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.findOne(mockDeploymentID, mockCurrentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status successfully (admin)', async () => {
      const deployment = {
        ...mockDeployment,
        project: { projectMembers: [{ userId: mockUserId, role: 'ADMIN' }] },
      };
      (prisma.deployment.findUnique as jest.Mock).mockResolvedValue(deployment);
      (prisma.deployment.update as jest.Mock).mockResolvedValue({
        ...mockDeployment,
        status: DeploymentStatus.SUCCESS,
      });
      jest
        .spyOn(service as any, 'sendDeploymentNotification')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'updateLinkedTasksStatus')
        .mockResolvedValue(undefined);

      const result = await service.updateStatus(
        mockDeploymentID,
        mockCurrentUser,
        { status: DeploymentStatus.SUCCESS },
      );
      expect(result.status).toBe(DeploymentStatus.SUCCESS);
    });

    it('should throw ForbiddenException if not admin nor deployer', async () => {
      const deployment = {
        ...mockDeployment,
        project: { projectMembers: [{ userId: 'other', role: 'VIEWER' }] },
        deployedById: 'other',
      };
      (prisma.deployment.findUnique as jest.Mock).mockResolvedValue(deployment);
      await expect(
        service.updateStatus(mockDeploymentID, mockCurrentUser, {
          status: DeploymentStatus.SUCCESS,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should delete deployment if user is project admin', async () => {
      const deployment = {
        ...mockDeployment,
        project: {
          projectMembers: [{ userId: mockUserId, role: 'ADMIN' }],
          workspace: { id: 'ws-1' },
        },
      };
      (prisma.deployment.findUnique as jest.Mock).mockResolvedValue(deployment);
      (prisma.deployment.delete as jest.Mock).mockResolvedValue(deployment);
      const result = await service.remove(mockDeploymentID, mockCurrentUser);
      expect(result).toEqual({ message: 'Deployment deleted successfully' });
    });

    it('should throw NotFoundException if deployment not found', async () => {
      (prisma.deployment.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.remove(mockDeploymentID, mockCurrentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
