import { PrismaService } from '../../src/modules/prisma/prisma.service';

export async function cleanupDatabase(prisma: PrismaService) {
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
}