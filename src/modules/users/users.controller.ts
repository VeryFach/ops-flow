import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { EditUserDto } from './dto/edit-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import type { AuthUser } from '../../common/interfaces/authenticated-request.interface';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the profile of the currently authenticated user. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the current user profile',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  getMe(@GetUser() user: AuthUser) {
    return this.usersService.getMe({ id: user.id, role: user.role });
  }

  @Patch()
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      "Updates the authenticated user's own profile (name or email). " +
      'A regular USER can only edit their own profile. ' +
      "A SUPER_ADMIN can edit any user's profile. " +
      'Changes are recorded in the audit log.',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden — a regular USER can only edit their own profile. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  editUser(@GetUser() user: AuthUser, @Body() dto: EditUserDto) {
    return this.usersService.editUser(
      { id: user.id, role: user.role },
      user.id,
      dto,
    );
  }

  @Get('workspaces')
  @ApiOperation({
    summary: "Get user's workspaces",
    description:
      'Returns workspaces the current user belongs to. ' +
      'A SUPER_ADMIN will receive all workspaces in the system. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successfully retrieved workspaces (all for SUPER_ADMIN, owned memberships for USER)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  getMyWorkspaces(@GetUser() user: AuthUser) {
    return this.usersService.getUserWorkspaces({
      id: user.id,
      role: user.role,
    });
  }

  @Get('workspaces/:workspaceId/roles')
  @ApiOperation({
    summary: "Get user's role in a workspace",
    description:
      "Returns the current user's role inside a specific workspace. " +
      'A SUPER_ADMIN can query any workspace. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiParam({
    name: 'workspaceId',
    description: 'Target workspace UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved workspace role',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  @ApiResponse({
    status: 404,
    description: 'Workspace not found or user is not a member',
  })
  getWorkspaceRole(
    @GetUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.usersService.getUserRoleInWorkspace(
      { id: user.id, role: user.role },
      workspaceId,
    );
  }

  @Get('projects')
  @ApiOperation({
    summary: "Get user's projects",
    description:
      'Returns projects the current user is a member of. ' +
      'A SUPER_ADMIN will receive all projects across all workspaces. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successfully retrieved projects (all for SUPER_ADMIN, membership-scoped for USER)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  getMyProjects(@GetUser() user: AuthUser) {
    return this.usersService.getUserProjects({
      id: user.id,
      role: user.role,
    });
  }

  @Get('tasks')
  @ApiOperation({
    summary: "Get user's tasks",
    description:
      'Returns tasks assigned to the current user, with optional filters (status, priority, projectId). ' +
      'A SUPER_ADMIN will receive all tasks across all projects. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successfully retrieved tasks (all for SUPER_ADMIN, assigned for USER)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  getMyTasks(@GetUser() user: AuthUser, @Query() query: TaskQueryDto) {
    return this.usersService.getUserTasks(
      { id: user.id, role: user.role },
      query,
    );
  }

  @Get('deployments')
  @ApiOperation({
    summary: "Get user's deployments",
    description:
      'Returns deployments initiated by the current user. ' +
      'A SUPER_ADMIN will receive all deployments across all projects. ' +
      'Accessible only by the authenticated user or a SUPER_ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successfully retrieved deployments (all for SUPER_ADMIN, own deployments for USER)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  getMyDeployments(@GetUser() user: AuthUser) {
    return this.usersService.getUserDeployments({
      id: user.id,
      role: user.role,
    });
  }
}
