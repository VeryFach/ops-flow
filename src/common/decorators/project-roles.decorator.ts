import { SetMetadata } from '@nestjs/common';
import { ProjectMemberRole } from '@prisma/client';

export const PROJECT_ROLES_KEY = 'project-roles';

export const ProjectRoles = (...roles: ProjectMemberRole[]) => 
    SetMetadata(PROJECT_ROLES_KEY, roles);