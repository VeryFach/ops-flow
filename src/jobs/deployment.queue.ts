// src/jobs/deployment.queue.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../modules/prisma/prisma.service';
import { TelegramService } from '../modules/notifications/telegram.service';
import { DeploymentStatus } from '@prisma/client';

export interface DeploymentJobData {
  deploymentId: string;
  userId: string;
  version: string;
  projectId: string;
  taskIds: string[];
}

@Injectable()
export class DeploymentQueue implements OnModuleInit {
  private queue: Queue<DeploymentJobData> | null = null;
  private worker: Worker<DeploymentJobData> | null = null;

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };

    this.queue = new Queue<DeploymentJobData>('deployments', { connection });

    this.worker = new Worker<DeploymentJobData>(
      'deployments',
      async (job: Job<DeploymentJobData>) => {
        return this.processDeployment(job.data);
      },
      { connection },
    );

    this.worker.on('completed', (job) => {
      console.log(`Deployment job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`Deployment job ${job?.id} failed:`, err);
    });
  }

  async addDeployment(data: DeploymentJobData): Promise<string> {
    if (!this.queue) return '';
    const job = await this.queue.add('deploy', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    return job.id ?? '';
  }

  async getJobStatus(jobId: string) {
    if (!this.queue) return null;
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      returnvalue: job.returnvalue as unknown,
      failedReason: job.failedReason,
    };
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
      await this.delay(2000);

      // Simulate deployment process
      await this.delay(3000);

      // Update status to SUCCESS
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: DeploymentStatus.SUCCESS },
      });

      // Update linked task statuses to DONE
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
      await this.prisma.deployment
        .update({
          where: { id: deploymentId },
          data: { status: DeploymentStatus.FAILED },
        })
        .catch((e: unknown) => {
          console.error('Failed to update deployment to FAILED:', e);
        });

      // Send failure notification
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await this.telegram
        .sendMessage(
          `❌ Deployment ${version} for project ${projectId} failed: ${errorMessage}`,
        )
        .catch((e: unknown) => {
          console.error('Failed to send failure notification:', e);
        });

      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
