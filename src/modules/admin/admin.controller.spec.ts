import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserRole } from '@prisma/client';

describe('AdminController', () => {
  let controller: AdminController;

  const mockAdminService = {
    listAllUsers: jest.fn(),
    updateUserRole: jest.fn(),
    getAllAuditLogs: jest.fn(),
    getFailedDeployments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  describe('listUsers', () => {
    it('should call adminService.listAllUsers', async () => {
      const users = [{ id: 'u1', role: UserRole.USER }];
      mockAdminService.listAllUsers.mockResolvedValue(users);

      const result = await controller.listUsers();

      expect(result).toEqual(users);
      expect(mockAdminService.listAllUsers).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('should call adminService.updateUserRole with correct params', async () => {
      const updated = { id: 'u1', role: UserRole.SUPER_ADMIN };
      mockAdminService.updateUserRole.mockResolvedValue(updated);

      const result = await controller.updateUserRole(
        'u1',
        {
          role: UserRole.SUPER_ADMIN,
        },
        'admin-1',
      );

      expect(result).toEqual(updated);
      expect(mockAdminService.updateUserRole).toHaveBeenCalledWith(
        'u1',
        UserRole.SUPER_ADMIN,
        'admin-1',
      );
    });
  });

  describe('getAuditLogs', () => {
    it('should call adminService.getAllAuditLogs', async () => {
      const logs = [{ id: 'l1' }];
      mockAdminService.getAllAuditLogs.mockResolvedValue(logs);

      const result = await controller.getAuditLogs();

      expect(result).toEqual(logs);
    });
  });

  describe('getFailedDeployments', () => {
    it('should call adminService.getFailedDeployments', async () => {
      const deps = [{ id: 'd1', status: 'FAILED' }];
      mockAdminService.getFailedDeployments.mockResolvedValue(deps);

      const result = await controller.getFailedDeployments();

      expect(result).toEqual(deps);
    });
  });
});
