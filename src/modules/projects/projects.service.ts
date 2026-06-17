import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { ProjectMemberRole, WorkspaceMemberRole, Prisma } from '@prisma/client';
import type { CurrentUser } from '../../common/interfaces/current-user.interface';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(currentUser: CurrentUser, dto: CreateProjectDto) {
    // Check if user has access to workspace
    const workspaceMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: dto.workspaceId,
          userId: currentUser.id,
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
          createdById: currentUser.id,
        },
      });

      await prisma.projectMember.create({
        data: {
          projectId: newProject.id,
          userId: currentUser.id,
          role: ProjectMemberRole.ADMIN,
        },
      });

      return newProject;
    });

    return project;
  }

  async findAll(currentUser: CurrentUser, workspaceId?: string) {
    // SUPER_ADMIN: global access — return all projects
    if (currentUser.role === 'SUPER_ADMIN') {
      return this.prisma.project.findMany({
        ...(workspaceId ? { where: { workspaceId } } : {}),
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          workspace: {
            select: { id: true, name: true, slug: true },
          },
          projectMembers: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: { tasks: true, deployments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // USER: scoped to own memberships
    const whereCondition: Prisma.ProjectWhereInput = {
      projectMembers: {
        some: { userId: currentUser.id },
      },
      ...(workspaceId ? { workspaceId } : {}),
    };

    return this.prisma.project.findMany({
      where: whereCondition,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        workspace: {
          select: { id: true, name: true, slug: true },
        },
        projectMembers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { tasks: true, deployments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(projectId: string, currentUser: CurrentUser) {
    const includeClause = {
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      workspace: {
        select: { id: true, name: true, slug: true },
      },
      projectMembers: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      tasks: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' } as const,
        take: 20,
      },
      deployments: {
        orderBy: { createdAt: 'desc' } as const,
        take: 10,
      },
    };

    // SUPER_ADMIN: global access — find by ID only
    if (currentUser.role === 'SUPER_ADMIN') {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: includeClause,
      });

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      return project;
    }

    // USER: must be a member
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        projectMembers: {
          some: { userId: currentUser.id },
        },
      },
      include: includeClause,
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found or you do not have access',
      );
    }

    return project;
  }

  async update(
    projectId: string,
    currentUser: CurrentUser,
    dto: UpdateProjectDto,
  ) {
    // Check if user is admin of the project
    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUser.id,
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

  async remove(projectId: string, currentUser: CurrentUser) {
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
          userId: currentUser.id,
        },
      },
    });

    // Check project role
    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUser.id,
        },
      },
    });

    const isWorkspaceOwnerOrAdmin =
      workspaceMember &&
      (workspaceMember.role === WorkspaceMemberRole.OWNER ||
        workspaceMember.role === WorkspaceMemberRole.ADMIN);
    const isProjectAdmin =
      projectMember && projectMember.role === ProjectMemberRole.ADMIN;

    if (!isWorkspaceOwnerOrAdmin && !isProjectAdmin) {
      throw new ForbiddenException(
        'Only workspace admin or project admin can delete project',
      );
    }

    // Soft delete
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Project deleted successfully' };
  }

  async addMember(
    projectId: string,
    currentUser: CurrentUser,
    dto: AddProjectMemberDto,
  ) {
    // Check if requester is project admin
    const requester = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUser.id,
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

  async updateMemberRole(
    projectId: string,
    currentUser: CurrentUser,
    memberId: string,
    role: ProjectMemberRole,
  ) {
    // Check if requester is project admin
    const requester = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUser.id,
        },
      },
    });

    if (!requester || requester.role !== ProjectMemberRole.ADMIN) {
      throw new ForbiddenException(
        'Only project admin can update member roles',
      );
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
    if (
      targetMember.role === ProjectMemberRole.ADMIN &&
      role !== ProjectMemberRole.ADMIN
    ) {
      const adminCount = await this.prisma.projectMember.count({
        where: {
          projectId,
          role: ProjectMemberRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        throw new ForbiddenException(
          'Cannot remove the last admin of the project',
        );
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

  async removeMember(
    projectId: string,
    currentUser: CurrentUser,
    memberId: string,
  ) {
    // Check if requester is project admin
    const requester = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: currentUser.id,
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
        throw new ForbiddenException(
          'Cannot remove the last admin of the project',
        );
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
