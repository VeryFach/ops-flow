import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsUUID } from 'class-validator';

export class CreateProjectDto {
    @ApiProperty({ example: 'Backend API', description: 'Project name' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ example: 'REST API for the main application' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'workspace-uuid-here' })
    @IsUUID()
    @IsNotEmpty()
    workspaceId: string;
}