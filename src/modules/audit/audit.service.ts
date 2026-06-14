import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditAction } from '@prisma/client';

interface AuditLogData {
    action: AuditAction;
    entity: string;
    entityId: string | null;
    userId: string | null;
    workspaceId: string | null;
    oldValue: any;
    newValue: any;
    ipAddress?: string;
    userAgent?: string;
}

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(data: AuditLogData) {
        try {
            // Skip if no workspace context
            if (!data.workspaceId) {
                console.log('[AUDIT] Skipped - no workspace context');
                return null;
            }

            // Clean sensitive data before storing
            const cleanedOldValue = this.cleanSensitiveData(data.oldValue);
            const cleanedNewValue = this.cleanSensitiveData(data.newValue);

            const auditLog = await this.prisma.auditLog.create({
                data: {
                    action: data.action,
                    entity: data.entity,
                    entityId: data.entityId || 'unknown',
                    userId: data.userId,
                    workspaceId: data.workspaceId,
                    oldValue: cleanedOldValue,
                    newValue: cleanedNewValue,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            });

            return auditLog;
        } catch (error) {
            console.error('[AUDIT] Failed to create audit log:', error);
            return null;
        }
    }

    async findAll(query: AuditQueryDto, userId: string, userRole: string) {
        const { action, workspaceId, userId: targetUserId, entity, entityId, page, limit } = query;

        const whereCondition: any = {};

        // Super admin can see all, others only see their workspace
        if (userRole !== 'SUPER_ADMIN') {
            const userWorkspaces = await this.prisma.workspaceMember.findMany({
                where: { userId },
                select: { workspaceId: true },
            });
            const workspaceIds = userWorkspaces.map(w => w.workspaceId);
            whereCondition.workspaceId = { in: workspaceIds };
        }

        if (action) whereCondition.action = action;
        if (workspaceId) whereCondition.workspaceId = workspaceId;
        if (targetUserId) whereCondition.userId = targetUserId;
        if (entity) whereCondition.entity = entity;
        if (entityId) whereCondition.entityId = entityId;

        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where: whereCondition,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    workspace: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.auditLog.count({ where: whereCondition }),
        ]);

        return {
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async findByEntity(entity: string, entityId: string, userId: string, userRole: string) {
        const whereCondition: any = { entity, entityId };

        if (userRole !== 'SUPER_ADMIN') {
            const userWorkspaces = await this.prisma.workspaceMember.findMany({
                where: { userId },
                select: { workspaceId: true },
            });
            const workspaceIds = userWorkspaces.map(w => w.workspaceId);
            whereCondition.workspaceId = { in: workspaceIds };
        }

        const logs = await this.prisma.auditLog.findMany({
            where: whereCondition,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return logs;
    }

    async findByUser(userId: string, targetUserId: string, userRole: string) {
        const whereCondition: any = { userId: targetUserId };

        if (userRole !== 'SUPER_ADMIN') {
            const userWorkspaces = await this.prisma.workspaceMember.findMany({
                where: { userId },
                select: { workspaceId: true },
            });
            const workspaceIds = userWorkspaces.map(w => w.workspaceId);
            whereCondition.workspaceId = { in: workspaceIds };
        }

        const logs = await this.prisma.auditLog.findMany({
            where: whereCondition,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return logs;
    }

    async getActivitySummary(workspaceId: string, userId: string, userRole: string) {
        // Check access
        if (userRole !== 'SUPER_ADMIN') {
            const isMember = await this.prisma.workspaceMember.findUnique({
                where: {
                    workspaceId_userId: {
                        workspaceId,
                        userId,
                    },
                },
            });
            if (!isMember) {
                throw new Error('Access denied to this workspace');
            }
        }

        const [byAction, byEntity, recentActivity] = await Promise.all([
            // Count by action
            this.prisma.auditLog.groupBy({
                by: ['action'],
                where: { workspaceId },
                _count: true,
            }),

            // Count by entity
            this.prisma.auditLog.groupBy({
                by: ['entity'],
                where: { workspaceId },
                _count: true,
                orderBy: { _count: { entity: 'desc' } },
                take: 5,
            }),

            // Recent activity
            this.prisma.auditLog.findMany({
                where: { workspaceId },
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);

        return {
            summary: {
                totalActions: byAction.reduce((sum, item) => sum + item._count, 0),
                byAction: byAction.map(item => ({
                    action: item.action,
                    count: item._count,
                })),
                topEntities: byEntity.map(item => ({
                    entity: item.entity,
                    count: item._count,
                })),
            },
            recentActivity,
        };
    }

    private cleanSensitiveData(data: any): any {
        if (!data) return null;

        // Don't store sensitive information
        const sensitiveFields = ['password', 'passwordHash', 'token', 'refreshToken', 'secret'];

        if (typeof data === 'object') {
            const cleaned = { ...data };
            for (const field of sensitiveFields) {
                if (cleaned[field]) {
                    cleaned[field] = '[REDACTED]';
                }
            }
            return cleaned;
        }

        return data;
    }
}