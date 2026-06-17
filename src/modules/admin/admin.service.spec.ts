/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: jest.Mocked<PrismaService>;
  let auditLogService: jest.Mocked<AuditLogService>;

  const mockUser = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: UserRole.USER,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            deployment: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            logAction: jest.fn().mockResolvedValue({ id: 'log-1' }),
            getAllLogs: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<jest.Mocked<PrismaService>>(PrismaService);
    auditLogService = module.get<jest.Mocked<AuditLogService>>(AuditLogService);
  });

  describe('listAllUsers', () => {
    it('should return all users', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUser]);

      const result = await service.listAllUsers();

      expect(result).toEqual([mockUser]);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  describe('updateUserRole', () => {
    it('should update user role and log audit', async () => {
      const updatedUser = { ...mockUser, role: UserRole.SUPER_ADMIN };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateUserRole(
        'user-1',
        UserRole.SUPER_ADMIN,
        'admin-1',
      );

      expect(result.role).toBe(UserRole.SUPER_ADMIN);
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        action: 'UPDATE',
        entity: 'User',
        entityId: 'user-1',
        userId: 'admin-1',
        oldValue: { role: UserRole.USER },
        newValue: { role: UserRole.SUPER_ADMIN },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateUserRole('nonexistent', UserRole.USER, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllAuditLogs', () => {
    it('should delegate to auditLogService.getAllLogs', async () => {
      const mockLogs = [{ id: 'log-1', action: 'CREATE' }];
      (auditLogService.getAllLogs as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.getAllAuditLogs();

      expect(result).toEqual(mockLogs);
      expect(auditLogService.getAllLogs).toHaveBeenCalled();
    });
  });

  describe('getFailedDeployments', () => {
    it('should return deployments with FAILED status', async () => {
      const mockDeployment = {
        id: 'dep-1',
        version: 'v1.0',
        status: 'FAILED',
      };
      (prisma.deployment.findMany as jest.Mock).mockResolvedValue([
        mockDeployment,
      ]);

      const result = await service.getFailedDeployments();

      expect(result).toEqual([mockDeployment]);
      expect(prisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'FAILED' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
