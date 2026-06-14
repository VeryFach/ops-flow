import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { WorkspaceMemberRole } from '@prisma/client';

@Injectable()
export class WorkspacesService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, dto: CreateWorkspaceDto) {
        // Check if slug is unique
        const existingWorkspace = await this.prisma.workspace.findUnique({
            where: { slug: dto.slug },
        });

        if (existingWorkspace) {
            throw new ConflictException('Workspace slug already exists');
        }

        // Create workspace and add owner as member in transaction
        const workspace = await this.prisma.$transaction(async (prisma) => {
            const newWorkspace = await prisma.workspace.create({
                data: {
                    name: dto.name,
                    slug: dto.slug,
                    ownerId: userId,
                },
            });

            await prisma.workspaceMember.create({
                data: {
                    workspaceId: newWorkspace.id,
                    userId: userId,
                    role: WorkspaceMemberRole.OWNER,
                },
            });

            return newWorkspace;
        });

        return workspace;
    }

    async findAll(userId: string) {
        const workspaces = await this.prisma.workspace.findMany({
            where: {
                members: {
                    some: {
                        userId: userId,
                    },
                },
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return workspaces;
    }

    async findOne(workspaceId: string, userId: string) {
        const workspace = await this.prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                members: {
                    some: {
                        userId: userId,
                    },
                },
            },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                projects: {
                    where: { deletedAt: null },
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!workspace) {
            throw new NotFoundException('Workspace not found or you dont have access');
        }

        return workspace;
    }

    async update(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
        // Check if user is owner or admin
        const member = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!member || (member.role !== WorkspaceMemberRole.OWNER && member.role !== WorkspaceMemberRole.ADMIN)) {
            throw new ForbiddenException('Only workspace owner or admin can update workspace');
        }

        // Check slug uniqueness if updating slug
        if (dto.slug) {
            const existingWorkspace = await this.prisma.workspace.findFirst({
                where: {
                    slug: dto.slug,
                    id: { not: workspaceId },
                },
            });

            if (existingWorkspace) {
                throw new ConflictException('Workspace slug already exists');
            }
        }

        const workspace = await this.prisma.workspace.update({
            where: { id: workspaceId },
            data: dto,
        });

        return workspace;
    }

    async remove(workspaceId: string, userId: string) {
        // Check if user is owner
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            throw new NotFoundException('Workspace not found');
        }

        if (workspace.ownerId !== userId) {
            throw new ForbiddenException('Only workspace owner can delete workspace');
        }

        // Soft delete
        await this.prisma.workspace.update({
            where: { id: workspaceId },
            data: { deletedAt: new Date() },
        });

        return { message: 'Workspace deleted successfully' };
    }

    async addMember(workspaceId: string, userId: string, dto: AddMemberDto) {
        // Check if requester is owner or admin
        const requester = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!requester || (requester.role !== WorkspaceMemberRole.OWNER && requester.role !== WorkspaceMemberRole.ADMIN)) {
            throw new ForbiddenException('Only workspace owner or admin can add members');
        }

        // Check if user exists
        const userToAdd = await this.prisma.user.findUnique({
            where: { id: dto.userId },
        });

        if (!userToAdd) {
            throw new NotFoundException('User not found');
        }

        // Check if already a member
        const existingMember = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: dto.userId,
                },
            },
        });

        if (existingMember) {
            throw new ConflictException('User is already a member of this workspace');
        }

        const member = await this.prisma.workspaceMember.create({
            data: {
                workspaceId,
                userId: dto.userId,
                role: dto.role,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return member;
    }

    async updateMemberRole(workspaceId: string, userId: string, memberId: string, role: WorkspaceMemberRole) {
        // Check if requester is owner
        const requester = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!requester || requester.role !== WorkspaceMemberRole.OWNER) {
            throw new ForbiddenException('Only workspace owner can update member roles');
        }

        // Cannot change owner's role
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (workspace?.ownerId === memberId) {
            throw new ForbiddenException('Cannot change workspace owner role');
        }

        const member = await this.prisma.workspaceMember.update({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: memberId,
                },
            },
            data: { role },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        return member;
    }

    async removeMember(workspaceId: string, userId: string, memberId: string) {
        // Check if requester is owner or admin
        const requester = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });

        if (!requester || (requester.role !== WorkspaceMemberRole.OWNER && requester.role !== WorkspaceMemberRole.ADMIN)) {
            throw new ForbiddenException('Only workspace owner or admin can remove members');
        }

        // Cannot remove owner
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (workspace?.ownerId === memberId) {
            throw new ForbiddenException('Cannot remove workspace owner');
        }

        // Cannot remove self if not owner
        if (memberId === userId && requester.role !== WorkspaceMemberRole.OWNER) {
            throw new ForbiddenException('Only workspace owner can remove themselves');
        }

        await this.prisma.workspaceMember.delete({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId: memberId,
                },
            },
        });

        return { message: 'Member removed successfully' };
    }
}