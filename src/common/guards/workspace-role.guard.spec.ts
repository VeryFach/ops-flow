import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceMemberRole } from '@prisma/client';
import { WorkspaceRoleGuard } from './workspace-role.guard';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

describe('WorkspaceRoleGuard', () => {
  let guard: WorkspaceRoleGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockMember = {
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: WorkspaceMemberRole.ADMIN,
    createdAt: new Date(),
  };

  const mockRequest: Partial<AuthenticatedRequest> = {
    user: mockUser,
    params: {},
    body: {},
  };

  const mockContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => mockRequest),
    })),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    const reflectorMock = {
      getAllAndOverride: jest.fn(),
    };

    const prismaMock = {
      workspaceMember: {
        findUnique: jest.fn(),
      },
    };

    reflector = reflectorMock as unknown as jest.Mocked<Reflector>;
    prisma = prismaMock as unknown as jest.Mocked<PrismaService>;

    guard = new WorkspaceRoleGuard(reflector, prisma);

    // Reset request state between tests
    mockRequest.user = mockUser;
    mockRequest.params = {};
    mockRequest.body = {};
    mockRequest.workspaceMember = undefined;
  });

  describe('canActivate', () => {
    it('should return true when no roles are required', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      const reflectorSpy = jest.spyOn(reflector, 'getAllAndOverride');
      expect(reflectorSpy).toHaveBeenCalledWith(WORKSPACE_ROLES_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('should return true when required roles array is empty', async () => {
      reflector.getAllAndOverride.mockReturnValue([]);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should allow access when user has the required role', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = { workspaceId: 'ws-1' };

      const findUniqueSpy = jest
        .spyOn(prisma.workspaceMember, 'findUnique')
        .mockResolvedValue(mockMember);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: 'ws-1',
            userId: 'user-1',
          },
        },
      });
      expect(mockRequest.workspaceMember).toEqual(mockMember);
    });

    it('should allow access when user has one of multiple required roles', async () => {
      reflector.getAllAndOverride.mockReturnValue([
        WorkspaceMemberRole.OWNER,
        WorkspaceMemberRole.ADMIN,
      ]);
      mockRequest.params = { workspaceId: 'ws-1' };

      jest
        .spyOn(prisma.workspaceMember, 'findUnique')
        .mockResolvedValue(mockMember);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when workspaceId is missing', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = {};
      mockRequest.body = {};

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new ForbiddenException('Workspace ID is required'),
      );
    });

    it('should resolve workspaceId from body when not in params', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = {};
      mockRequest.body = { workspaceId: 'ws-from-body' };

      const findUniqueSpy = jest
        .spyOn(prisma.workspaceMember, 'findUnique')
        .mockResolvedValue({ ...mockMember, workspaceId: 'ws-from-body' });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: 'ws-from-body',
            userId: 'user-1',
          },
        },
      });
    });

    it('should ignore non-string workspaceId in body', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = {};
      mockRequest.body = { workspaceId: 123 };

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new ForbiddenException('Workspace ID is required'),
      );
    });

    it('should throw ForbiddenException when user is not authenticated', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = { workspaceId: 'ws-1' };
      mockRequest.user = undefined;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should throw NotFoundException when user is not a workspace member', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = { workspaceId: 'ws-1' };

      jest.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new NotFoundException('User is not a member of this workspace'),
      );
    });

    it('should throw ForbiddenException when user has insufficient role', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.OWNER]);
      mockRequest.params = { workspaceId: 'ws-1' };

      jest
        .spyOn(prisma.workspaceMember, 'findUnique')
        .mockResolvedValue(mockMember);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new ForbiddenException(
          `Access denied. Required roles: ${WorkspaceMemberRole.OWNER}. Your role: ${WorkspaceMemberRole.ADMIN}`,
        ),
      );
    });

    it('should not attach workspaceMember when access is denied', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.OWNER]);
      mockRequest.params = { workspaceId: 'ws-1' };

      jest
        .spyOn(prisma.workspaceMember, 'findUnique')
        .mockResolvedValue(mockMember);

      try {
        await guard.canActivate(mockContext);
      } catch {
        // Expected ForbiddenException
      }

      expect(mockRequest.workspaceMember).toBeUndefined();
    });

    it('should prefer workspaceId from params over body', async () => {
      reflector.getAllAndOverride.mockReturnValue([WorkspaceMemberRole.ADMIN]);
      mockRequest.params = { workspaceId: 'ws-from-params' };
      mockRequest.body = { workspaceId: 'ws-from-body' };

      const findUniqueSpy = jest
        .spyOn(prisma.workspaceMember, 'findUnique')
        .mockResolvedValue(mockMember);

      await guard.canActivate(mockContext);

      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: 'ws-from-params',
            userId: 'user-1',
          },
        },
      });
    });
  });
});
