import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { DeploymentStatus } from '@prisma/client';

export class UpdateDeploymentStatusDto {
    @ApiProperty({ enum: DeploymentStatus, example: 'SUCCESS' })
    @IsEnum(DeploymentStatus)
    @IsNotEmpty()
    status: DeploymentStatus;
}