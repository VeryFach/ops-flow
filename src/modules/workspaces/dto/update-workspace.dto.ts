import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateWorkspaceDto {
    @ApiPropertyOptional({ example: 'Engineering Team Updated' })
    @IsString()
    @IsOptional()
    @MinLength(3)
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ example: 'engineering-team-v2' })
    @IsString()
    @IsOptional()
    @MinLength(3)
    @MaxLength(50)
    slug?: string;
}