import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { AuditAction } from '@prisma/client';
import { Type } from 'class-transformer';

export class AuditQueryDto {
  @ApiPropertyOptional({ enum: AuditAction })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({ example: 'project-uuid-here' })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ApiPropertyOptional({ example: 'user-uuid-here' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({ example: 'Project' })
  @IsString()
  @IsOptional()
  entity?: string;

  @ApiPropertyOptional({ example: 'entity-uuid-here' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

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
