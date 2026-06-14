import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { StatusHistoryService } from './status-history.service';
import { StatusHistoryQueryDto } from './dto/status-history-query.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('status-history')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('status-history')
export class StatusHistoryController {
    constructor(private readonly statusHistoryService: StatusHistoryService) { }

    @Get('task/:taskId')
    @ApiOperation({ summary: 'Get status history for a specific task' })
    @ApiResponse({ status: 200, description: 'Returns status history for the task' })
    @ApiResponse({ status: 403, description: 'Access denied' })
    findByTaskId(
        @Param('taskId') taskId: string,
        @GetUser('id') userId: string,
        @Query() query: StatusHistoryQueryDto,
    ) {
        return this.statusHistoryService.findByTaskId(taskId, userId, query);
    }

    @Get('task/:taskId/summary')
    @ApiOperation({ summary: 'Get status change summary for a task' })
    @ApiResponse({ status: 200, description: 'Returns statistics about status changes' })
    getTaskSummary(
        @Param('taskId') taskId: string,
        @GetUser('id') userId: string,
    ) {
        return this.statusHistoryService.getTaskSummary(taskId, userId);
    }

    @Get('user/:userId')
    @ApiOperation({ summary: 'Get status changes made by a specific user' })
    @ApiResponse({ status: 200, description: 'Returns status changes by user' })
    findByUser(
        @Param('userId') targetUserId: string,
        @GetUser('id') userId: string,
        @Query() query: StatusHistoryQueryDto,
    ) {
        return this.statusHistoryService.findByUser(userId, targetUserId, query);
    }

    @Get('workspace/:workspaceId/activity')
    @ApiOperation({ summary: 'Get recent status change activity in a workspace' })
    @ApiResponse({ status: 200, description: 'Returns workspace activity feed' })
    getWorkspaceActivity(
        @Param('workspaceId') workspaceId: string,
        @GetUser('id') userId: string,
        @Query('limit') limit?: number,
    ) {
        return this.statusHistoryService.getWorkspaceActivity(workspaceId, userId, limit || 50);
    }
}