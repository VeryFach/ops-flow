import { PrismaClient, UserRole, TaskStatus, Priority, DeploymentStatus, WorkspaceMemberRole, ProjectMemberRole } from '@prisma/client';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});


// Load environment variables
dotenv.config();

// Debug: pastikan DATABASE_URL terbaca
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Loaded' : '❌ Missing');

async function main() {
    console.log('🌱 Starting database seeding...');

    // ==================== 1. CREATE USERS ====================
    console.log('📝 Creating users...');

    const passwordHash = await argon2.hash('password123');

    const users = await Promise.all([
        prisma.user.upsert({
            where: { email: 'superadmin@opsflow.com' },
            update: {},
            create: {
                name: 'Super Admin',
                email: 'superadmin@opsflow.com',
                password: passwordHash,
                role: UserRole.SUPER_ADMIN,
            },
        }),
        prisma.user.upsert({
            where: { email: 'john@engineer.com' },
            update: {},
            create: {
                name: 'John Engineer',
                email: 'john@engineer.com',
                password: passwordHash,
                role: UserRole.USER,
            },
        }),
        prisma.user.upsert({
            where: { email: 'jane@engineer.com' },
            update: {},
            create: {
                name: 'Jane Engineer',
                email: 'jane@engineer.com',
                password: passwordHash,
                role: UserRole.USER,
            },
        }),
        prisma.user.upsert({
            where: { email: 'bob@viewer.com' },
            update: {},
            create: {
                name: 'Bob Viewer',
                email: 'bob@viewer.com',
                password: passwordHash,
                role: UserRole.USER,
            },
        }),
    ]);

    console.log(`✅ Created ${users.length} users`);

    const superAdmin = users[0];
    const john = users[1];
    const jane = users[2];
    const bob = users[3];

    // ==================== 2. CREATE WORKSPACE ====================
    console.log('🏢 Creating workspace...');

    const workspace = await prisma.workspace.upsert({
        where: { slug: 'opsflow-engineering' },
        update: {},
        create: {
            name: 'OpsFlow Engineering',
            slug: 'opsflow-engineering',
            ownerId: superAdmin.id,
        },
    });

    console.log(`✅ Created workspace: ${workspace.name}`);

    // ==================== 3. ADD WORKSPACE MEMBERS ====================
    console.log('👥 Adding workspace members...');

    const workspaceMembers = await Promise.all([
        prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: workspace.id,
                    userId: superAdmin.id,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                userId: superAdmin.id,
                role: WorkspaceMemberRole.OWNER,
            },
        }),
        prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: workspace.id,
                    userId: john.id,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                userId: john.id,
                role: WorkspaceMemberRole.ADMIN,
            },
        }),
        prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: workspace.id,
                    userId: jane.id,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                userId: jane.id,
                role: WorkspaceMemberRole.ENGINEER,
            },
        }),
        prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: workspace.id,
                    userId: bob.id,
                },
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                userId: bob.id,
                role: WorkspaceMemberRole.VIEWER,
            },
        }),
    ]);

    console.log(`✅ Added ${workspaceMembers.length} workspace members`);

    // ==================== 4. CREATE PROJECTS ====================
    console.log('📦 Creating projects...');

    const projects = await Promise.all([
        prisma.project.upsert({
            where: { id: 'seed-project-1' },
            update: {},
            create: {
                id: 'seed-project-1',
                name: 'Backend API',
                description: 'REST API for OpsFlow platform',
                workspaceId: workspace.id,
                createdById: superAdmin.id,
            },
        }),
        prisma.project.upsert({
            where: { id: 'seed-project-2' },
            update: {},
            create: {
                id: 'seed-project-2',
                name: 'Frontend Dashboard',
                description: 'React dashboard for OpsFlow',
                workspaceId: workspace.id,
                createdById: john.id,
            },
        }),
        prisma.project.upsert({
            where: { id: 'seed-project-3' },
            update: {},
            create: {
                id: 'seed-project-3',
                name: 'Mobile App',
                description: 'React Native mobile application',
                workspaceId: workspace.id,
                createdById: jane.id,
            },
        }),
    ]);

    console.log(`✅ Created ${projects.length} projects`);

    // ==================== 5. ADD PROJECT MEMBERS ====================
    console.log('👥 Adding project members...');

    // Project 1 members
    await Promise.all([
        prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: projects[0].id,
                    userId: superAdmin.id,
                },
            },
            update: {},
            create: {
                projectId: projects[0].id,
                userId: superAdmin.id,
                role: ProjectMemberRole.ADMIN,
            },
        }),
        prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: projects[0].id,
                    userId: john.id,
                },
            },
            update: {},
            create: {
                projectId: projects[0].id,
                userId: john.id,
                role: ProjectMemberRole.ENGINEER,
            },
        }),
        prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: projects[0].id,
                    userId: jane.id,
                },
            },
            update: {},
            create: {
                projectId: projects[0].id,
                userId: jane.id,
                role: ProjectMemberRole.ENGINEER,
            },
        }),
    ]);

    // Project 2 members
    await Promise.all([
        prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: projects[1].id,
                    userId: john.id,
                },
            },
            update: {},
            create: {
                projectId: projects[1].id,
                userId: john.id,
                role: ProjectMemberRole.ADMIN,
            },
        }),
        prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: projects[1].id,
                    userId: jane.id,
                },
            },
            update: {},
            create: {
                projectId: projects[1].id,
                userId: jane.id,
                role: ProjectMemberRole.ENGINEER,
            },
        }),
    ]);

    // Project 3 members
    await Promise.all([
        prisma.projectMember.upsert({
            where: {
                projectId_userId: {
                    projectId: projects[2].id,
                    userId: jane.id,
                },
            },
            update: {},
            create: {
                projectId: projects[2].id,
                userId: jane.id,
                role: ProjectMemberRole.ADMIN,
            },
        }),
    ]);

    console.log(`✅ Added project members`);

    // ==================== 6. CREATE TASKS ====================
    console.log('📋 Creating tasks...');

    const tasks = await Promise.all([
        prisma.task.upsert({
            where: { id: 'seed-task-1' },
            update: {},
            create: {
                id: 'seed-task-1',
                title: 'Implement JWT Authentication',
                description: 'Create auth module with JWT and guards',
                status: TaskStatus.DONE,
                priority: Priority.HIGH,
                projectId: projects[0].id,
            },
        }),
        prisma.task.upsert({
            where: { id: 'seed-task-2' },
            update: {},
            create: {
                id: 'seed-task-2',
                title: 'Setup PostgreSQL with Prisma',
                description: 'Configure database and create schema',
                status: TaskStatus.DONE,
                priority: Priority.HIGH,
                projectId: projects[0].id,
            },
        }),
        prisma.task.upsert({
            where: { id: 'seed-task-3' },
            update: {},
            create: {
                id: 'seed-task-3',
                title: 'Create Workspace Module',
                description: 'Implement workspace CRUD and member management',
                status: TaskStatus.IN_PROGRESS,
                priority: Priority.MEDIUM,
                projectId: projects[0].id,
            },
        }),
        prisma.task.upsert({
            where: { id: 'seed-task-4' },
            update: {},
            create: {
                id: 'seed-task-4',
                title: 'Create Project Module',
                description: 'Implement project CRUD and member management',
                status: TaskStatus.TODO,
                priority: Priority.MEDIUM,
                projectId: projects[0].id,
            },
        }),
        prisma.task.upsert({
            where: { id: 'seed-task-5' },
            update: {},
            create: {
                id: 'seed-task-5',
                title: 'Design Dashboard Layout',
                description: 'Create responsive dashboard layout',
                status: TaskStatus.IN_PROGRESS,
                priority: Priority.MEDIUM,
                projectId: projects[1].id,
            },
        }),
        prisma.task.upsert({
            where: { id: 'seed-task-6' },
            update: {},
            create: {
                id: 'seed-task-6',
                title: 'Implement API Integration',
                description: 'Connect frontend to backend API',
                status: TaskStatus.TODO,
                priority: Priority.HIGH,
                projectId: projects[1].id,
            },
        }),
    ]);

    console.log(`✅ Created ${tasks.length} tasks`);

    // ==================== 7. ASSIGN TASKS ====================
    console.log('👥 Assigning tasks...');

    await Promise.all([
        prisma.taskAssignee.upsert({
            where: {
                taskId_userId: {
                    taskId: tasks[0].id,
                    userId: john.id,
                },
            },
            update: {},
            create: {
                taskId: tasks[0].id,
                userId: john.id,
            },
        }),
        prisma.taskAssignee.upsert({
            where: {
                taskId_userId: {
                    taskId: tasks[1].id,
                    userId: jane.id,
                },
            },
            update: {},
            create: {
                taskId: tasks[1].id,
                userId: jane.id,
            },
        }),
        prisma.taskAssignee.upsert({
            where: {
                taskId_userId: {
                    taskId: tasks[2].id,
                    userId: john.id,
                },
            },
            update: {},
            create: {
                taskId: tasks[2].id,
                userId: john.id,
            },
        }),
        prisma.taskAssignee.upsert({
            where: {
                taskId_userId: {
                    taskId: tasks[3].id,
                    userId: jane.id,
                },
            },
            update: {},
            create: {
                taskId: tasks[3].id,
                userId: jane.id,
            },
        }),
    ]);

    console.log(`✅ Assigned tasks`);

    // ==================== 8. CREATE DEPLOYMENTS ====================
    console.log('🚀 Creating deployments...');

    const deployments = await Promise.all([
        prisma.deployment.upsert({
            where: { id: 'seed-deployment-1' },
            update: {},
            create: {
                id: 'seed-deployment-1',
                version: 'v1.0.0',
                status: DeploymentStatus.SUCCESS,
                projectId: projects[0].id,
                deployedById: john.id,
            },
        }),
        prisma.deployment.upsert({
            where: { id: 'seed-deployment-2' },
            update: {},
            create: {
                id: 'seed-deployment-2',
                version: 'v1.1.0',
                status: DeploymentStatus.RUNNING,
                projectId: projects[0].id,
                deployedById: jane.id,
            },
        }),
    ]);

    console.log(`✅ Created ${deployments.length} deployments`);

    // ==================== 9. LINK DEPLOYMENT TASKS ====================
    console.log('🔗 Linking deployment tasks...');

    await Promise.all([
        prisma.deploymentTask.upsert({
            where: {
                deploymentId_taskId: {
                    deploymentId: deployments[0].id,
                    taskId: tasks[0].id,
                },
            },
            update: {},
            create: {
                deploymentId: deployments[0].id,
                taskId: tasks[0].id,
            },
        }),
        prisma.deploymentTask.upsert({
            where: {
                deploymentId_taskId: {
                    deploymentId: deployments[0].id,
                    taskId: tasks[1].id,
                },
            },
            update: {},
            create: {
                deploymentId: deployments[0].id,
                taskId: tasks[1].id,
            },
        }),
        prisma.deploymentTask.upsert({
            where: {
                deploymentId_taskId: {
                    deploymentId: deployments[1].id,
                    taskId: tasks[2].id,
                },
            },
            update: {},
            create: {
                deploymentId: deployments[1].id,
                taskId: tasks[2].id,
            },
        }),
    ]);

    console.log(`✅ Linked deployment tasks`);

    // ==================== 10. CREATE TASK STATUS HISTORY ====================
    console.log('📊 Creating task status history...');

    await Promise.all([
        prisma.taskStatusHistory.create({
            data: {
                taskId: tasks[0].id,
                changedById: john.id,
                fromStatus: TaskStatus.TODO,
                toStatus: TaskStatus.IN_PROGRESS,
            },
        }),
        prisma.taskStatusHistory.create({
            data: {
                taskId: tasks[0].id,
                changedById: john.id,
                fromStatus: TaskStatus.IN_PROGRESS,
                toStatus: TaskStatus.DONE,
            },
        }),
        prisma.taskStatusHistory.create({
            data: {
                taskId: tasks[2].id,
                changedById: john.id,
                fromStatus: TaskStatus.TODO,
                toStatus: TaskStatus.IN_PROGRESS,
            },
        }),
    ]);

    console.log('✅ Created status history');

    // ==================== SUMMARY ====================
    console.log('\n🎉 Seeding completed successfully!');
    console.log('=====================================');
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Workspace: 1`);
    console.log(`   - Workspace Members: ${workspaceMembers.length}`);
    console.log(`   - Projects: ${projects.length}`);
    console.log(`   - Tasks: ${tasks.length}`);
    console.log(`   - Deployments: ${deployments.length}`);
    console.log('=====================================');
    console.log('\n🔐 Default Login Credentials:');
    console.log('   Email: superadmin@opsflow.com');
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