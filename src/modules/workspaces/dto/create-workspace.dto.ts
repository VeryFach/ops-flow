import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class CreateWorkspaceDto {
    @ApiProperty({ example: 'Engineering Team', description: 'Workspace name' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(100)
    name: string;

    @ApiProperty({ example: 'engineering-team', description: 'Unique slug for workspace URL' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(50)
    slug: string;
}