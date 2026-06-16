import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { WorkspaceMemberRole } from '@prisma/client';

describe('WorkspacesService', () => {
  let service: WorkspacesService;
  let prisma: jest.Mocked<PrismaService>;

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

  type MockWorkspace = typeof mockWorkspace;

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
              create: jest.fn<Promise<typeof mockWorkspace>, []>(),
              findMany: jest.fn<Promise<MockWorkspace[]>, []>(),
              findUnique: jest.fn<Promise<typeof mockWorkspace | null>, []>(),
              findFirst: jest.fn<Promise<typeof mockWorkspace | null>, []>(),
              update: jest.fn<Promise<typeof mockWorkspace>, []>(),
            },
            workspaceMember: {
              create: jest.fn<Promise<typeof mockMember>, []>(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(
              (callback: (prisma: PrismaService) => unknown) =>
                callback(prisma),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
    prisma = module.get<jest.Mocked<PrismaService>>(PrismaService);
  });

  describe('create', () => {
    const createDto = {
      name: 'New Workspace',
      slug: 'new-workspace',
    };

    it('should create a workspace successfully', async () => {
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$transaction as jest.Mock).mockImplementation(
        (
          callback: (tx: {
            workspace: {
              create: jest.Mock;
            };
            workspaceMember: {
              create: jest.Mock;
            };
          }) => Promise<unknown>,
        ) => {
          return callback({
            workspace: {
              create: jest.fn().mockResolvedValue(mockWorkspace),
            },
            workspaceMember: {
              create: jest.fn().mockResolvedValue(mockMember),
            },
          });
        },
      );

      const result = await service.create(mockUserId, createDto);

      expect(result).toEqual(mockWorkspace);
    });

    it('should throw ConflictException if slug already exists', async () => {
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all workspaces for a user', async () => {
      const mockWorkspaces = [mockWorkspace];

      const findManySpy = jest.spyOn(prisma.workspace, 'findMany');

      findManySpy.mockResolvedValue(mockWorkspaces);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual(mockWorkspaces);

      expect(findManySpy).toHaveBeenCalledWith({
        where: {
          members: {
            some: { userId: mockUserId },
          },
        },
        include: expect.any(Object) as Record<string, unknown>,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return a workspace if user has access', async () => {
      const findFirstSpy = jest.spyOn(prisma.workspace, 'findFirst');

      findFirstSpy.mockResolvedValue(mockWorkspace);

      const result = await service.findOne(mockWorkspaceId, mockUserId);

      expect(result).toMatchObject(mockWorkspace);
    });

    it('should throw NotFoundException if workspace not found', async () => {
      (prisma.workspace.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne(mockWorkspaceId, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Workspace' };

    it('should update workspace when user is OWNER', async () => {
      const updatedWorkspace = { ...mockWorkspace, ...updateDto };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      const updateSpy = jest
        .spyOn(prisma.workspace, 'update')
        .mockResolvedValue(updatedWorkspace);

      const result = await service.update(
        mockWorkspaceId,
        mockUserId,
        updateDto,
      );

      expect(result).toEqual(updatedWorkspace);
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockWorkspaceId },
        data: updateDto,
      });
    });

    it('should update workspace when user is ADMIN', async () => {
      const adminMember = {
        ...mockMember,
        role: WorkspaceMemberRole.ADMIN,
      };
      const updatedWorkspace = { ...mockWorkspace, ...updateDto };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        adminMember,
      );
      (prisma.workspace.update as jest.Mock).mockResolvedValue(
        updatedWorkspace,
      );

      const result = await service.update(
        mockWorkspaceId,
        mockUserId,
        updateDto,
      );

      expect(result).toEqual(updatedWorkspace);
    });

    it('should throw ForbiddenException when user is MEMBER', async () => {
      const memberRole = {
        ...mockMember,
        role: WorkspaceMemberRole.ENGINEER,
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        memberRole,
      );

      await expect(
        service.update(mockWorkspaceId, mockUserId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(mockWorkspaceId, mockUserId, updateDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when slug is already taken', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.workspace.findFirst as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      await expect(
        service.update(mockWorkspaceId, mockUserId, {
          slug: 'existing-slug',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should skip slug check when dto.slug is not provided', async () => {
      const updatedWorkspace = { ...mockWorkspace, name: 'New Name' };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.workspace.update as jest.Mock).mockResolvedValue(
        updatedWorkspace,
      );
      const findFirstSpy = jest.spyOn(prisma.workspace, 'findFirst');

      const result = await service.update(mockWorkspaceId, mockUserId, {
        name: 'New Name',
      });

      expect(result).toEqual(updatedWorkspace);
      expect(findFirstSpy).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft-delete workspace when user is owner', async () => {
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );
      const updateSpy = jest
        .spyOn(prisma.workspace, 'update')
        .mockResolvedValue({
          ...mockWorkspace,
          deletedAt: new Date(),
        });

      const result = await service.remove(mockWorkspaceId, mockUserId);

      expect(result).toEqual({
        message: 'Workspace deleted successfully',
      });
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockWorkspaceId },
        data: {
          deletedAt: expect.any(Date) as unknown,
        },
      });
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(mockWorkspaceId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user is not owner', async () => {
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      await expect(
        service.remove(mockWorkspaceId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMember', () => {
    const addMemberDto = {
      userId: 'new-user',
      role: WorkspaceMemberRole.ENGINEER,
    };

    const mockNewMember = {
      workspaceId: mockWorkspaceId,
      userId: 'new-user',
      role: WorkspaceMemberRole.ENGINEER,
      createdAt: new Date(),
      user: { id: 'new-user', name: 'New User', email: 'new@example.com' },
    };

    it('should add member when requester is OWNER', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockImplementation(
        (args: { where: { workspaceId_userId: { userId: string } } }) => {
          if (args.where.workspaceId_userId.userId === mockUserId) {
            return Promise.resolve(mockMember);
          }
          return Promise.resolve(null);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'new-user',
        email: 'new@example.com',
      });
      (prisma.workspaceMember.create as jest.Mock).mockResolvedValue(
        mockNewMember,
      );

      const result = await service.addMember(
        mockWorkspaceId,
        mockUserId,
        addMemberDto,
      );

      expect(result).toEqual(mockNewMember);
    });

    it('should add member when requester is ADMIN', async () => {
      const adminMember = {
        ...mockMember,
        role: WorkspaceMemberRole.ADMIN,
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockImplementation(
        (args: { where: { workspaceId_userId: { userId: string } } }) => {
          if (args.where.workspaceId_userId.userId === mockUserId) {
            return Promise.resolve(adminMember);
          }
          return Promise.resolve(null);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'new-user',
        email: 'new@example.com',
      });
      (prisma.workspaceMember.create as jest.Mock).mockResolvedValue(
        mockNewMember,
      );

      const result = await service.addMember(
        mockWorkspaceId,
        mockUserId,
        addMemberDto,
      );

      expect(result).toEqual(mockNewMember);
    });

    it('should throw ForbiddenException when requester is MEMBER', async () => {
      const memberRole = {
        ...mockMember,
        role: WorkspaceMemberRole.ENGINEER,
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        memberRole,
      );

      await expect(
        service.addMember(mockWorkspaceId, mockUserId, addMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when user to add does not exist', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addMember(mockWorkspaceId, mockUserId, addMemberDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when user is already a member', async () => {
      const existingMember = {
        workspaceId: mockWorkspaceId,
        userId: 'new-user',
        role: WorkspaceMemberRole.ENGINEER,
        createdAt: new Date(),
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockImplementation(
        (args: { where: { workspaceId_userId: { userId: string } } }) => {
          if (args.where.workspaceId_userId.userId === mockUserId) {
            return Promise.resolve(mockMember);
          }
          return Promise.resolve(existingMember);
        },
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'new-user',
        email: 'new@example.com',
      });

      await expect(
        service.addMember(mockWorkspaceId, mockUserId, addMemberDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateMemberRole', () => {
    const targetUserId = 'member-2';
    const newRole = WorkspaceMemberRole.ADMIN;

    const mockTargetMember = {
      workspaceId: mockWorkspaceId,
      userId: targetUserId,
      role: WorkspaceMemberRole.ENGINEER,
      createdAt: new Date(),
    };

    const mockUpdatedMember = {
      ...mockTargetMember,
      role: newRole,
      user: { id: targetUserId, name: 'Member 2', email: 'm2@example.com' },
    };

    it('should update member role when requester is OWNER', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );
      const updateSpy = jest
        .spyOn(prisma.workspaceMember, 'update')
        .mockResolvedValue(mockUpdatedMember);

      const result = await service.updateMemberRole(
        mockWorkspaceId,
        mockUserId,
        targetUserId,
        newRole,
      );

      expect(result).toEqual(mockUpdatedMember);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: newRole },
        }) as Record<string, unknown>,
      );
    });

    it('should throw ForbiddenException when requester is ADMIN', async () => {
      const adminMember = {
        ...mockMember,
        role: WorkspaceMemberRole.ADMIN,
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        adminMember,
      );

      await expect(
        service.updateMemberRole(
          mockWorkspaceId,
          mockUserId,
          targetUserId,
          newRole,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when requester is not a member', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateMemberRole(
          mockWorkspaceId,
          mockUserId,
          targetUserId,
          newRole,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when trying to change owner role', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      await expect(
        service.updateMemberRole(
          mockWorkspaceId,
          mockUserId,
          mockUserId,
          newRole,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    const targetUserId = 'member-2';

    it('should remove member when requester is OWNER', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );
      const deleteSpy = jest
        .spyOn(prisma.workspaceMember, 'delete')
        .mockResolvedValue({} as unknown as typeof mockMember);

      const result = await service.removeMember(
        mockWorkspaceId,
        mockUserId,
        targetUserId,
      );

      expect(result).toEqual({ message: 'Member removed successfully' });
      expect(deleteSpy).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: mockWorkspaceId,
            userId: targetUserId,
          },
        },
      });
    });

    it('should remove member when requester is ADMIN', async () => {
      const adminMember = {
        ...mockMember,
        role: WorkspaceMemberRole.ADMIN,
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        adminMember,
      );
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );
      (prisma.workspaceMember.delete as jest.Mock).mockResolvedValue({});

      const result = await service.removeMember(
        mockWorkspaceId,
        mockUserId,
        targetUserId,
      );

      expect(result).toEqual({ message: 'Member removed successfully' });
    });

    it('should throw ForbiddenException when requester is MEMBER', async () => {
      const memberRole = {
        ...mockMember,
        role: WorkspaceMemberRole.ENGINEER,
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        memberRole,
      );

      await expect(
        service.removeMember(mockWorkspaceId, mockUserId, targetUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when trying to remove owner', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      await expect(
        service.removeMember(mockWorkspaceId, mockUserId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when ADMIN tries to remove self', async () => {
      const adminId = 'admin-1';
      const adminMember = {
        workspaceId: mockWorkspaceId,
        userId: adminId,
        role: WorkspaceMemberRole.ADMIN,
        createdAt: new Date(),
      };
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        adminMember,
      );
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        mockWorkspace,
      );

      await expect(
        service.removeMember(mockWorkspaceId, adminId, adminId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow OWNER to remove self', async () => {
      (prisma.workspaceMember.findUnique as jest.Mock).mockResolvedValue(
        mockMember,
      );
      const nonOwnerWorkspace = {
        ...mockWorkspace,
        ownerId: 'someone-else',
      };
      (prisma.workspace.findUnique as jest.Mock).mockResolvedValue(
        nonOwnerWorkspace,
      );
      (prisma.workspaceMember.delete as jest.Mock).mockResolvedValue({});

      const result = await service.removeMember(
        mockWorkspaceId,
        mockUserId,
        mockUserId,
      );

      expect(result).toEqual({ message: 'Member removed successfully' });
    });
  });
});
