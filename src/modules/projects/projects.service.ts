import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ProjectMemberRole, WorkspaceMemberRole } from '@prisma/client';

// Define interface for where condition
interface ProjectWhereCondition {
    workspaceId?: string;
    projectMembers?: {
        some: {
            userId: string;
        };
    };
}

@Injectable()
export class ProjectsService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, dto: CreateProjectDto) {
        // Check if user has access to workspace
        const workspaceMember = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: dto.workspaceId,
                    userId: userId,
                },
            },
        });

        if (!workspaceMember) {
            throw new ForbiddenException('You do not have access to this workspace');
        }

        // Create project and add creator as admin in transaction
        const project = await this.prisma.$transaction(async (prisma) => {
            const newProject = await prisma.project.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    workspaceId: dto.workspaceId,
                    createdById: userId,
                },
            });

            await prisma.projectMember.create({
                data: {
                    projectId: newProject.id,
                    userId: userId,
                    role: ProjectMemberRole.ADMIN,
                },
            });

            return newProject;
        });

        return project;
    }

    async findAll(userId: string, workspaceId?: string) {
        const whereCondition: ProjectWhereCondition = {
            projectMembers: {
                some: {
                    userId: userId,
                },
            },
        };

        if (workspaceId) {
            whereCondition.workspaceId = workspaceId;
        }

        const projects = await this.prisma.project.findMany({
            where: whereCondition as any,
            include: {
                createdBy: {
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
                projectMembers: {
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
                _count: {
                    select: {
                        tasks: true,
                        deployments: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return projects;
    }

    async findOne(projectId: string, userId: string) {
        const project = await this.prisma.project.findFirst({
            where: {
                id: projectId,
                projectMembers: {
                    some: {
                        userId: userId,
                    },
                },
            },
            include: {
                createdBy: {
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
                projectMembers: {
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
                tasks: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                deployments: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                },
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found or you do not have access');
        }

        return project;
    }

    async update(projectId: string, userId: string, dto: UpdateProjectDto) {
        // Check if user is admin of the project
        const member = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        if (!member || member.role !== ProjectMemberRole.ADMIN) {
            throw new ForbiddenException('Only project admin can update project');
        }

        const project = await this.prisma.project.update({
            where: { id: projectId },
            data: dto,
        });

        return project;
    }

    async remove(projectId: string, userId: string) {
        // Check if user is project admin or workspace owner/admin
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                workspace: true,
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        // Check workspace role
        const workspaceMember = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: project.workspaceId!,
                    userId,
                },
            },
        });

        // Check project role
        const projectMember = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        const isWorkspaceOwnerOrAdmin = workspaceMember &&
            (workspaceMember.role === WorkspaceMemberRole.OWNER || workspaceMember.role === WorkspaceMemberRole.ADMIN);
        const isProjectAdmin = projectMember && projectMember.role === ProjectMemberRole.ADMIN;

        if (!isWorkspaceOwnerOrAdmin && !isProjectAdmin) {
            throw new ForbiddenException('Only workspace admin or project admin can delete project');
        }

        // Soft delete
        await this.prisma.project.update({
            where: { id: projectId },
            data: { deletedAt: new Date() },
        });

        return { message: 'Project deleted successfully' };
    }

    async addMember(projectId: string, userId: string, dto: AddProjectMemberDto) {
        // Check if requester is project admin
        const requester = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        if (!requester || requester.role !== ProjectMemberRole.ADMIN) {
            throw new ForbiddenException('Only project admin can add members');
        }

        // Check if user exists
        const userToAdd = await this.prisma.user.findUnique({
            where: { id: dto.userId },
        });

        if (!userToAdd) {
            throw new NotFoundException('User not found');
        }

        // Check if user has access to workspace
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            select: { workspaceId: true },
        });

        if (!project || !project.workspaceId) {
            throw new NotFoundException('Project workspace not found');
        }

        const workspaceMember = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: project.workspaceId,
                    userId: dto.userId,
                },
            },
        });

        if (!workspaceMember) {
            throw new ForbiddenException('User must be a workspace member first');
        }

        // Check if already a member
        const existingMember = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: dto.userId,
                },
            },
        });

        if (existingMember) {
            throw new ConflictException('User is already a member of this project');
        }

        const member = await this.prisma.projectMember.create({
            data: {
                projectId,
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

    async updateMemberRole(projectId: string, userId: string, memberId: string, role: ProjectMemberRole) {
        // Check if requester is project admin
        const requester = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        if (!requester || requester.role !== ProjectMemberRole.ADMIN) {
            throw new ForbiddenException('Only project admin can update member roles');
        }

        // Cannot change admin's role if they are the only admin
        const targetMember = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: memberId,
                },
            },
        });

        if (!targetMember) {
            throw new NotFoundException('Member not found');
        }

        // Prevent removing last admin
        if (targetMember.role === ProjectMemberRole.ADMIN && role !== ProjectMemberRole.ADMIN) {
            const adminCount = await this.prisma.projectMember.count({
                where: {
                    projectId,
                    role: ProjectMemberRole.ADMIN,
                },
            });

            if (adminCount <= 1) {
                throw new ForbiddenException('Cannot remove the last admin of the project');
            }
        }

        const member = await this.prisma.projectMember.update({
            where: {
                projectId_userId: {
                    projectId,
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

    async removeMember(projectId: string, userId: string, memberId: string) {
        // Check if requester is project admin
        const requester = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId,
                },
            },
        });

        if (!requester || requester.role !== ProjectMemberRole.ADMIN) {
            throw new ForbiddenException('Only project admin can remove members');
        }

        // Cannot remove last admin
        const targetMember = await this.prisma.projectMember.findUnique({
            where: {
                projectId_userId: {
                    projectId,
                    userId: memberId,
                },
            },
        });

        if (!targetMember) {
            throw new NotFoundException('Member not found');
        }

        if (targetMember.role === ProjectMemberRole.ADMIN) {
            const adminCount = await this.prisma.projectMember.count({
                where: {
                    projectId,
                    role: ProjectMemberRole.ADMIN,
                },
            });

            if (adminCount <= 1) {
                throw new ForbiddenException('Cannot remove the last admin of the project');
            }
        }

        await this.prisma.projectMember.delete({
            where: {
                projectId_userId: {
                    projectId,
                    userId: memberId,
                },
            },
        });

        return { message: 'Member removed successfully' };
    }
}