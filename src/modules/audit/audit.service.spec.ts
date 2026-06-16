import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma, WorkspaceMemberRole } from '@prisma/client';
import type { AuditQueryDto } from './dto/audit-query.dto';

describe('AuditService', () => {
  let service: AuditService;

  const mockAuditLogCreate = jest.fn();
  const mockAuditLogFindMany = jest.fn();
  const mockAuditLogCount = jest.fn();
  const mockAuditLogGroupBy = jest.fn();
  const mockWsMemberFindMany = jest.fn();
  const mockWsMemberFindUnique = jest.fn();

  type MockFn = { mock: { calls: unknown[][] } };
  function getCallArg(mockFn: MockFn, index: number): unknown {
    return mockFn.mock.calls[0]?.[index];
  }

  const mockUserId = 'user-1';
  const mockWorkspaceId = 'ws-1';

  const mockAuditLog = {
    id: 'audit-1',
    action: AuditAction.CREATE,
    entity: 'Project',
    entityId: 'proj-1',
    userId: mockUserId,
    oldValue: null,
    newValue: { name: 'Test Project' },
    workspaceId: mockWorkspaceId,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    createdAt: new Date(),
    user: { id: mockUserId, name: 'Test User', email: 'test@example.com' },
    workspace: { id: mockWorkspaceId, name: 'Test WS', slug: 'test-ws' },
  };

  const mockMember = {
    workspaceId: mockWorkspaceId,
    userId: mockUserId,
    role: WorkspaceMemberRole.ADMIN,
    createdAt: new Date(),
  };

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  beforeEach(async () => {
    mockAuditLogCreate.mockReset();
    mockAuditLogFindMany.mockReset();
    mockAuditLogCount.mockReset();
    mockAuditLogGroupBy.mockReset();
    mockWsMemberFindMany.mockReset();
    mockWsMemberFindUnique.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: {
            auditLog: {
              create: mockAuditLogCreate,
              findMany: mockAuditLogFindMany,
              count: mockAuditLogCount,
              groupBy: mockAuditLogGroupBy,
            },
            workspaceMember: {
              findMany: mockWsMemberFindMany,
              findUnique: mockWsMemberFindUnique,
            },
          },
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('log', () => {
    const logData = {
      action: AuditAction.CREATE,
      entity: 'Project',
      entityId: 'proj-1',
      userId: mockUserId,
      workspaceId: mockWorkspaceId,
      oldValue: null,
      newValue: { name: 'Test Project' },
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    };

    it('should create an audit log successfully', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      const result = await service.log(logData);

      expect(result).toEqual(mockAuditLog);
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          action: AuditAction.CREATE,
          entity: 'Project',
          entityId: 'proj-1',
          userId: mockUserId,
          workspaceId: mockWorkspaceId,
          oldValue: Prisma.DbNull,
          newValue: { name: 'Test Project' },
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          workspace: { select: { id: true, name: true, slug: true } },
        },
      });
    });

    it('should return null when workspaceId is null', async () => {
      const result = await service.log({ ...logData, workspaceId: null });

      expect(result).toBeNull();
      expect(mockAuditLogCreate).not.toHaveBeenCalled();
    });

    it('should use Prisma.DbNull when oldValue is null', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      await service.log({ ...logData, oldValue: null });

      type CreateArg = { data: { oldValue: unknown } };
      const arg = getCallArg(mockAuditLogCreate as MockFn, 0) as CreateArg;
      expect(arg.data.oldValue).toBe(Prisma.DbNull);
    });

    it('should use Prisma.DbNull when newValue is null', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      await service.log({ ...logData, newValue: null });

      type CreateArg = { data: { newValue: unknown } };
      const arg = getCallArg(mockAuditLogCreate as MockFn, 0) as CreateArg;
      expect(arg.data.newValue).toBe(Prisma.DbNull);
    });

    it('should use Prisma.DbNull when oldValue is undefined', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      await service.log({ ...logData, oldValue: undefined });

      type CreateArg = { data: { oldValue: unknown } };
      const arg = getCallArg(mockAuditLogCreate as MockFn, 0) as CreateArg;
      expect(arg.data.oldValue).toBe(Prisma.DbNull);
    });

    it('should use entityId "unknown" when entityId is null', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      await service.log({ ...logData, entityId: null });

      type CreateArg = { data: { entityId: string } };
      const arg = getCallArg(mockAuditLogCreate as MockFn, 0) as CreateArg;
      expect(arg.data.entityId).toBe('unknown');
    });

    it('should redact sensitive fields from oldValue and newValue', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      await service.log({
        ...logData,
        oldValue: { password: 'secret123', name: 'old' },
        newValue: { token: 'abc', passwordHash: 'xyz', name: 'new' },
      });

      type CreateArg = {
        data: {
          oldValue: Record<string, unknown>;
          newValue: Record<string, unknown>;
        };
      };
      const arg = getCallArg(mockAuditLogCreate as MockFn, 0) as CreateArg;
      expect(arg.data.oldValue).toEqual({
        password: '[REDACTED]',
        name: 'old',
      });
      expect(arg.data.newValue).toEqual({
        token: '[REDACTED]',
        passwordHash: '[REDACTED]',
        name: 'new',
      });
    });

    it('should pass through non-object values without redaction', async () => {
      mockAuditLogCreate.mockResolvedValueOnce(mockAuditLog);

      await service.log({ ...logData, newValue: 'simple-string' });

      type CreateArg = { data: { newValue: unknown } };
      const arg = getCallArg(mockAuditLogCreate as MockFn, 0) as CreateArg;
      expect(arg.data.newValue).toBe('simple-string');
    });

    it('should return null and not throw when prisma throws', async () => {
      mockAuditLogCreate.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.log(logData);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    const baseQuery: AuditQueryDto = { page: 1, limit: 20 };

    it('should return paginated logs for SUPER_ADMIN without workspace filter', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      const result = await service.findAll(
        baseQuery,
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(mockWsMemberFindMany).not.toHaveBeenCalled();
    });

    it('should filter by user workspaces for non-admin', async () => {
      mockWsMemberFindMany.mockResolvedValueOnce([mockMember]);
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      await service.findAll(baseQuery, mockUserId, 'USER');

      expect(mockWsMemberFindMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { workspaceId: true },
      });
      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: { in: [mockWorkspaceId] },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should apply action filter when provided', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      await service.findAll(
        { ...baseQuery, action: AuditAction.DELETE },
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: AuditAction.DELETE,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should apply entity and entityId filters when provided', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      await service.findAll(
        { ...baseQuery, entity: 'Task', entityId: 'task-1' },
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entity: 'Task',
            entityId: 'task-1',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should apply target userId filter when provided', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      await service.findAll(
        { ...baseQuery, userId: 'target-user' },
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'target-user',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should override workspace filter when workspaceId query param is set', async () => {
      mockWsMemberFindMany.mockResolvedValueOnce([mockMember]);
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);
      mockAuditLogCount.mockResolvedValueOnce(1);

      await service.findAll(
        { ...baseQuery, workspaceId: 'ws-override' },
        mockUserId,
        'USER',
      );

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: 'ws-override',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should calculate skip correctly for page > 1', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([]);
      mockAuditLogCount.mockResolvedValueOnce(45);

      const result = await service.findAll(
        { page: 3, limit: 10 },
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.meta.totalPages).toBe(5);
    });

    it('should return empty results with correct meta', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([]);
      mockAuditLogCount.mockResolvedValueOnce(0);

      const result = await service.findAll(
        baseQuery,
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('findByEntity', () => {
    it('should return logs for a specific entity as SUPER_ADMIN', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);

      const result = await service.findByEntity(
        'Project',
        'proj-1',
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entity: 'Project', entityId: 'proj-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(mockWsMemberFindMany).not.toHaveBeenCalled();
    });

    it('should filter by user workspaces for non-admin', async () => {
      mockWsMemberFindMany.mockResolvedValueOnce([mockMember]);
      mockAuditLogFindMany.mockResolvedValueOnce([]);

      await service.findByEntity('Project', 'proj-1', mockUserId, 'USER');

      expect(mockWsMemberFindMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { workspaceId: true },
      });
      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            entity: 'Project',
            entityId: 'proj-1',
            workspaceId: { in: [mockWorkspaceId] },
          },
        }),
      );
    });

    it('should return empty array when no logs exist', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([]);

      const result = await service.findByEntity(
        'Task',
        'nonexistent',
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(result).toEqual([]);
    });
  });

  describe('findByUser', () => {
    it('should return logs for a specific user as SUPER_ADMIN', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);

      const result = await service.findByUser(
        mockUserId,
        'target-user',
        'SUPER_ADMIN',
      );

      expect(result).toEqual([mockAuditLog]);
      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'target-user' },
          take: 100,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(mockWsMemberFindMany).not.toHaveBeenCalled();
    });

    it('should filter by user workspaces for non-admin', async () => {
      mockWsMemberFindMany.mockResolvedValueOnce([mockMember]);
      mockAuditLogFindMany.mockResolvedValueOnce([]);

      await service.findByUser(mockUserId, 'target-user', 'USER');

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'target-user',
            workspaceId: { in: [mockWorkspaceId] },
          },
        }),
      );
    });

    it('should return empty array when no logs exist', async () => {
      mockAuditLogFindMany.mockResolvedValueOnce([]);

      const result = await service.findByUser(
        mockUserId,
        'target-user',
        'SUPER_ADMIN',
      );

      expect(result).toEqual([]);
    });
  });

  describe('getActivitySummary', () => {
    type GroupByResult = {
      action?: AuditAction;
      entity?: string;
      _count: number;
    };

    const mockByAction: GroupByResult[] = [
      { action: AuditAction.CREATE, _count: 10 },
      { action: AuditAction.UPDATE, _count: 5 },
      { action: AuditAction.DELETE, _count: 2 },
    ];

    const mockByEntity: GroupByResult[] = [
      { entity: 'Project', _count: 8 },
      { entity: 'Task', _count: 5 },
    ];

    it('should return activity summary for SUPER_ADMIN without membership check', async () => {
      mockAuditLogGroupBy
        .mockResolvedValueOnce(mockByAction)
        .mockResolvedValueOnce(mockByEntity);
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);

      const result = await service.getActivitySummary(
        mockWorkspaceId,
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(mockWsMemberFindUnique).not.toHaveBeenCalled();
      expect(result.summary.totalActions).toBe(17);
      expect(result.summary.byAction).toEqual([
        { action: AuditAction.CREATE, count: 10 },
        { action: AuditAction.UPDATE, count: 5 },
        { action: AuditAction.DELETE, count: 2 },
      ]);
      expect(result.summary.topEntities).toEqual([
        { entity: 'Project', count: 8 },
        { entity: 'Task', count: 5 },
      ]);
      expect(result.recentActivity).toEqual([mockAuditLog]);
    });

    it('should allow access for non-admin workspace member', async () => {
      mockWsMemberFindUnique.mockResolvedValueOnce(mockMember);
      mockAuditLogGroupBy
        .mockResolvedValueOnce(mockByAction)
        .mockResolvedValueOnce(mockByEntity);
      mockAuditLogFindMany.mockResolvedValueOnce([mockAuditLog]);

      const result = await service.getActivitySummary(
        mockWorkspaceId,
        mockUserId,
        'USER',
      );

      expect(mockWsMemberFindUnique).toHaveBeenCalledWith({
        where: {
          workspaceId_userId: {
            workspaceId: mockWorkspaceId,
            userId: mockUserId,
          },
        },
      });
      expect(result.summary.totalActions).toBe(17);
    });

    it('should throw Error when non-admin is not a workspace member', async () => {
      mockWsMemberFindUnique.mockResolvedValueOnce(null);

      await expect(
        service.getActivitySummary(mockWorkspaceId, mockUserId, 'USER'),
      ).rejects.toThrow('Access denied to this workspace');
    });

    it('should return zero totals when no activity exists', async () => {
      mockAuditLogGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      mockAuditLogFindMany.mockResolvedValueOnce([]);

      const result = await service.getActivitySummary(
        mockWorkspaceId,
        mockUserId,
        'SUPER_ADMIN',
      );

      expect(result.summary.totalActions).toBe(0);
      expect(result.summary.byAction).toEqual([]);
      expect(result.summary.topEntities).toEqual([]);
      expect(result.recentActivity).toEqual([]);
    });
  });
});
