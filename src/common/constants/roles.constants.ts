export const WORKSPACE_ROLES = {
    OWNER: 'OWNER',
    ADMIN: 'ADMIN',
    ENGINEER: 'ENGINEER',
    VIEWER: 'VIEWER',
} as const;

export const PROJECT_ROLES = {
    ADMIN: 'ADMIN',
    ENGINEER: 'ENGINEER',
    VIEWER: 'VIEWER',
} as const;

export const TASK_STATUS = {
    TODO: 'TODO',
    IN_PROGRESS: 'IN_PROGRESS',
    DONE: 'DONE',
} as const;

export const DEPLOYMENT_STATUS = {
    PENDING: 'PENDING',
    RUNNING: 'RUNNING',
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    ROLLBACK: 'ROLLBACK',
} as const;