import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { WorkspaceMemberRole } from '@prisma/client';

export class AddMemberDto {
    @ApiProperty({ example: 'user-uuid-here' })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({ enum: WorkspaceMemberRole, example: 'ENGINEER' })
    @IsEnum(WorkspaceMemberRole)
    @IsNotEmpty()
    role: WorkspaceMemberRole;
}