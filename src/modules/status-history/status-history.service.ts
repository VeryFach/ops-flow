import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusHistoryQueryDto } from './dto/status-history-query.dto';
import { TaskStatus } from '@prisma/client';

// ✅ Export interface ini
export interface HistoryItem {
    id: string;
    taskId: string;
    changedById: string;
    fromStatus: TaskStatus;
    toStatus: TaskStatus;
    changedAt: Date;
    durationInStatus?: string | null;
    durationInStatusMs?: number | null;
    changedBy?: {
        id: string;
        name: string;
        email: string;
    };
    task?: {
        id: string;
        title: string;
        projectId: string;
        project: {
            id: string;
            name: string;
        };
    };
}

// Define return type for findByTaskId
export interface FindByTaskIdResult {
    data: HistoryItem[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        taskId: string;
    };
}

@Injectable()
export class StatusHistoryService {
    constructor(private prisma: PrismaService) { }

    /**
     * Get status history for a specific task
     * User must have access to the task
     */
    async findByTaskId(taskId: string, userId: string, query: StatusHistoryQueryDto): Promise<FindByTaskIdResult> {
        // Check if user has access to this task
        const hasAccess = await this.checkTaskAccess(taskId, userId);
        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this task');
        }

        const { fromStatus, toStatus, changedById, page, limit } = query;
        const skip = (page - 1) * limit;

        const whereCondition: any = { taskId };

        if (fromStatus) whereCondition.fromStatus = fromStatus;
        if (toStatus) whereCondition.toStatus = toStatus;
        if (changedById) whereCondition.changedById = changedById;

        const [history, total] = await Promise.all([
            this.prisma.taskStatusHistory.findMany({
                where: whereCondition,
                include: {
                    changedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { changedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.taskStatusHistory.count({ where: whereCondition }),
        ]);

        // Calculate time spent in each status
        const historyWithDuration = this.calculateDurationBetweenStatuses(history as any[]);

        return {
            data: historyWithDuration,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                taskId,
            },
        };
    }

    /**
     * Get all status changes made by a specific user
     */
    async findByUser(userId: string, targetUserId: string, query: StatusHistoryQueryDto) {
        // Check if user has permission to view this
        const hasPermission = await this.checkViewPermission(userId, targetUserId);
        if (!hasPermission) {
            throw new ForbiddenException('You do not have permission to view this user\'s activity');
        }

        const { fromStatus, toStatus, page, limit } = query;
        const skip = (page - 1) * limit;

        const whereCondition: any = { changedById: targetUserId };

        if (fromStatus) whereCondition.fromStatus = fromStatus;
        if (toStatus) whereCondition.toStatus = toStatus;

        const [history, total] = await Promise.all([
            this.prisma.taskStatusHistory.findMany({
                where: whereCondition,
                include: {
                    task: {
                        select: {
                            id: true,
                            title: true,
                            projectId: true,
                            project: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    changedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: { changedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.taskStatusHistory.count({ where: whereCondition }),
        ]);

        return {
            data: history,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                userId: targetUserId,
            },
        };
    }

    /**
     * Get status change summary for a task (statistics)
     */
    async getTaskSummary(taskId: string, userId: string) {
        // Check if user has access to this task
        const hasAccess = await this.checkTaskAccess(taskId, userId);
        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this task');
        }

        const history = await this.prisma.taskStatusHistory.findMany({
            where: { taskId },
            orderBy: { changedAt: 'asc' },
        });

        if (history.length === 0) {
            return {
                taskId,
                totalChanges: 0,
                message: 'No status changes recorded yet',
            };
        }

        // Calculate statistics
        const firstChange = history[0];
        const lastChange = history[history.length - 1];

        // Count transitions
        const transitions: Record<string, number> = {};
        for (const change of history) {
            const key = `${change.fromStatus} → ${change.toStatus}`;
            transitions[key] = (transitions[key] || 0) + 1;
        }

        // Calculate average time in each status
        const statusDurations: Record<string, number[]> = {};
        for (let i = 0; i < history.length; i++) {
            const change = history[i];
            const nextChange = history[i + 1];

            if (nextChange) {
                const duration = nextChange.changedAt.getTime() - change.changedAt.getTime();
                const status = change.toStatus;
                if (!statusDurations[status]) statusDurations[status] = [];
                statusDurations[status].push(duration);
            }
        }

        const averageDurations: Record<string, string> = {};
        for (const [status, durations] of Object.entries(statusDurations)) {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            averageDurations[status] = this.formatDuration(avg);
        }

        return {
            taskId,
            totalChanges: history.length,
            firstChangeAt: firstChange.changedAt,
            lastChangeAt: lastChange.changedAt,
            transitions,
            averageTimeInStatus: averageDurations,
            timeline: history.map(h => ({
                fromStatus: h.fromStatus,
                toStatus: h.toStatus,
                changedAt: h.changedAt,
                changedBy: h.changedById,
            })),
        };
    }

    /**
     * Get workspace-wide status change activity
     */
    async getWorkspaceActivity(workspaceId: string, userId: string, limit: number = 50) {
        // Check if user is member of workspace
        const isMember = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!isMember) {
            throw new ForbiddenException('You do not have access to this workspace');
        }

        const activity = await this.prisma.taskStatusHistory.findMany({
            where: {
                task: {
                    project: {
                        workspaceId,
                    },
                },
            },
            include: {
                task: {
                    select: {
                        id: true,
                        title: true,
                        project: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                changedBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: { changedAt: 'desc' },
            take: limit,
        });

        // Group by date
        const activityByDate: Record<string, typeof activity> = {};
        for (const item of activity) {
            const date = item.changedAt.toISOString().split('T')[0];
            if (!activityByDate[date]) activityByDate[date] = [];
            activityByDate[date].push(item);
        }

        return {
            workspaceId,
            totalRecentChanges: activity.length,
            activityByDate,
            recentChanges: activity,
        };
    }

    /**
     * Check if user has access to a task
     */
    private async checkTaskAccess(taskId: string, userId: string): Promise<boolean> {
        const task = await this.prisma.task.findFirst({
            where: {
                id: taskId,
                OR: [
                    {
                        assignees: {
                            some: { userId },
                        },
                    },
                    {
                        project: {
                            projectMembers: {
                                some: { userId },
                            },
                        },
                    },
                ],
            },
        });

        return !!task;
    }

    /**
     * Check if user can view another user's activity
     */
    private async checkViewPermission(viewerId: string, targetId: string): Promise<boolean> {
        // User can view their own activity
        if (viewerId === targetId) return true;

        // Check if they are in the same workspace
        const commonWorkspace = await this.prisma.workspaceMember.findFirst({
            where: {
                userId: viewerId,
                workspace: {
                    members: {
                        some: { userId: targetId },
                    },
                },
            },
        });

        return !!commonWorkspace;
    }

    /**
     * Calculate duration between status changes
     */
    private calculateDurationBetweenStatuses(history: any[]): HistoryItem[] {
        const result: HistoryItem[] = [];

        for (let i = 0; i < history.length; i++) {
            const current = history[i];
            const next = history[i - 1]; // Next in descending order is actually previous in time

            let durationInStatusMs: number | null = null;
            if (next) {
                durationInStatusMs = current.changedAt.getTime() - next.changedAt.getTime();
            }

            const historyItem: HistoryItem = {
                id: current.id,
                taskId: current.taskId,
                changedById: current.changedById,
                fromStatus: current.fromStatus,
                toStatus: current.toStatus,
                changedAt: current.changedAt,
                changedBy: current.changedBy,
                durationInStatus: durationInStatusMs ? this.formatDuration(durationInStatusMs) : null,
                durationInStatusMs: durationInStatusMs,
            };

            result.push(historyItem);
        }

        return result;
    }

    /**
     * Format milliseconds to human readable string
     */
    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }
}