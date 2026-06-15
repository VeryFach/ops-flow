import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';
import { AuditAction } from '@prisma/client';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

type ResponseData = Record<string, unknown> | null | undefined;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipAudit = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipAudit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const method = request.method;
    const url = request.url;
    const body = request.body as Record<string, unknown> | undefined;
    const oldBody = request.oldBody; // For update operations

    // Determine action based on HTTP method
    let action: AuditAction | null = null;
    const entity = this.extractEntityFromUrl(url);
    let entityId = this.extractEntityIdFromUrl(url);

    switch (method) {
      case 'POST':
        action = AuditAction.CREATE;
        break;
      case 'PATCH':
      case 'PUT':
        action = AuditAction.UPDATE;
        break;
      case 'DELETE':
        action = AuditAction.DELETE;
        break;
      default:
        // Skip GET requests
        return next.handle();
    }

    if (!action) {
      return next.handle();
    }

    // For entity without ID in URL (like POST), try to get from response
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (responseData: unknown) => {
          void (async () => {
            const data = responseData as ResponseData;
            // For POST requests, try to get the created entity ID from response
            if (method === 'POST' && data && typeof data.id === 'string') {
              entityId = data.id;
            }

            const auditData = {
              action,
              entity,
              entityId: entityId || null,
              userId: user?.id || null,
              workspaceId: this.extractWorkspaceId(request, data),
              oldValue: method !== 'POST' ? oldBody || body : null,
              newValue: method !== 'DELETE' ? body || data : null,
              ipAddress: request.ip || request.socket?.remoteAddress,
              userAgent: request.headers['user-agent'],
            };

            // Only log if we have workspace context
            if (auditData.workspaceId) {
              await this.auditService.log(auditData);
            }

            const duration = Date.now() - startTime;
            console.log(
              `[AUDIT] ${action} ${entity} ${entityId} - ${duration}ms`,
            );
          })().catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[AUDIT ERROR] ${action} ${entity}:`, msg);
          });
        },
        error: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(`[AUDIT ERROR] ${action} ${entity}:`, message);
        },
      }),
    );
  }

  private extractEntityFromUrl(url: string): string {
    const parts = url.split('/').filter(Boolean);

    // Map URL patterns to entity names
    if (parts.includes('workspaces')) return 'Workspace';
    if (parts.includes('projects')) return 'Project';
    if (parts.includes('tasks')) return 'Task';
    if (parts.includes('deployments')) return 'Deployment';
    if (parts.includes('users')) return 'User';
    if (parts.includes('auth')) return 'Auth';

    return parts[0] || 'Unknown';
  }

  private extractEntityIdFromUrl(url: string): string | null {
    const parts = url.split('/').filter(Boolean);

    // Find UUID pattern in URL
    for (const part of parts) {
      if (this.isValidUUID(part)) {
        return part;
      }
    }

    return null;
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private extractWorkspaceId(
    request: AuthenticatedRequest,
    responseData: ResponseData,
  ): string | null {
    const url = request.url;
    const body = request.body as Record<string, unknown> | undefined;
    const user = request.user;

    // Try to get workspace from URL params
    if (url.includes('workspaces')) {
      const workspaceId = this.extractEntityIdFromUrl(url);
      if (workspaceId) return workspaceId;
    }

    // Try to get from request body
    const bodyWorkspaceId = body?.workspaceId;
    if (typeof bodyWorkspaceId === 'string') return bodyWorkspaceId;

    // Try to get from response (for newly created entities)
    const respWorkspaceId = responseData?.workspaceId;
    if (typeof respWorkspaceId === 'string') return respWorkspaceId;

    const project = responseData?.project as
      | Record<string, unknown>
      | undefined;
    const projectWorkspaceId = project?.workspaceId;
    if (typeof projectWorkspaceId === 'string') return projectWorkspaceId;

    // Try to get from user's default workspace
    if (user?.id) {
      const defaultWorkspace = this.getUserDefaultWorkspace();
      if (defaultWorkspace) return defaultWorkspace;
    }

    return null;
  }

  private getUserDefaultWorkspace(): string | null {
    // This could be cached or use a user's primary workspace
    // For now, return null and let the audit log be skipped
    return null;
  }
}
