import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { DeploymentsService } from './deployments.service';
import { CreateDeploymentDto } from './dto/create-deployment.dto';
import { UpdateDeploymentStatusDto } from './dto/update-deployment-status.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { DeploymentRoleGuard } from '../../common/guards/deployment-role.guard';
import { DeploymentRoles } from '../../common/decorators/deployment-roles.decorator';

@ApiTags('deployments')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new deployment' })
  @ApiResponse({ status: 201, description: 'Deployment created successfully' })
  create(@GetUser('id') userId: string, @Body() dto: CreateDeploymentDto) {
    return this.deploymentsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all deployments' })
  findAll(
    @GetUser('id') userId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.deploymentsService.findAll(userId, projectId);
  }

  @Get(':deploymentId')
  @ApiOperation({ summary: 'Get deployment by ID' })
  findOne(
    @Param('deploymentId') deploymentId: string,
    @GetUser('id') userId: string,
  ) {
    return this.deploymentsService.findOne(deploymentId, userId);
  }

  @Patch(':deploymentId/status')
  @ApiOperation({ summary: 'Update deployment status' })
  @UseGuards(DeploymentRoleGuard)
  @DeploymentRoles('PROJECT_ADMIN', 'WORKSPACE_ADMIN')
  updateStatus(
    @Param('deploymentId') deploymentId: string,
    @GetUser('id') userId: string,
    @Body() dto: UpdateDeploymentStatusDto,
  ) {
    return this.deploymentsService.updateStatus(deploymentId, userId, dto);
  }

  @Delete(':deploymentId')
  @ApiOperation({ summary: 'Delete deployment' })
  @UseGuards(DeploymentRoleGuard)
  @DeploymentRoles('PROJECT_ADMIN', 'WORKSPACE_ADMIN')
  remove(
    @Param('deploymentId') deploymentId: string,
    @GetUser('id') userId: string,
  ) {
    return this.deploymentsService.remove(deploymentId, userId);
  }
}
