import {
  PrismaClient,
  UserRole,
  TaskStatus,
  Priority,
  DeploymentStatus,
  AuditAction,
  WorkspaceMemberRole,
  ProjectMemberRole,
} from '@prisma/client';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────
// Deterministic IDs — hardcoded so every FK relation is stable
// across re-runs and test fixtures.  Format: seed-<entity>-<n>
// Prisma allows any string for @id fields; uuid() is just a
// default, not a constraint.  Using manual IDs is the standard
// approach for idempotent seeds.
// ─────────────────────────────────────────────────────────────

// Users
const SUPER_ADMIN_ID = 'seed-user-superadmin';
const JOHN_ID = 'seed-user-john';
const JANE_ID = 'seed-user-jane';
const BOB_ID = 'seed-user-bob';

// Workspace
const WORKSPACE_ID = 'seed-workspace-1';

// Projects
const PROJECT_BACKEND_ID = 'seed-project-backend';
const PROJECT_FRONTEND_ID = 'seed-project-frontend';
const PROJECT_MOBILE_ID = 'seed-project-mobile';

// Tasks
const TASK_JWT_ID = 'seed-task-jwt';
const TASK_POSTGRES_ID = 'seed-task-postgres';
const TASK_WORKSPACE_ID = 'seed-task-workspace';
const TASK_PROJECT_MODULE_ID = 'seed-task-project-module';
const TASK_DASHBOARD_ID = 'seed-task-dashboard';
const TASK_API_INTEGRATION_ID = 'seed-task-api-integration';

// Deployments
const DEPLOYMENT_V1_ID = 'seed-deployment-v1';
const DEPLOYMENT_V11_ID = 'seed-deployment-v11';

// Task Status History
const TSH_1_ID = 'seed-tsh-1';
const TSH_2_ID = 'seed-tsh-2';
const TSH_3_ID = 'seed-tsh-3';

// Audit Logs
const AUDIT_1_ID = 'seed-audit-1';
const AUDIT_2_ID = 'seed-audit-2';
const AUDIT_3_ID = 'seed-audit-3';

async function main() {
  console.log('🌱 Starting database seeding...');

  // ============================================================
  // 1. USERS  (unique constraint on email → upsert is safe)
  // ============================================================
  console.log('📝 Creating users...');

  const passwordHash = await argon2.hash('password123');

  const [superAdmin, john, jane, bob] = await Promise.all([
    prisma.user.upsert({
      where: { id: SUPER_ADMIN_ID },
      update: { name: 'Super Admin', role: UserRole.SUPER_ADMIN },
      create: {
        id: SUPER_ADMIN_ID,
        name: 'Super Admin',
        email: 'superadmin@opsflow.com',
        password: passwordHash,
        role: UserRole.SUPER_ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { id: JOHN_ID },
      update: { name: 'John Engineer', role: UserRole.USER },
      create: {
        id: JOHN_ID,
        name: 'John Engineer',
        email: 'john@engineer.com',
        password: passwordHash,
        role: UserRole.USER,
      },
    }),
    prisma.user.upsert({
      where: { id: JANE_ID },
      update: { name: 'Jane Engineer', role: UserRole.USER },
      create: {
        id: JANE_ID,
        name: 'Jane Engineer',
        email: 'jane@engineer.com',
        password: passwordHash,
        role: UserRole.USER,
      },
    }),
    prisma.user.upsert({
      where: { id: BOB_ID },
      update: { name: 'Bob Viewer', role: UserRole.USER },
      create: {
        id: BOB_ID,
        name: 'Bob Viewer',
        email: 'bob@viewer.com',
        password: passwordHash,
        role: UserRole.USER,
      },
    }),
  ]);

  console.log(`✅ Created/updated ${4} users`);

  // ============================================================
  // 2. WORKSPACE  (unique constraint on slug → upsert is safe)
  //     FK: ownerId → User
  // ============================================================
  console.log('🏢 Creating workspace...');

  const workspace = await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    update: { name: 'OpsFlow Engineering', ownerId: superAdmin.id },
    create: {
      id: WORKSPACE_ID,
      name: 'OpsFlow Engineering',
      slug: 'opsflow-engineering',
      ownerId: superAdmin.id,
    },
  });

  console.log(`✅ Created workspace: ${workspace.name}`);

  // ============================================================
  // 3. WORKSPACE MEMBERS  (composite PK: workspaceId + userId)
  // ============================================================
  console.log('👥 Adding workspace members...');

  const wsMemberData = [
    { userId: superAdmin.id, role: WorkspaceMemberRole.OWNER },
    { userId: john.id, role: WorkspaceMemberRole.ADMIN },
    { userId: jane.id, role: WorkspaceMemberRole.ENGINEER },
    { userId: bob.id, role: WorkspaceMemberRole.VIEWER },
  ] as const;

  await Promise.all(
    wsMemberData.map((m) =>
      prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: m.userId,
          },
        },
        update: { role: m.role },
        create: {
          workspaceId: workspace.id,
          userId: m.userId,
          role: m.role,
        },
      }),
    ),
  );

  console.log(`✅ Added ${wsMemberData.length} workspace members`);

  // ============================================================
  // 4. PROJECTS  (FK: workspaceId → Workspace, createdById → User)
  // ============================================================
  console.log('📦 Creating projects...');

  const projectData = [
    {
      id: PROJECT_BACKEND_ID,
      name: 'Backend API',
      description: 'REST API for OpsFlow platform',
      createdById: superAdmin.id,
    },
    {
      id: PROJECT_FRONTEND_ID,
      name: 'Frontend Dashboard',
      description: 'React dashboard for OpsFlow',
      createdById: john.id,
    },
    {
      id: PROJECT_MOBILE_ID,
      name: 'Mobile App',
      description: 'React Native mobile application',
      createdById: jane.id,
    },
  ];

  const [projectBackend, projectFrontend, projectMobile] = await Promise.all(
    projectData.map((p) =>
      prisma.project.upsert({
        where: { id: p.id },
        update: { name: p.name, description: p.description },
        create: {
          id: p.id,
          name: p.name,
          description: p.description,
          workspaceId: workspace.id,
          createdById: p.createdById,
        },
      }),
    ),
  );

  console.log(`✅ Created ${projectData.length} projects`);

  // ============================================================
  // 5. PROJECT MEMBERS  (composite PK: projectId + userId)
  // ============================================================
  console.log('👥 Adding project members...');

  const pmData = [
    // Backend API
    {
      projectId: projectBackend.id,
      userId: superAdmin.id,
      role: ProjectMemberRole.ADMIN,
    },
    {
      projectId: projectBackend.id,
      userId: john.id,
      role: ProjectMemberRole.ENGINEER,
    },
    {
      projectId: projectBackend.id,
      userId: jane.id,
      role: ProjectMemberRole.ENGINEER,
    },
    {
      projectId: projectBackend.id,
      userId: bob.id,
      role: ProjectMemberRole.VIEWER,
    },
    // Frontend Dashboard
    {
      projectId: projectFrontend.id,
      userId: john.id,
      role: ProjectMemberRole.ADMIN,
    },
    {
      projectId: projectFrontend.id,
      userId: jane.id,
      role: ProjectMemberRole.ENGINEER,
    },
    // Mobile App
    {
      projectId: projectMobile.id,
      userId: jane.id,
      role: ProjectMemberRole.ADMIN,
    },
  ];

  await Promise.all(
    pmData.map((pm) =>
      prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: pm.projectId,
            userId: pm.userId,
          },
        },
        update: { role: pm.role },
        create: {
          projectId: pm.projectId,
          userId: pm.userId,
          role: pm.role,
        },
      }),
    ),
  );

  console.log(`✅ Added ${pmData.length} project members`);

  // ============================================================
  // 6. TASKS  (FK: projectId → Project)
  // ============================================================
  console.log('📋 Creating tasks...');

  const taskData = [
    {
      id: TASK_JWT_ID,
      title: 'Implement JWT Authentication',
      description: 'Create auth module with JWT and guards',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      projectId: projectBackend.id,
    },
    {
      id: TASK_POSTGRES_ID,
      title: 'Setup PostgreSQL with Prisma',
      description: 'Configure database and create schema',
      status: TaskStatus.DONE,
      priority: Priority.HIGH,
      projectId: projectBackend.id,
    },
    {
      id: TASK_WORKSPACE_ID,
      title: 'Create Workspace Module',
      description: 'Implement workspace CRUD and member management',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      projectId: projectBackend.id,
    },
    {
      id: TASK_PROJECT_MODULE_ID,
      title: 'Create Project Module',
      description: 'Implement project CRUD and member management',
      status: TaskStatus.TODO,
      priority: Priority.MEDIUM,
      projectId: projectBackend.id,
    },
    {
      id: TASK_DASHBOARD_ID,
      title: 'Design Dashboard Layout',
      description: 'Create responsive dashboard layout',
      status: TaskStatus.IN_PROGRESS,
      priority: Priority.MEDIUM,
      projectId: projectFrontend.id,
    },
    {
      id: TASK_API_INTEGRATION_ID,
      title: 'Implement API Integration',
      description: 'Connect frontend to backend API',
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      projectId: projectFrontend.id,
    },
  ];

  const tasks = await Promise.all(
    taskData.map((t) =>
      prisma.task.upsert({
        where: { id: t.id },
        update: { title: t.title, status: t.status, priority: t.priority },
        create: {
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          projectId: t.projectId,
        },
      }),
    ),
  );

  // Build a lookup so downstream steps reference by seed ID
  const task = Object.fromEntries(tasks.map((t) => [t.id, t]));

  console.log(`✅ Created ${taskData.length} tasks`);

  // ============================================================
  // 7. TASK ASSIGNEES  (composite PK: taskId + userId)
  // ============================================================
  console.log('👥 Assigning tasks...');

  const assigneeData = [
    { taskId: TASK_JWT_ID, userId: john.id },
    { taskId: TASK_POSTGRES_ID, userId: jane.id },
    { taskId: TASK_WORKSPACE_ID, userId: john.id },
    { taskId: TASK_PROJECT_MODULE_ID, userId: jane.id },
    { taskId: TASK_DASHBOARD_ID, userId: john.id },
    { taskId: TASK_API_INTEGRATION_ID, userId: jane.id },
  ];

  await Promise.all(
    assigneeData.map((a) =>
      prisma.taskAssignee.upsert({
        where: {
          taskId_userId: {
            taskId: a.taskId,
            userId: a.userId,
          },
        },
        update: {},
        create: {
          taskId: a.taskId,
          userId: a.userId,
        },
      }),
    ),
  );

  console.log(`✅ Assigned ${assigneeData.length} tasks`);

  // ============================================================
  // 8. DEPLOYMENTS  (FK: projectId → Project, deployedById → User?)
  // ============================================================
  console.log('🚀 Creating deployments...');

  const [deployV1, deployV11] = await Promise.all([
    prisma.deployment.upsert({
      where: { id: DEPLOYMENT_V1_ID },
      update: { version: 'v1.0.0', status: DeploymentStatus.SUCCESS },
      create: {
        id: DEPLOYMENT_V1_ID,
        version: 'v1.0.0',
        status: DeploymentStatus.SUCCESS,
        projectId: projectBackend.id,
        deployedById: john.id,
      },
    }),
    prisma.deployment.upsert({
      where: { id: DEPLOYMENT_V11_ID },
      update: { version: 'v1.1.0', status: DeploymentStatus.RUNNING },
      create: {
        id: DEPLOYMENT_V11_ID,
        version: 'v1.1.0',
        status: DeploymentStatus.RUNNING,
        projectId: projectBackend.id,
        deployedById: jane.id,
      },
    }),
  ]);

  console.log(`✅ Created 2 deployments`);

  // ============================================================
  // 9. DEPLOYMENT TASKS  (composite PK: deploymentId + taskId)
  // ============================================================
  console.log('🔗 Linking deployment tasks...');

  const dtData = [
    { deploymentId: deployV1.id, taskId: TASK_JWT_ID },
    { deploymentId: deployV1.id, taskId: TASK_POSTGRES_ID },
    { deploymentId: deployV11.id, taskId: TASK_WORKSPACE_ID },
  ];

  await Promise.all(
    dtData.map((dt) =>
      prisma.deploymentTask.upsert({
        where: {
          deploymentId_taskId: {
            deploymentId: dt.deploymentId,
            taskId: dt.taskId,
          },
        },
        update: {},
        create: {
          deploymentId: dt.deploymentId,
          taskId: dt.taskId,
        },
      }),
    ),
  );

  console.log(`✅ Linked ${dtData.length} deployment tasks`);

  // ============================================================
  // 10. TASK STATUS HISTORY  (FK: taskId → Task, changedById → User)
  //     Uses upsert with deterministic IDs for idempotency.
  // ============================================================
  console.log('📊 Creating task status history...');

  const tshData = [
    {
      id: TSH_1_ID,
      taskId: TASK_JWT_ID,
      fromStatus: TaskStatus.TODO,
      toStatus: TaskStatus.IN_PROGRESS,
    },
    {
      id: TSH_2_ID,
      taskId: TASK_JWT_ID,
      fromStatus: TaskStatus.IN_PROGRESS,
      toStatus: TaskStatus.DONE,
    },
    {
      id: TSH_3_ID,
      taskId: TASK_WORKSPACE_ID,
      fromStatus: TaskStatus.TODO,
      toStatus: TaskStatus.IN_PROGRESS,
    },
  ];

  await Promise.all(
    tshData.map((h) =>
      prisma.taskStatusHistory.upsert({
        where: { id: h.id },
        update: { fromStatus: h.fromStatus, toStatus: h.toStatus },
        create: {
          id: h.id,
          taskId: h.taskId,
          changedById: john.id,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
        },
      }),
    ),
  );

  console.log(`✅ Created ${tshData.length} status history entries`);

  // ============================================================
  // 11. AUDIT LOGS  (FK: userId → User?, workspaceId → Workspace?)
  //     Both FKs are optional (nullable), so no circular risk.
  //     Uses upsert for idempotency.
  // ============================================================
  console.log('📝 Creating audit logs...');

  const auditData = [
    {
      id: AUDIT_1_ID,
      action: AuditAction.CREATE,
      entity: 'Workspace',
      entityId: workspace.id,
      userId: superAdmin.id,
      workspaceId: workspace.id,
      newValue: { name: workspace.name },
    },
    {
      id: AUDIT_2_ID,
      action: AuditAction.CREATE,
      entity: 'Project',
      entityId: projectBackend.id,
      userId: superAdmin.id,
      workspaceId: workspace.id,
      newValue: { name: projectBackend.name },
    },
    {
      id: AUDIT_3_ID,
      action: AuditAction.UPDATE,
      entity: 'Task',
      entityId: task[TASK_JWT_ID].id,
      userId: john.id,
      workspaceId: workspace.id,
      oldValue: { status: 'TODO' },
      newValue: { status: 'IN_PROGRESS' },
    },
  ];

  await Promise.all(
    auditData.map((a) =>
      prisma.auditLog.upsert({
        where: { id: a.id },
        update: { action: a.action },
        create: {
          id: a.id,
          action: a.action,
          entity: a.entity,
          entityId: a.entityId,
          userId: a.userId,
          workspaceId: a.workspaceId,
          oldValue: a.oldValue ?? undefined,
          newValue: a.newValue ?? undefined,
        },
      }),
    ),
  );

  console.log(`✅ Created ${auditData.length} audit log entries`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n🎉 Seeding completed successfully!');
  console.log('=====================================');
  console.log('📊 Summary:');
  console.log(`   - Users:              4`);
  console.log(`   - Workspaces:         1`);
  console.log(`   - Workspace Members:  ${wsMemberData.length}`);
  console.log(`   - Projects:           ${projectData.length}`);
  console.log(`   - Project Members:    ${pmData.length}`);
  console.log(`   - Tasks:              ${taskData.length}`);
  console.log(`   - Task Assignees:     ${assigneeData.length}`);
  console.log(`   - Deployments:        2`);
  console.log(`   - Deployment Tasks:   ${dtData.length}`);
  console.log(`   - Status History:     ${tshData.length}`);
  console.log(`   - Audit Logs:         ${auditData.length}`);
  console.log('=====================================');
  console.log('\n🔐 Default Login Credentials:');
  console.log('   Email:    superadmin@opsflow.com');
  console.log('   Password: password123');
  console.log('=====================================');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
