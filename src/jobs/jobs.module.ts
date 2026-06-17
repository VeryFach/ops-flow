import { Module } from '@nestjs/common';
import { DeploymentQueue } from './deployment.queue';
import { TelegramModule } from '../modules/notifications/telegram.module';

@Module({
  imports: [TelegramModule],
  providers: [DeploymentQueue],
  exports: [DeploymentQueue],
})
export class JobsModule {}
