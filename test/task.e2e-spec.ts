import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Task E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let projectId: string;
  let tokenB: string;
  let server: Server;
  let testData: ReturnType<typeof createTestData>;

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
    testData = createTestData();

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
      .send({ email: testData.email, password: 'pass123', name: 'Owner' })
      .expect(201);
    await agent
      .post('/auth/login')
      .send({ email: testData.email, password: 'pass123' })
      .expect(200);

    const emailB = `other-${testData.id}@e2e.com`;
    const regB = await agent
      .post('/auth/register')
      .send({ email: emailB, password: 'pass123', name: 'Other' })
      .expect(201);
    tokenB = (regB.body as { access_token: string }).access_token;

    // Re-login as User A so agent cookie is set to User A
    await agent
      .post('/auth/login')
      .send({ email: testData.email, password: 'pass123' })
      .expect(200);

    const wsRes = await agent
      .post('/workspaces')
      .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
      .expect(201);
    const workspaceId = (wsRes.body as { id: string }).id;
    const projRes = await agent
      .post('/projects')
      .send({ name: testData.projectName, workspaceId })
      .expect(201);
    projectId = (projRes.body as { id: string }).id;
  }, 30000);

  it('should create a task', async () => {
    const response = await agent
      .post('/tasks')
      .send({
        title: testData.taskTitle,
        description: 'Test task',
        projectId,
        priority: 'HIGH',
      })
      .expect(201);
    expect(response.body).toHaveProperty('id');
    expect((response.body as { title: string }).title).toBe(testData.taskTitle);
  });

  it('should update task status', async () => {
    const createRes = await agent
      .post('/tasks')
      .send({ title: testData.taskTitle, projectId });
    const taskId = (createRes.body as { id: string }).id;
    const updateRes = await agent
      .patch(`/tasks/${taskId}/status`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect((updateRes.body as { status: string }).status).toBe('IN_PROGRESS');
  });

  describe('RBAC enforcement', () => {
    it('should deny task status update by user without required role (403)', async () => {
      const createRes = await agent
        .post('/tasks')
        .send({ title: testData.taskTitle, projectId })
        .expect(201);
      const taskId = (createRes.body as { id: string }).id;

      await request(server)
        .patch(`/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(403);
    });
  });

  describe('Data integrity', () => {
    it('should soft-delete task and verify deletedAt is set', async () => {
      const createRes = await agent
        .post('/tasks')
        .send({ title: testData.taskTitle, projectId })
        .expect(201);
      const taskId = (createRes.body as { id: string }).id;

      const deleteRes = await agent.delete(`/tasks/${taskId}`).expect(200);
      expect((deleteRes.body as { message: string }).message).toBe(
        'Task deleted successfully',
      );

      // Verify soft delete via Prisma
      const dbTask = await prisma.task.findUnique({
        where: { id: taskId },
      });
      expect(dbTask).not.toBeNull();
      expect(dbTask!.deletedAt).not.toBeNull();
    });
  });
});
