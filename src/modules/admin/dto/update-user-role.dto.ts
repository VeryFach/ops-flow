import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, example: 'SUPER_ADMIN' })
  @IsEnum(UserRole)
  role: UserRole;
}
