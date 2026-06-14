import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { TaskRoleGuard } from '../../common/guards/task-role.guard';
import { TaskRoles } from '../../common/decorators/task-roles.decorator';
import { TaskStatus } from '@prisma/client';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('tasks')
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new task' })
    @ApiResponse({ status: 201, description: 'Task created successfully' })
    create(@GetUser('id') userId: string, @Body() dto: CreateTaskDto) {
        return this.tasksService.create(userId, dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all tasks with filters' })
    findAll(@GetUser('id') userId: string, @Query() query: TaskQueryDto) {
        return this.tasksService.findAll(userId, query);
    }

    @Get(':taskId')
    @ApiOperation({ summary: 'Get task by ID' })
    findOne(@Param('taskId') taskId: string, @GetUser('id') userId: string) {
        return this.tasksService.findOne(taskId, userId);
    }

    @Patch(':taskId')
    @ApiOperation({ summary: 'Update task' })
    update(
        @Param('taskId') taskId: string,
        @GetUser('id') userId: string,
        @Body() dto: UpdateTaskDto,
    ) {
        return this.tasksService.update(taskId, userId, dto);
    }

    @Patch(':taskId/status')
    @ApiOperation({ summary: 'Update task status only' })
    @UseGuards(TaskRoleGuard)
    @TaskRoles('ASSIGNEE', 'PROJECT_ADMIN')
    updateStatus(
        @Param('taskId') taskId: string,
        @GetUser('id') userId: string,
        @Body('status') status: TaskStatus,
    ) {
        return this.tasksService.updateStatus(taskId, userId, status);
    }

    @Delete(':taskId')
    @ApiOperation({ summary: 'Delete task (soft delete)' })
    remove(@Param('taskId') taskId: string, @GetUser('id') userId: string) {
        return this.tasksService.remove(taskId, userId);
    }
}