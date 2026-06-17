import { PrismaService } from '../../src/modules/prisma/prisma.service';

/**
 * Deletes all test data in correct FK-dependency order.
 *
 * Dependency graph (child → parent):
 *   audit_logs       → workspaces, users
 *   deployment_tasks → deployments, tasks
 *   deployments      → projects, users
 *   task_status_history → tasks, users
 *   task_assignees   → tasks, users
 *   tasks            → projects
 *   project_members  → projects, users
 *   projects         → workspaces, users
 *   workspace_members → workspaces, users
 *   workspaces       → users
 *
 * Only users matching *@e2e.com are deleted to avoid
 * touching seed / non-test data.
 */
export async function cleanupDatabase(prisma: PrismaService) {
  // 1. Audit logs (FK → workspaces, users)
  await prisma.auditLog.deleteMany();

  // 2. Deployment join-table (FK → deployments, tasks)
  await prisma.deploymentTask.deleteMany();

  // 3. Deployments (FK → projects, users)
  await prisma.deployment.deleteMany();

  // 4. Task status history (FK → tasks, users)
  await prisma.taskStatusHistory.deleteMany();

  // 5. Task assignees (FK → tasks, users)
  await prisma.taskAssignee.deleteMany();

  // 6. Tasks (FK → projects)
  await prisma.task.deleteMany();

  // 7. Project members (FK → projects, users)
  await prisma.projectMember.deleteMany();

  // 8. Projects (FK → workspaces, users)
  await prisma.project.deleteMany();

  // 9. Workspace members (FK → workspaces, users)
  await prisma.workspaceMember.deleteMany();

  // 10. Workspaces (FK → users)
  await prisma.workspace.deleteMany();

  // 11. Users (only test accounts)
  await prisma.user.deleteMany({
    where: { email: { endsWith: '@e2e.com' } },
  });
}
