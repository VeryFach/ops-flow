import { randomUUID } from 'crypto';

export function createTestData() {
  const id = randomUUID();

  return {
    id,
    email: `test-${id}@e2e.com`,
    workspaceSlug: `workspace-${id}`,
    workspaceName: `Workspace-${id}`,
    projectName: `Project-${id}`,
    taskTitle: `Task-${id}`,
  };
}
