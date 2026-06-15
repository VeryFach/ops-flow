import { SetMetadata } from '@nestjs/common';

export const DEPLOYMENT_ROLES_KEY = 'deployment-roles';

export const DeploymentRoles = (...roles: string[]) =>
  SetMetadata(DEPLOYMENT_ROLES_KEY, roles);
