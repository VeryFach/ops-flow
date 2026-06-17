import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { WorkspaceRoles } from '../../common/decorators/workspace-roles.decorator';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard';
import { WorkspacesService } from './workspaces.service';
import type { AuthUser } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  create(@GetUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.create({ id: user.id, role: user.role }, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workspaces for current user' })
  findAll(@GetUser() user: AuthUser) {
    return this.workspacesService.findAll({
      id: user.id,
      role: user.role,
    });
  }

  @Get(':workspaceId')
  @ApiOperation({ summary: 'Get workspace by ID' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @GetUser() user: AuthUser,
  ) {
    return this.workspacesService.findOne(workspaceId, {
      id: user.id,
      role: user.role,
    });
  }

  @Patch(':workspaceId')
  @ApiOperation({ summary: 'Update workspace' })
  update(
    @Param('workspaceId') workspaceId: string,
    @GetUser() user: AuthUser,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(
      workspaceId,
      {
        id: user.id,
        role: user.role,
      },
      dto,
    );
  }

  @Delete(':workspaceId')
  @ApiOperation({ summary: 'Delete workspace (soft delete)' })
  remove(@Param('workspaceId') workspaceId: string, @GetUser() user: AuthUser) {
    return this.workspacesService.remove(workspaceId, {
      id: user.id,
      role: user.role,
    });
  }

  @Post(':workspaceId/members')
  @ApiOperation({ summary: 'Add member to workspace' })
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  addMember(
    @Param('workspaceId') workspaceId: string,
    @GetUser() user: AuthUser,
    @Body() dto: AddMemberDto,
  ) {
    return this.workspacesService.addMember(
      workspaceId,
      {
        id: user.id,
        role: user.role,
      },
      dto,
    );
  }

  @Patch(':workspaceId/members/:memberId')
  @ApiOperation({ summary: 'Update member role' })
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceMemberRole.OWNER)
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @GetUser() user: AuthUser,
    @Param('memberId') memberId: string,
    @Body('role') role: WorkspaceMemberRole,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      { id: user.id, role: user.role },
      memberId,
      role,
    );
  }

  @Delete(':workspaceId/members/:memberId')
  @ApiOperation({ summary: 'Remove member from workspace' })
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN)
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @GetUser() user: AuthUser,
    @Param('memberId') memberId: string,
  ) {
    return this.workspacesService.removeMember(
      workspaceId,
      {
        id: user.id,
        role: user.role,
      },
      memberId,
    );
  }
}
