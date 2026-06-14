import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, MinLength, MaxLength } from 'class-validator';
import { TaskStatus, Priority } from '@prisma/client';

export class CreateTaskDto {
    @ApiProperty({ example: 'Implement JWT authentication', description: 'Task title' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(200)
    title: string;

    @ApiPropertyOptional({ example: 'Create auth module with JWT and guards' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ enum: TaskStatus, example: 'TODO' })
    @IsEnum(TaskStatus)
    @IsOptional()
    status?: TaskStatus;

    @ApiProperty({ enum: Priority, example: 'MEDIUM' })
    @IsEnum(Priority)
    @IsOptional()
    priority?: Priority;

    @ApiProperty({ example: 'project-uuid-here' })
    @IsUUID()
    @IsNotEmpty()
    projectId: string;

    @ApiPropertyOptional({ example: ['user-uuid-1', 'user-uuid-2'], description: 'User IDs to assign to this task' })
    @IsUUID('4', { each: true })
    @IsOptional()
    assigneeIds?: string[];
}