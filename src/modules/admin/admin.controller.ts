import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({
    summary: 'List all users with their roles',
    description:
      'Returns every user in the system with their global role. ' +
      'Requires SUPER_ADMIN privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all users',
    type: [UserResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — SUPER_ADMIN role required',
  })
  listUsers() {
    return this.adminService.listAllUsers();
  }

  @Patch('users/:id/role')
  @ApiOperation({
    summary: "Change a user's global role",
    description:
      "Updates the target user's role and creates an audit log entry. " +
      'Requires SUPER_ADMIN privileges.',
  })
  @ApiParam({ name: 'id', description: 'Target user UUID', type: String })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — SUPER_ADMIN role required',
  })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @GetUser('id') adminUserId: string,
  ) {
    return this.adminService.updateUserRole(id, dto.role, adminUserId);
  }

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Fetch all audit logs',
    description:
      'Returns all audit logs across every workspace, ordered by createdAt descending. ' +
      'Includes the related user and workspace data for each entry. ' +
      'Requires SUPER_ADMIN privileges.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Successfully retrieved all audit logs (ordered by createdAt desc, with user data)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — SUPER_ADMIN role required',
  })
  getAuditLogs() {
    return this.adminService.getAllAuditLogs();
  }

  @Get('deployments/failed')
  @ApiOperation({
    summary: 'Fetch all failed deployments',
    description:
      'Returns every deployment with status FAILED, including related project, ' +
      'deployer, and task information. Requires SUPER_ADMIN privileges.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all deployments with status FAILED',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — SUPER_ADMIN role required',
  })
  getFailedDeployments() {
    return this.adminService.getFailedDeployments();
  }
}
