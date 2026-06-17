import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLogService } from './audit-log.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

@Global() // Make audit services available globally
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditLogService, AuditInterceptor],
  exports: [AuditService, AuditLogService, AuditInterceptor],
})
export class AuditModule {}
