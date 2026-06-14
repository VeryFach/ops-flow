import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EditUserDto } from './dto/edit-user.dto.js';
import { TaskQueryDto } from './dto/task-query.dto.js';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async getMe(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Remove hash before returning
        const { password, ...userWithoutHash } = user;
        return userWithoutHash;
    }

    async editUser(userId: string, dto: EditUserDto) {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { ...dto },
        });

        // Remove hash before returning
        const { password, ...userWithoutHash } = user;
        return userWithoutHash;
    }

    async getUserWorkspaces(userId: string) {
        const memberships = await this.prisma.workspaceMember.findMany({
            where: { userId },
            include: {
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        ownerId: true,
                    }
                }
            }
        });

        return memberships.map(m => ({
            ...m.workspace,
            role: m.role,
            joinedAt: m.createdAt
        }));
    }

    async getUserProjects(userId: string) {
        // Project where user is member OR created by user
        const projectMemberships = await this.prisma.projectMember.findMany({
            where: { userId },
            include: { project: true }
        });

        const createdProjects = await this.prisma.project.findMany({
            where: { createdById: userId }
        });

        return {
            memberOf: projectMemberships.map(m => m.project),
            created: createdProjects
        };
    }

    async getUserTasks(userId: string, query?: TaskQueryDto) {
        const whereCondition: any = { userId };

        // Optional: filter by status if provided
        if (query?.status) {
            whereCondition.task = {
                status: query.status as any
            };
        }

        const assignments = await this.prisma.taskAssignee.findMany({
            where: whereCondition,
            include: {
                task: {
                    include: {
                        project: true
                    }
                }
            }
        });

        return assignments.map(a => ({
            ...a.task,
            assignedAt: a.assignedAt
        }));
    }

    async getUserRoleInWorkspace(userId: string, workspaceId: string) {
        const member = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId
                }
            }
        });

        if (!member) {
            throw new NotFoundException('User is not a member of this workspace');
        }

        return { role: member.role };
    }

    async getUserDeployments(userId: string) {
        const deployments = await this.prisma.deployment.findMany({
            where: { deployedById: userId },
            include: {
                project: true,
                tasks: {
                    include: { task: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return deployments;
    }
}