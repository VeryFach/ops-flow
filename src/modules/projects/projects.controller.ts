import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ProjectRoleGuard } from '../../common/guards/project-role.guard';
import { ProjectRoles } from '../../common/decorators/project-roles.decorator';
import { ProjectMemberRole } from '@prisma/client';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('projects')
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new project' })
    @ApiResponse({ status: 201, description: 'Project created successfully' })
    create(@GetUser('id') userId: string, @Body() dto: CreateProjectDto) {
        return this.projectsService.create(userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all projects for current user' })
    @ApiQuery({ name: 'workspaceId', required: false, description: 'Filter by workspace ID' })
    findAll(@GetUser('id') userId: string, @Query('workspaceId') workspaceId?: string) {
        return this.projectsService.findAll(userId, workspaceId);
    }

    @Get(':projectId')
    @ApiOperation({ summary: 'Get project by ID' })
    findOne(@Param('projectId') projectId: string, @GetUser('id') userId: string) {
        return this.projectsService.findOne(projectId, userId);
    }

    @Patch(':projectId')
    @ApiOperation({ summary: 'Update project' })
    @UseGuards(ProjectRoleGuard)
    @ProjectRoles(ProjectMemberRole.ADMIN)
    update(
        @Param('projectId') projectId: string,
        @GetUser('id') userId: string,
        @Body() dto: UpdateProjectDto,
    ) {
        return this.projectsService.update(projectId, userId, dto);
    }

    @Delete(':projectId')
    @ApiOperation({ summary: 'Delete project (soft delete)' })
    remove(@Param('projectId') projectId: string, @GetUser('id') userId: string) {
        return this.projectsService.remove(projectId, userId);
    }

    @Post(':projectId/members')
    @ApiOperation({ summary: 'Add member to project' })
    @UseGuards(ProjectRoleGuard)
    @ProjectRoles(ProjectMemberRole.ADMIN)
    addMember(
        @Param('projectId') projectId: string,
        @GetUser('id') userId: string,
        @Body() dto: AddProjectMemberDto,
    ) {
        return this.projectsService.addMember(projectId, userId, dto);
    }

    @Patch(':projectId/members/:memberId')
    @ApiOperation({ summary: 'Update member role in project' })
    @UseGuards(ProjectRoleGuard)
    @ProjectRoles(ProjectMemberRole.ADMIN)
    updateMemberRole(
        @Param('projectId') projectId: string,
        @GetUser('id') userId: string,
        @Param('memberId') memberId: string,
        @Body('role') role: ProjectMemberRole,
    ) {
        return this.projectsService.updateMemberRole(projectId, userId, memberId, role);
    }

    @Delete(':projectId/members/:memberId')
    @ApiOperation({ summary: 'Remove member from project' })
    @UseGuards(ProjectRoleGuard)
    @ProjectRoles(ProjectMemberRole.ADMIN)
    removeMember(
        @Param('projectId') projectId: string,
        @GetUser('id') userId: string,
        @Param('memberId') memberId: string,
    ) {
        return this.projectsService.removeMember(projectId, userId, memberId);
    }
}