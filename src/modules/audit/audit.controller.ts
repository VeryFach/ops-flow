import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get all audit logs with filters' })
  @ApiResponse({ status: 200, description: 'Returns filtered audit logs' })
  findAll(
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
    @Query() query: AuditQueryDto,
  ) {
    return this.auditService.findAll(query, userId, userRole);
  }

  @Get('entity/:entity/:entityId')
  @ApiOperation({ summary: 'Get audit logs by entity' })
  findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ) {
    return this.auditService.findByEntity(entity, entityId, userId, userRole);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get audit logs by user' })
  findByUser(
    @Param('userId') targetUserId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ) {
    return this.auditService.findByUser(userId, targetUserId, userRole);
  }

  @Get('summary/:workspaceId')
  @ApiOperation({ summary: 'Get activity summary for a workspace' })
  getSummary(
    @Param('workspaceId') workspaceId: string,
    @GetUser('id') userId: string,
    @GetUser('role') userRole: string,
  ) {
    return this.auditService.getActivitySummary(workspaceId, userId, userRole);
  }
}
