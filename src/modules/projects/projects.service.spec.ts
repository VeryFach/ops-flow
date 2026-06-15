/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: PrismaService;

  const mockUserId = 'user-1';
  const mockWorkspaceId = 'workspace-1';
  const mockProjectId = 'project-1';
  const mockProject = {
    id: mockProjectId,
    name: 'Test Project',
    description: 'Test desc',
    workspaceId: mockWorkspaceId,
    createdById: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockWorkspaceMember = {
    workspaceId: mockWorkspaceId,
    userId: mockUserId,
    role: WorkspaceMemberRole.OWNER,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: {
            workspaceMember: { findUnique: jest.fn() },
            project: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            projectMember: {
              create: jest.fn(),
              findUnique: jest.fn(),
              count: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
            user: { findUnique: jest.fn() },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    const createDto = { name: 'New Project', workspaceId: mockWorkspaceId };

    it('should create project successfully', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspaceMember,
      );
      const mockTx = {
        project: { create: jest.fn().mockResolvedValue(mockProject) },
        projectMember: { create: jest.fn().mockResolvedValue({}) },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
        callback(mockTx),
      );

      const result = await service.create(mockUserId, createDto);
      expect(result).toEqual(mockProject);
      expect(mockTx.project.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user not in workspace', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    it('should return project if user is member', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(mockProject);
      const result = await service.findOne(mockProjectId, mockUserId);
      expect(result).toEqual(mockProject);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne(mockProjectId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
