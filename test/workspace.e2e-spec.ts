import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { Server } from 'http';
import { WorkspaceMemberRole } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { createTestData } from './helpers/test-data';

describe('Workspace E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;
  let server: Server;
  let testData: ReturnType<typeof createTestData>;
  let tokenB: string;

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
  }, 30000);

  it('should create a workspace', async () => {
    const response = await agent
      .post('/workspaces')
      .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
      .expect(201);
    expect(response.body).toHaveProperty('id');
    expect((response.body as { name: string }).name).toBe(
      testData.workspaceName,
    );
  });

  it('should get all workspaces for user', async () => {
    await agent
      .post('/workspaces')
      .send({ name: testData.workspaceName, slug: testData.workspaceSlug });
    const response = await agent.get('/workspaces').expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect((response.body as unknown[]).length).toBeGreaterThan(0);
  });

  it('should get workspace by id', async () => {
    const createRes = await agent
      .post('/workspaces')
      .send({ name: testData.workspaceName, slug: testData.workspaceSlug });
    const workspaceId = (createRes.body as { id: string }).id;
    const getRes = await agent.get(`/workspaces/${workspaceId}`).expect(200);
    expect((getRes.body as { id: string }).id).toBe(workspaceId);
  });

  describe('RBAC enforcement', () => {
    it('should deny non-member from adding members to workspace (404)', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      await request(server)
        .post(`/workspaces/${workspaceId}/members`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          userId: 'nonexistent-user-id',
          role: WorkspaceMemberRole.ENGINEER,
        })
        .expect(404);
    });

    it('should deny cross-workspace access (404)', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      await request(server)
        .get(`/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe('Data integrity', () => {
    it('should update workspace name and persist change', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      const newName = 'Updated Workspace Name';
      const updateRes = await agent
        .patch(`/workspaces/${workspaceId}`)
        .send({ name: newName })
        .expect(200);
      expect((updateRes.body as { name: string }).name).toBe(newName);

      // Verify persistence via Prisma
      const dbWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      expect(dbWorkspace).not.toBeNull();
      expect(dbWorkspace!.name).toBe(newName);
    });

    it('should soft-delete workspace (sets deletedAt)', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      const deleteRes = await agent
        .delete(`/workspaces/${workspaceId}`)
        .expect(200);
      expect((deleteRes.body as { message: string }).message).toBe(
        'Workspace deleted successfully',
      );

      // Verify soft delete via Prisma
      const dbWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      expect(dbWorkspace).not.toBeNull();
      expect(dbWorkspace!.deletedAt).not.toBeNull();
    });

    it('should deny non-owner from deleting workspace (403)', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      // Add User B as ENGINEER so they pass WorkspaceRoleGuard
      const userB = await prisma.user.findFirst({
        where: { email: `other-${testData.id}@e2e.com` },
      });
      await agent
        .post(`/workspaces/${workspaceId}/members`)
        .send({ userId: userB!.id, role: WorkspaceMemberRole.ENGINEER })
        .expect(201);

      // User B is a member but NOT the owner → 403
      await request(server)
        .delete(`/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);

      // Verify workspace is NOT soft-deleted
      const dbWorkspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      });
      expect(dbWorkspace!.deletedAt).toBeNull();
    });

    it('should add member to workspace and verify in DB', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      const userB = await prisma.user.findFirst({
        where: { email: `other-${testData.id}@e2e.com` },
      });

      await agent
        .post(`/workspaces/${workspaceId}/members`)
        .send({ userId: userB!.id, role: WorkspaceMemberRole.ENGINEER })
        .expect(201);

      // Verify membership in DB
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: userB!.id },
        },
      });
      expect(member).not.toBeNull();
      expect(member!.role).toBe(WorkspaceMemberRole.ENGINEER);
    });

    it('should remove member from workspace and verify in DB', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      const userB = await prisma.user.findFirst({
        where: { email: `other-${testData.id}@e2e.com` },
      });

      await agent
        .post(`/workspaces/${workspaceId}/members`)
        .send({ userId: userB!.id, role: WorkspaceMemberRole.ENGINEER })
        .expect(201);

      // Remove User B
      await agent
        .delete(`/workspaces/${workspaceId}/members/${userB!.id}`)
        .expect(200);

      // Verify membership removed from DB
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: userB!.id },
        },
      });
      expect(member).toBeNull();
    });

    it('should not allow removing the workspace owner', async () => {
      const wsRes = await agent
        .post('/workspaces')
        .send({ name: testData.workspaceName, slug: testData.workspaceSlug })
        .expect(201);
      const workspaceId = (wsRes.body as { id: string }).id;

      // Get the owner's userId
      const owner = await prisma.user.findFirst({
        where: { email: testData.email },
      });

      // Add User B as ADMIN so they have permission to remove members
      const userB = await prisma.user.findFirst({
        where: { email: `other-${testData.id}@e2e.com` },
      });
      await agent
        .post(`/workspaces/${workspaceId}/members`)
        .send({ userId: userB!.id, role: WorkspaceMemberRole.ADMIN })
        .expect(201);

      // User B (ADMIN) tries to remove the owner → 403
      await request(server)
        .delete(`/workspaces/${workspaceId}/members/${owner!.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);

      // Verify owner membership still exists
      const ownerMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: owner!.id },
        },
      });
      expect(ownerMember).not.toBeNull();
    });
  });
});
