import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Status History E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let server: Server;
  let workspaceId: string;
  let taskId: string;
  let userId: string;

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

    const meRes = await agent.get('/users/me').expect(200);
    userId = (meRes.body as { id: string }).id;

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

    const projectId = (projRes.body as { id: string }).id;

    const taskRes = await agent
      .post('/tasks')
      .send({
        title: testData.taskTitle,
        projectId,
      })
      .expect(201);

    taskId = (taskRes.body as { id: string }).id;

    await agent
      .patch(`/tasks/${taskId}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    await agent
      .patch(`/tasks/${taskId}/status`)
      .send({ status: 'DONE' })
      .expect(200);
  }, 30000);

  it('should get task status history', async () => {
    const res = await agent.get(`/status-history/task/${taskId}`).expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });

  it('should get task summary', async () => {
    const res = await agent
      .get(`/status-history/task/${taskId}/summary`)
      .expect(200);

    expect(res.body).toHaveProperty('totalChanges');
    expect(res.body).toHaveProperty('timeline');
  });

  it('should get user status history', async () => {
    const res = await agent.get(`/status-history/user/${userId}`).expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
  });

  it('should get workspace activity', async () => {
    const res = await agent
      .get(`/status-history/workspace/${workspaceId}/activity`)
      .expect(200);

    expect(res.body).toHaveProperty('activityByDate');
    expect(res.body).toHaveProperty('recentChanges');
  });
});
