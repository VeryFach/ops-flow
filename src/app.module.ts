import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TelegramModule } from './modules/notifications/telegram.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { AuditModule } from './modules/audit/audit.module';
import { StatusHistoryModule } from './modules/status-history/status-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ProjectsModule,
    TasksModule,
    TelegramModule,
    DeploymentsModule,
    AuditModule,
    StatusHistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
