import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { WorkspaceRoles } from '../../common/decorators/workspace-roles.decorator';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard';
import { WorkspacesService } from './workspaces.service';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('workspaces')
export class WorkspacesController {
    constructor(private readonly workspacesService: WorkspacesService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new workspace' })
    @ApiResponse({ status: 201, description: 'Workspace created successfully' })
    create(@GetUser('id') userId: string, @Body() dto: CreateWorkspaceDto) {
        return this.workspacesService.create(userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all workspaces for current user' })
    findAll(@GetUser('id') userId: string) {
        return this.workspacesService.findAll(userId);
    }

    @Get(':workspaceId')
    @ApiOperation({ summary: 'Get workspace by ID' })
    findOne(@Param('workspaceId') workspaceId: string, @GetUser('id') userId: string) {
        return this.workspacesService.findOne(workspaceId, userId);
    }

    @Patch(':workspaceId')
    @ApiOperation({ summary: 'Update workspace' })
    update(
        @Param('workspaceId') workspaceId: string,
        @GetUser('id') userId: string,
        @Body() dto: UpdateWorkspaceDto,
    ) {
        return this.workspacesService.update(workspaceId, userId, dto);
    }

    @Delete(':workspaceId')
    @ApiOperation({ summary: 'Delete workspace (soft delete)' })
    remove(@Param('workspaceId') workspaceId: string, @GetUser('id') userId: string) {
        return this.workspacesService.remove(workspaceId, userId);
    }

    @Post(':workspaceId/members')
    @ApiOperation({ summary: 'Add member to workspace' })
    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
    addMember(
        @Param('workspaceId') workspaceId: string,
        @GetUser('id') userId: string,
        @Body() dto: AddMemberDto,
    ) {
        return this.workspacesService.addMember(workspaceId, userId, dto);
    }

    @Patch(':workspaceId/members/:memberId')
    @ApiOperation({ summary: 'Update member role' })
    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceMemberRole.OWNER)
    updateMemberRole(
        @Param('workspaceId') workspaceId: string,
        @GetUser('id') userId: string,
        @Param('memberId') memberId: string,
        @Body('role') role: WorkspaceMemberRole,
    ) {
        return this.workspacesService.updateMemberRole(workspaceId, userId, memberId, role);
    }

    @Delete(':workspaceId/members/:memberId')
    @ApiOperation({ summary: 'Remove member from workspace' })
    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
    removeMember(
        @Param('workspaceId') workspaceId: string,
        @GetUser('id') userId: string,
        @Param('memberId') memberId: string,
    ) {
        return this.workspacesService.removeMember(workspaceId, userId, memberId);
    }
}