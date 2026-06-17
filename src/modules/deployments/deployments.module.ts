import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { DeploymentsController } from './deployments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../notifications/telegram.module';
import { JobsModule } from '../../jobs/jobs.module';

@Module({
  imports: [PrismaModule, TelegramModule, JobsModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
