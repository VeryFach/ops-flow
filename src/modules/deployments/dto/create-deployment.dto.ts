import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsArray,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateDeploymentDto {
  @ApiProperty({ example: 'v1.0.0', description: 'Version tag' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  version: string;

  @ApiProperty({ example: 'project-uuid-here' })
  @IsUUID()
  @IsNotEmpty()
  projectId: string;

  @ApiPropertyOptional({
    example: ['task-uuid-1', 'task-uuid-2'],
    description: 'Tasks included in this deployment',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  taskIds?: string[];
}
