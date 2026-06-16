import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../../modules/audit/audit.service';
import { Reflector } from '@nestjs/core';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';
import { AuditAction } from '@prisma/client';
import { of, throwError } from 'rxjs';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;

  const mockAuditLog = jest.fn();
  const mockGetAllAndOverride = jest.fn();

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    role: 'USER' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  function createMockRequest(
    overrides: Partial<AuthenticatedRequest> = {},
  ): AuthenticatedRequest {
    return {
      user: mockUser,
      method: 'POST',
      url: '/workspaces/f1f2f3f4-f5f6-7890-abcd-ef1234567890/projects',
      body: { name: 'Test' },
      params: {},
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      ...overrides,
    } as AuthenticatedRequest;
  }

  function createMockContext(request: AuthenticatedRequest): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function createMockHandler(returnValue: unknown = {}): CallHandler {
    return { handle: jest.fn(() => of(returnValue)) };
  }

  function flushPromises(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Type-safe accessor for private methods (no `any`)
  type PrivateMethods = {
    extractEntityFromUrl: (url: string) => string;
    extractEntityIdFromUrl: (url: string) => string | null;
    isValidUUID: (uuid: string) => boolean;
    extractWorkspaceId: (
      req: AuthenticatedRequest,
      data: Record<string, unknown> | null | undefined,
    ) => string | null;
    getUserDefaultWorkspace: () => string | null;
  };

  beforeEach(() => {
    mockAuditLog.mockReset();
    mockGetAllAndOverride.mockReset();

    const auditService = { log: mockAuditLog } as unknown as AuditService;
    const reflector = {
      getAllAndOverride: mockGetAllAndOverride,
    } as unknown as Reflector;

    interceptor = new AuditInterceptor(auditService, reflector);
    mockGetAllAndOverride.mockReturnValue(false);
  });

  function priv(): PrivateMethods {
    return interceptor as unknown as PrivateMethods;
  }

  describe('skipAudit decorator', () => {
    it('should pass through without audit when @SkipAudit is set', async () => {
      mockGetAllAndOverride.mockReturnValue(true);
      const request = createMockRequest();
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('should check SKIP_AUDIT_KEY via reflector', () => {
      const request = createMockRequest();
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      expect(mockGetAllAndOverride).toHaveBeenCalledWith(SKIP_AUDIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });

  describe('GET requests', () => {
    it('should pass through without audit for GET requests', async () => {
      const request = createMockRequest({ method: 'GET' });
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('POST interception', () => {
    it('should log CREATE audit with entity ID from response', async () => {
      const responseId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const request = createMockRequest({
        method: 'POST',
        url: '/workspaces/f1f2f3f4-f5f6-7890-abcd-ef1234567890/projects',
        body: { name: 'New Project' },
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: responseId,
        workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
      });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entity: 'Workspace',
          entityId: responseId,
          userId: 'user-1',
          oldValue: null,
        }),
      );
    });

    it('should use null entityId when POST response has no id', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: '/auth/login',
        body: {
          email: 'test@test.com',
          workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
        },
      });
      const context = createMockContext(request);
      const next = createMockHandler({ success: true });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityId: null,
        }),
      );
    });

    it('should set newValue to body for POST', async () => {
      const body = { name: 'New Item' };
      const request = createMockRequest({
        method: 'POST',
        url: '/workspaces/f1f2f3f4-f5f6-7890-abcd-ef1234567890/tasks',
        body,
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: body,
          oldValue: null,
        }),
      );
    });
  });

  describe('PATCH interception', () => {
    it('should log UPDATE audit with oldBody as oldValue', async () => {
      const oldBody = { name: 'Old Name' };
      const body = { name: 'New Name' };
      const entityId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const wsId = 'f1f2f3f4-f5f6-7890-abcd-ef1234567890';
      const request = createMockRequest({
        method: 'PATCH',
        url: `/projects/${entityId}`,
        body: { ...body, workspaceId: wsId },
        oldBody,
      });
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entity: 'Project',
          entityId,
          oldValue: oldBody,
          newValue: expect.objectContaining(body) as Record<string, unknown>,
        }),
      );
    });

    it('should fall back to body as oldValue when oldBody is undefined', async () => {
      const body = {
        name: 'Updated',
        workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
      };
      const request = createMockRequest({
        method: 'PATCH',
        url: '/tasks/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body,
      });
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: body,
        }),
      );
    });
  });

  describe('PUT interception', () => {
    it('should log UPDATE audit for PUT requests', async () => {
      const request = createMockRequest({
        method: 'PUT',
        url: '/tasks/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body: {
          title: 'Replaced',
          workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
        },
      });
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
        }),
      );
    });
  });

  describe('DELETE interception', () => {
    it('should log DELETE audit with null newValue', async () => {
      const entityId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const request = createMockRequest({
        method: 'DELETE',
        url: `/tasks/${entityId}`,
        body: { workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890' },
      });
      const context = createMockContext(request);
      const next = createMockHandler({ deleted: true });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DELETE,
          entity: 'Task',
          entityId,
          newValue: null,
        }),
      );
    });

    it('should use oldBody or body as oldValue for DELETE', async () => {
      const body = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
      };
      const request = createMockRequest({
        method: 'DELETE',
        url: '/deployments/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body,
      });
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: body,
        }),
      );
    });
  });

  describe('workspaceId resolution', () => {
    it('should resolve from URL when URL contains workspaces path', async () => {
      const wsId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const request = createMockRequest({
        method: 'DELETE',
        url: `/workspaces/${wsId}`,
        body: {},
      });
      const context = createMockContext(request);
      const next = createMockHandler();

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: wsId }),
      );
    });

    it('should resolve from body workspaceId', async () => {
      const wsId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
      const request = createMockRequest({
        method: 'POST',
        url: '/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks',
        body: { name: 'Task', workspaceId: wsId },
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: wsId }),
      );
    });

    it('should resolve from response workspaceId', async () => {
      const wsId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
      const request = createMockRequest({
        method: 'POST',
        url: '/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/tasks',
        body: { title: 'Task' },
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
        workspaceId: wsId,
      });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: wsId }),
      );
    });

    it('should resolve from response project.workspaceId', async () => {
      const wsId = 'd4e5f6a7-b8c9-0123-defa-234567890123';
      const request = createMockRequest({
        method: 'POST',
        url: '/tasks',
        body: { title: 'Task' },
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
        project: { workspaceId: wsId },
      });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: wsId }),
      );
    });

    it('should skip audit log when no workspace context is found', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: '/auth/login',
        body: { email: 'test@test.com' },
        user: undefined as unknown as AuthenticatedRequest['user'],
      });
      const context = createMockContext(request);
      const next = createMockHandler({ token: 'abc' });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('entity extraction', () => {
    it('should extract Workspace from workspaces URL', () => {
      expect(priv().extractEntityFromUrl('/workspaces/abc')).toBe('Workspace');
    });

    it('should extract Project from projects URL', () => {
      expect(priv().extractEntityFromUrl('/projects/abc')).toBe('Project');
    });

    it('should extract Task from tasks URL', () => {
      expect(priv().extractEntityFromUrl('/tasks/abc')).toBe('Task');
    });

    it('should extract Deployment from deployments URL', () => {
      expect(priv().extractEntityFromUrl('/deployments/abc')).toBe(
        'Deployment',
      );
    });

    it('should extract User from users URL', () => {
      expect(priv().extractEntityFromUrl('/users/abc')).toBe('User');
    });

    it('should extract Auth from auth URL', () => {
      expect(priv().extractEntityFromUrl('/auth/login')).toBe('Auth');
    });

    it('should return first segment for unknown entity', () => {
      expect(priv().extractEntityFromUrl('/settings/profile')).toBe('settings');
    });

    it('should return Unknown for root URL', () => {
      expect(priv().extractEntityFromUrl('/')).toBe('Unknown');
    });
  });

  describe('entity ID extraction', () => {
    const validUUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    it('should extract valid UUID from URL', () => {
      expect(priv().extractEntityIdFromUrl(`/projects/${validUUID}`)).toBe(
        validUUID,
      );
    });

    it('should return null when URL has no UUID', () => {
      expect(priv().extractEntityIdFromUrl('/projects')).toBeNull();
    });

    it('should extract UUID from nested URL', () => {
      expect(
        priv().extractEntityIdFromUrl(`/workspaces/${validUUID}/projects`),
      ).toBe(validUUID);
    });
  });

  describe('isValidUUID', () => {
    it('should return true for valid UUID', () => {
      expect(priv().isValidUUID('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
        true,
      );
    });

    it('should return false for non-UUID string', () => {
      expect(priv().isValidUUID('not-a-uuid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(priv().isValidUUID('')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should log error when observable emits error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const request = createMockRequest({
        method: 'POST',
        url: '/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body: { name: 'Test' },
      });
      const context = createMockContext(request);
      const next: CallHandler = {
        handle: jest.fn(() => throwError(() => new Error('HTTP 500'))),
      };

      interceptor.intercept(context, next).subscribe({
        error: () => undefined,
      });

      await flushPromises();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT ERROR]'),
        'HTTP 500',
      );
      consoleSpy.mockRestore();
    });

    it('should handle non-Error exceptions in tap error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const request = createMockRequest({
        method: 'DELETE',
        url: '/tasks/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body: {},
      });
      const context = createMockContext(request);
      const next: CallHandler = {
        handle: jest.fn(() => throwError(() => 'string error')),
      };

      interceptor.intercept(context, next).subscribe({
        error: () => undefined,
      });

      await flushPromises();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT ERROR]'),
        'string error',
      );
      consoleSpy.mockRestore();
    });

    it('should not crash when auditService.log throws inside async IIFE', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockAuditLog.mockRejectedValueOnce(new Error('Audit DB failure'));

      const request = createMockRequest({
        method: 'POST',
        url: '/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body: {
          name: 'Test',
          workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
        },
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      });

      // Should not throw
      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AUDIT ERROR]'),
        'Audit DB failure',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('metadata passthrough', () => {
    it('should include ipAddress and userAgent in audit data', async () => {
      const request = createMockRequest({
        method: 'POST',
        url: '/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        body: {
          name: 'Test',
          workspaceId: 'f1f2f3f4-f5f6-7890-abcd-ef1234567890',
        },
        ip: '192.168.1.1',
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      const context = createMockContext(request);
      const next = createMockHandler({
        id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      });

      interceptor.intercept(context, next).subscribe();

      await flushPromises();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }),
      );
    });
  });
});
