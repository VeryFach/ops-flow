import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, Prisma } from '@prisma/client';

export interface LogActionParams {
  action: AuditAction;
  entity: string;
  entityId: string;
  userId: string;
  workspaceId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Reusable function to store an audit log entry.
   * Persists workspaceId, userId, action, entity, oldValue, and newValue via Prisma.
   */
  async logAction(params: LogActionParams) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          userId: params.userId,
          workspaceId: params.workspaceId ?? null,
          oldValue:
            params.oldValue == null
              ? Prisma.DbNull
              : (params.oldValue as Prisma.InputJsonValue),
          newValue:
            params.newValue == null
              ? Prisma.DbNull
              : (params.newValue as Prisma.InputJsonValue),
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    } catch (error) {
      console.error('[AUDIT_LOG] Failed to persist audit entry:', error);
      return null;
    }
  }

  /** Fetch all audit logs, newest first, with related user data. */
  async getAllLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }
}
