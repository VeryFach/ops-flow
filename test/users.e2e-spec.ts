import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Users E2E', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let agent: ReturnType<typeof request.agent>;
    let server: Server;
    let workspaceId: string;
    let projectId: string;
    let taskId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
        app.use(cookieParser());
        await app.init();

        prisma = moduleFixture.get<PrismaService>(PrismaService);
        server = app.getHttpServer() as Server;
        agent = request.agent(server);
    }, 30000);

    afterAll(async () => {
        await prisma.$disconnect();
        await app.close();
    }, 30000);

    beforeEach(async () => {
        const testData = createTestData();

        await prisma.auditLog.deleteMany();
        await prisma.deploymentTask.deleteMany();
        await prisma.deployment.deleteMany();
        await prisma.taskStatusHistory.deleteMany();
        await prisma.taskAssignee.deleteMany();
        await prisma.task.deleteMany();
        await prisma.projectMember.deleteMany();
        await prisma.project.deleteMany();
        await prisma.workspaceMember.deleteMany();
        await prisma.workspace.deleteMany();
        await prisma.user.deleteMany({
            where: { email: { endsWith: '@e2e.com' } },
        });

        await agent
            .post('/auth/register')
            .send({
                email: testData.email,
                password: 'pass123',
                name: 'Owner',
            })
            .expect(201);

        await agent
            .post('/auth/login')
            .send({
                email: testData.email,
                password: 'pass123',
            })
            .expect(200);

        const wsRes = await agent
            .post('/workspaces')
            .send({
                name: testData.workspaceName,
                slug: testData.workspaceSlug,
            })
            .expect(201);

        workspaceId = (wsRes.body as { id: string }).id;

        const projRes = await agent
            .post('/projects')
            .send({
                name: testData.projectName,
                workspaceId,
            })
            .expect(201);

        projectId = (projRes.body as { id: string }).id;

        const taskRes = await agent
            .post('/tasks')
            .send({
                title: testData.taskTitle,
                projectId,
            })
            .expect(201);

        taskId = (taskRes.body as { id: string }).id;
    }, 30000);

    it('should get current user profile', async () => {
        const res = await agent.get('/users/me').expect(200);

        expect((res.body as { email: string }).email).toContain('@e2e.com');
    });

    it('should update current user profile', async () => {
        const res = await agent
            .patch('/users')
            .send({
                name: 'Updated User',
            })
            .expect(200);

        expect((res.body as { name: string }).name).toBe('Updated User');
    });

    it('should get user workspaces', async () => {
        const res = await agent.get('/users/workspaces').expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect((res.body as unknown[]).length).toBeGreaterThan(0);
    });

    it('should get user role in workspace', async () => {
        const res = await agent
            .get(`/users/workspaces/${workspaceId}/roles`)
            .expect(200);

        expect((res.body as { role: string }).role).toBeDefined();
    });

    it('should get user projects', async () => {
        const res = await agent.get('/users/projects').expect(200);

        expect(res.body).toHaveProperty('memberOf');
        expect(res.body).toHaveProperty('created');
    });

    it('should get user tasks', async () => {
        await prisma.taskAssignee.create({
            data: {
                taskId,
                userId: (await prisma.user.findFirstOrThrow()).id,
            },
        });

        const res = await agent.get('/users/tasks').expect(200);

        expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get user deployments', async () => {
        const me = await agent.get('/users/me').expect(200);
        const userId = (me.body as { id: string }).id;

        await prisma.deployment.create({
            data: {
                version: 'v1.0.0',
                projectId,
                deployedById: userId,
            },
        });

        const res = await agent.get('/users/deployments').expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect((res.body as unknown[]).length).toBeGreaterThan(0);
    });
});