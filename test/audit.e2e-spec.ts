import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AuditAction } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Audit E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let server: Server;
  let testData: ReturnType<typeof createTestData>;
  let workspaceId: string;
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
    testData = createTestData();

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

    const userRes = await agent.get('/users/me').expect(200);
    userId = (userRes.body as { id: string }).id;

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

  it('should return audit logs with pagination', async () => {
    // Insert audit logs directly via Prisma
    await prisma.auditLog.createMany({
      data: [
        {
          action: AuditAction.CREATE,
          entity: 'Workspace',
          entityId: workspaceId,
          userId,
          workspaceId,
        },
        {
          action: AuditAction.UPDATE,
          entity: 'Workspace',
          entityId: workspaceId,
          userId,
          workspaceId,
        },
      ],
    });

    const response = await agent
      .get('/audit')
      .query({ workspaceId })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
    expect(Array.isArray((response.body as { data: unknown[] }).data)).toBe(
      true,
    );
    expect((response.body as { data: unknown[] }).data.length).toBe(2);

    const meta = (response.body as { meta: { total: number } }).meta;
    expect(meta.total).toBe(2);
  });

  it('should query audit logs by entity', async () => {
    const projRes = await agent
      .post('/projects')
      .send({ name: testData.projectName, workspaceId })
      .expect(201);
    const projectId = (projRes.body as { id: string }).id;

    await prisma.auditLog.createMany({
      data: [
        {
          action: AuditAction.CREATE,
          entity: 'Workspace',
          entityId: workspaceId,
          userId,
          workspaceId,
        },
        {
          action: AuditAction.CREATE,
          entity: 'Project',
          entityId: projectId,
          userId,
          workspaceId,
        },
      ],
    });

    const response = await agent
      .get(`/audit/entity/Workspace/${workspaceId}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const logs = response.body as Array<{ entity: string }>;
    expect(logs.length).toBe(1);
    expect(logs[0].entity).toBe('Workspace');
  });
});
