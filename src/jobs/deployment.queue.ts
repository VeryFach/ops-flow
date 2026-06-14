// src/jobs/deployment.queue.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../modules/prisma/prisma.service';
import { TelegramService } from '../modules/notifications/telegram.service';
import { DeploymentStatus } from '@prisma/client';

interface DeploymentJobData {
    deploymentId: string;
    userId: string;
    version: string;
    projectId: string;
    taskIds: string[];
}

@Injectable()
export class DeploymentQueue implements OnModuleInit {
    private queue: Queue;
    private worker!: Worker;

    constructor(
        private prisma: PrismaService,
        private telegram: TelegramService,
    ) {
        this.queue = new Queue('deployments', {
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
        });
    }

    async onModuleInit() {
        this.worker = new Worker(
            'deployments',
            async (job: Job<DeploymentJobData>) => {
                return this.processDeployment(job.data);
            },
            {
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379', 10),
                },
            },
        );

        this.worker.on('completed', (job) => {
            console.log(`Deployment job ${job.id} completed`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`Deployment job ${job?.id} failed:`, err);
        });
    }

    async addDeployment(data: DeploymentJobData): Promise<string> {
        const job = await this.queue.add('deploy', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });
        return job.id ?? '';
    }

    private async processDeployment(data: DeploymentJobData) {
        const { deploymentId, version, projectId, taskIds } = data;

        try {
            // Update status to RUNNING
            await this.prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.RUNNING },
            });

            // Simulate build process
            await this.delay(5000);

            // Simulate deployment process
            await this.delay(5000);

            // Update status to SUCCESS
            await this.prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.SUCCESS },
            });

            // Update task statuses
            if (taskIds && taskIds.length > 0) {
                await this.prisma.task.updateMany({
                    where: { id: { in: taskIds } },
                    data: { status: 'DONE' },
                });
            }

            // Send success notification
            await this.telegram.sendMessage(
                `✅ Deployment ${version} for project ${projectId} completed successfully!`,
            );

            return { success: true, deploymentId };
        } catch (error) {
            // Update status to FAILED
            await this.prisma.deployment.update({
                where: { id: deploymentId },
                data: { status: DeploymentStatus.FAILED },
            });

            // Send failure notification
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.telegram.sendMessage(
                `❌ Deployment ${version} for project ${projectId} failed: ${errorMessage}`,
            );

            throw error;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async getJobStatus(jobId: string) {
        const job = await this.queue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        return {
            id: job.id,
            state,
            progress: job.progress,
            returnvalue: job.returnvalue,
            failedReason: job.failedReason,
        };
    }
}