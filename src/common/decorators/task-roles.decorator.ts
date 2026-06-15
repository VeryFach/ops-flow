import { SetMetadata } from '@nestjs/common';

export const TASK_ROLES_KEY = 'task-roles';

export const TaskRoles = (...roles: string[]) =>
  SetMetadata(TASK_ROLES_KEY, roles);
