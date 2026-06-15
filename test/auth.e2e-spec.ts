import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
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
  }, 30000);

  const getPassword = () => 'password123';

  it('should register a new user', async () => {
    const response = await agent
      .post('/auth/register')
      .send({
        email: testData.email,
        password: getPassword(),
        name: 'E2E User',
      })
      .expect(201);
    expect(response.body).toHaveProperty('access_token');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('should login with registered user', async () => {
    await agent.post('/auth/register').send({
      email: testData.email,
      password: getPassword(),
      name: 'E2E User',
    });
    const loginResponse = await agent
      .post('/auth/login')
      .send({ email: testData.email, password: getPassword() })
      .expect(200);
    expect(loginResponse.body).toHaveProperty('access_token');
    expect(loginResponse.headers['set-cookie']).toBeDefined();
  });

  it('should logout and clear cookie', async () => {
    await agent.post('/auth/register').send({
      email: testData.email,
      password: getPassword(),
      name: 'E2E User',
    });
    const loginRes = await agent
      .post('/auth/login')
      .send({ email: testData.email, password: getPassword() });
    const cookie = loginRes.headers['set-cookie'];
    const logoutRes = await request(server)
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(200);
    expect((logoutRes.body as { message: string }).message).toBe(
      'Logged out successfully',
    );
    expect(logoutRes.headers['set-cookie'][0]).toMatch(/cookie_token=;/);
  });
});
