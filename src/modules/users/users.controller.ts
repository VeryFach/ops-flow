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
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { EditUserDto } from './dto/edit-user.dto';
import { TaskQueryDto } from './dto/task-query.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Endpoint untuk mengambil data profil user yang sedang login saat ini.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns the current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@GetUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  /**
   * Endpoint untuk mengubah/update data profil user yang sedang login.
   */
  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  editUser(@GetUser('id') userId: string, @Body() dto: EditUserDto) {
    return this.usersService.editUser(userId, dto);
  }

  @Get('workspaces')
  getMyWorkspaces(@GetUser('id') userId: string) {
    return this.usersService.getUserWorkspaces(userId);
  }

  @Get('workspaces/:workspaceId/roles')
  getWorkspaceRole(
    @GetUser('id') userId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.usersService.getUserRoleInWorkspace(userId, workspaceId);
  }

  @Get('projects')
  getMyProjects(@GetUser('id') userId: string) {
    return this.usersService.getUserProjects(userId);
  }

  @Get('tasks')
  getMyTasks(@GetUser('id') userId: string, @Query() query: TaskQueryDto) {
    return this.usersService.getUserTasks(userId, query);
  }

  @Get('deployments')
  getMyDeployments(@GetUser('id') userId: string) {
    return this.usersService.getUserDeployments(userId);
  }
}
