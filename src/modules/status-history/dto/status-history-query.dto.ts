import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class StatusHistoryQueryDto {
  @ApiPropertyOptional({
    enum: TaskStatus,
    description: 'Filter by from status',
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  fromStatus?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskStatus, description: 'Filter by to status' })
  @IsEnum(TaskStatus)
  @IsOptional()
  toStatus?: TaskStatus;

  @ApiPropertyOptional({
    example: 'user-uuid-here',
    description: 'Filter by who changed the status',
  })
  @IsUUID()
  @IsOptional()
  changedById?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;
}
