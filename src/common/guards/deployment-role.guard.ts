import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { DEPLOYMENT_ROLES_KEY } from '../decorators/deployment-roles.decorator';

@Injectable()
export class DeploymentRoleGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.getAllAndOverride<string[]>(
            DEPLOYMENT_ROLES_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const deploymentId = request.params.deploymentId;

        if (!user) {
            throw new ForbiddenException('User not authenticated');
        }

        // If deploymentId exists, check specific deployment access
        if (deploymentId) {
            const deployment = await this.prisma.deployment.findUnique({
                where: { id: deploymentId },
                include: {
                    project: {
                        include: {
                            projectMembers: true,
                            workspace: true,
                        },
                    },
                },
            });

            if (!deployment) {
                throw new NotFoundException('Deployment not found');
            }

            const isProjectAdmin = deployment.project.projectMembers.some(
                m => m.userId === user.id && m.role === 'ADMIN'
            );

            const isWorkspaceAdmin = await this.prisma.workspaceMember.findFirst({
                where: {
                    workspaceId: deployment.project.workspaceId!,
                    userId: user.id,
                    role: { in: ['OWNER', 'ADMIN'] },
                },
            });

            const hasRequiredRole = requiredRoles.some(role => {
                if (role === 'PROJECT_ADMIN' && isProjectAdmin) return true;
                if (role === 'WORKSPACE_ADMIN' && isWorkspaceAdmin) return true;
                return false;
            });

            if (!hasRequiredRole) {
                throw new ForbiddenException('You do not have permission to manage this deployment');
            }
        }

        return true;
    }
}