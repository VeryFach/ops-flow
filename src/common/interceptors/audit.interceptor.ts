import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';
import { AuditAction } from '@prisma/client';
import type { Request } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(
        private auditService: AuditService,
        private reflector: Reflector,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const skipAudit = this.reflector.getAllAndOverride<boolean>(
            SKIP_AUDIT_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (skipAudit) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest<Request>();
        const user = (request as any).user;
        const method = request.method;
        const url = request.url;
        const body = request.body;
        const oldBody = (request as any).oldBody; // For update operations

        // Determine action based on HTTP method
        let action: AuditAction | null = null;
        let entity = this.extractEntityFromUrl(url);
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
                next: async (responseData) => {
                    // For POST requests, try to get the created entity ID from response
                    if (method === 'POST' && responseData && responseData.id) {
                        entityId = responseData.id;
                    }

                    const auditData = {
                        action,
                        entity,
                        entityId: entityId || null,
                        userId: user?.id || null,
                        workspaceId: await this.extractWorkspaceId(request, responseData),
                        oldValue: method !== 'POST' ? oldBody || body : null,
                        newValue: method !== 'DELETE' ? body || responseData : null,
                        ipAddress: request.ip || request.socket.remoteAddress,
                        userAgent: request.headers['user-agent'],
                    };

                    // Only log if we have workspace context
                    if (auditData.workspaceId) {
                        await this.auditService.log(auditData);
                    }

                    const duration = Date.now() - startTime;
                    console.log(`[AUDIT] ${action} ${entity} ${entityId} - ${duration}ms`);
                },
                error: async (error) => {
                    console.error(`[AUDIT ERROR] ${action} ${entity}:`, error.message);
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
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }

    private async extractWorkspaceId(request: Request, responseData: any): Promise<string | null> {
        const url = request.url;
        const body = request.body;
        const user = (request as any).user;

        // Try to get workspace from URL params
        if (url.includes('workspaces')) {
            const workspaceId = this.extractEntityIdFromUrl(url);
            if (workspaceId) return workspaceId;
        }

        // Try to get from request body
        if (body?.workspaceId) return body.workspaceId;

        // Try to get from response (for newly created entities)
        if (responseData?.workspaceId) return responseData.workspaceId;
        if (responseData?.project?.workspaceId) return responseData.project.workspaceId;

        // Try to get from user's default workspace
        if (user?.id) {
            const defaultWorkspace = await this.getUserDefaultWorkspace(user.id);
            if (defaultWorkspace) return defaultWorkspace;
        }

        return null;
    }

    private async getUserDefaultWorkspace(userId: string): Promise<string | null> {
        // This could be cached or use a user's primary workspace
        // For now, return null and let the audit log be skipped
        return null;
    }
}