import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
  ) {}

  /** List all users with their roles. */
  async listAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Change a user's role. Returns the updated user. */
  async updateUserRole(
    targetUserId: string,
    newRole: UserRole,
    adminUserId: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!target) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const oldRole = target.role;

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Persist audit entry via AuditLogService
    await this.auditLogService.logAction({
      action: 'UPDATE',
      entity: 'User',
      entityId: targetUserId,
      userId: adminUserId,
      oldValue: { role: oldRole },
      newValue: { role: newRole },
    });

    return updated;
  }

  /** Fetch all audit logs ordered by createdAt desc, including related user. */
  async getAllAuditLogs() {
    return this.auditLogService.getAllLogs();
  }

  /** Fetch all deployments with status FAILED. */
  async getFailedDeployments() {
    return this.prisma.deployment.findMany({
      where: { status: 'FAILED' },
      include: {
        project: {
          select: { id: true, name: true, workspaceId: true },
        },
        deployedBy: {
          select: { id: true, name: true, email: true },
        },
        tasks: {
          include: {
            task: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
