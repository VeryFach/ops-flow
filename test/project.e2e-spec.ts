import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Project E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let workspaceId: string;
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

    const wsRes = await agent
      .post('/workspaces')
      .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
      .expect(201);
    workspaceId = (wsRes.body as { id: string }).id;
  }, 30000);

  it('should create a project', async () => {
    const response = await agent
      .post('/projects')
      .send({
        name: testData.projectName,
        description: 'Test project',
        workspaceId,
      })
      .expect(201);
    expect(response.body).toHaveProperty('id');
    expect((response.body as { name: string }).name).toBe(testData.projectName);
  });

  it('should get all projects', async () => {
    await agent
      .post('/projects')
      .send({ name: testData.projectName, workspaceId });
    const response = await agent.get('/projects').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect((response.body as unknown[]).length).toBeGreaterThan(0);
  });
});
