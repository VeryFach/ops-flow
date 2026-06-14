import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsUUID } from 'class-validator';
import { ProjectMemberRole } from '@prisma/client';

export class AddProjectMemberDto {
    @ApiProperty({ example: 'user-uuid-here' })
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ enum: ProjectMemberRole, example: 'ENGINEER' })
    @IsEnum(ProjectMemberRole)
    @IsNotEmpty()
    role: ProjectMemberRole;
}