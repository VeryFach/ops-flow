import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { DeploymentStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Deployment E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let server: Server;
  let testData: ReturnType<typeof createTestData>;
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
    testData = createTestData();

    // Clean up all tables
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
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.com' } } });

    // Register and login
    await agent
      .post('/auth/register')
      .send({ email: testData.email, password: 'pass123', name: 'Owner' })
      .expect(201);

    await agent
      .post('/auth/login')
      .send({ email: testData.email, password: 'pass123' })
      .expect(200);

    // Create workspace
    const wsRes = await agent
      .post('/workspaces')
      .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
      .expect(201);
    const workspaceId = (wsRes.body as { id: string }).id;

    // Create project
    const projRes = await agent
      .post('/projects')
      .send({ name: testData.projectName, workspaceId })
      .expect(201);
    projectId = (projRes.body as { id: string }).id;

    // Create task
    const taskRes = await agent
      .post('/tasks')
      .send({ title: testData.taskTitle, projectId })
      .expect(201);
    taskId = (taskRes.body as { id: string }).id;
  }, 30000);

  it('should create a deployment', async () => {
    const response = await agent
      .post('/deployments')
      .send({
        version: 'v1.0.0',
        projectId,
        taskIds: [taskId],
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect((response.body as { version: string }).version).toBe('v1.0.0');
    expect((response.body as { status: string }).status).toBe(DeploymentStatus.PENDING);
  });

  it('should get deployment by id', async () => {
    const createRes = await agent
      .post('/deployments')
      .send({ version: 'v1.0.0', projectId })
      .expect(201);
    const deploymentId = (createRes.body as { id: string }).id;

    const getRes = await agent
      .get(`/deployments/${deploymentId}`)
      .expect(200);
    expect((getRes.body as { id: string }).id).toBe(deploymentId);
  });

  it('should list deployments for project', async () => {
    await agent
      .post('/deployments')
      .send({ version: 'v1.0.0', projectId })
      .expect(201);

    const listRes = await agent
      .get('/deployments')
      .query({ projectId })
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect((listRes.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('should update deployment status', async () => {
    const createRes = await agent
      .post('/deployments')
      .send({ version: 'v1.0.0', projectId })
      .expect(201);
    const deploymentId = (createRes.body as { id: string }).id;

    const updateRes = await agent
      .patch(`/deployments/${deploymentId}/status`)
      .send({ status: DeploymentStatus.RUNNING })
      .expect(200);

    expect((updateRes.body as { status: string }).status).toBe(DeploymentStatus.RUNNING);
  });

  it('should delete deployment', async () => {
    const createRes = await agent
      .post('/deployments')
      .send({ version: 'v1.0.0', projectId })
      .expect(201);
    const deploymentId = (createRes.body as { id: string }).id;

    const deleteRes = await agent
      .delete(`/deployments/${deploymentId}`)
      .expect(200);

    expect((deleteRes.body as { message: string }).message).toBe('Deployment deleted successfully');

    // Verify deployment is removed from DB
    const dbDeployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });
    expect(dbDeployment).toBeNull();
  });
});