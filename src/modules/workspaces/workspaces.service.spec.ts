import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

describe('WorkspacesService', () => {
    let service: WorkspacesService;
    let prisma: PrismaService;

    const mockUserId = 'user-1';
    const mockWorkspaceId = 'workspace-1';
    
    const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Workspace',
        slug: 'test-workspace',
        ownerId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    };

    const mockMember = {
        workspaceId: mockWorkspaceId,
        userId: mockUserId,
        role: WorkspaceMemberRole.OWNER,
        createdAt: new Date(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WorkspacesService,
                {
                    provide: PrismaService,
                    useValue: {
                        workspace: {
                            create: jest.fn(),
                            findMany: jest.fn(),
                            findUnique: jest.fn(),
                            findFirst: jest.fn(),
                            update: jest.fn(),
                        },
                        workspaceMember: {
                            create: jest.fn(),
                            findUnique: jest.fn(),
                            findFirst: jest.fn(),
                            delete: jest.fn(),
                            update: jest.fn(),
                        },
                        user: {
                            findUnique: jest.fn(),
                        },
                        $transaction: jest.fn((callback) => callback(prisma)),
                    },
                },
            ],
        }).compile();

        service = module.get<WorkspacesService>(WorkspacesService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    describe('create', () => {
        const createDto = {
            name: 'New Workspace',
            slug: 'new-workspace',
        };

        it('should create a workspace successfully', async () => {
            (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null);
            (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
                return callback({
                    workspace: {
                        create: jest.fn().mockResolvedValue(mockWorkspace),
                    },
                    workspaceMember: {
                        create: jest.fn().mockResolvedValue(mockMember),
                    },
                });
            });

            const result = await service.create(mockUserId, createDto);

            expect(result).toEqual(mockWorkspace);
        });

        it('should throw ConflictException if slug already exists', async () => {
            (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(mockWorkspace);

            await expect(service.create(mockUserId, createDto)).rejects.toThrow(
                ConflictException,
            );
        });
    });

    describe('findAll', () => {
        it('should return all workspaces for a user', async () => {
            const mockWorkspaces = [mockWorkspace];
            (prisma.workspace.findMany as jest.Mock).mockResolvedValue(mockWorkspaces);

            const result = await service.findAll(mockUserId);

            expect(result).toEqual(mockWorkspaces);
            expect(prisma.workspace.findMany).toHaveBeenCalledWith({
                where: {
                    members: {
                        some: { userId: mockUserId },
                    },
                },
                include: expect.any(Object),
                orderBy: { createdAt: 'desc' },
            });
        });
    });

    describe('findOne', () => {
        it('should return a workspace if user has access', async () => {
            (prisma.workspace.findFirst as jest.Mock).mockResolvedValue(mockWorkspace);

            const result = await service.findOne(mockWorkspaceId, mockUserId);

            expect(result).toEqual(mockWorkspace);
        });

        it('should throw NotFoundException if workspace not found', async () => {
            (prisma.workspace.findFirst as jest.Mock).mockResolvedValue(null);

            await expect(service.findOne(mockWorkspaceId, mockUserId)).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});