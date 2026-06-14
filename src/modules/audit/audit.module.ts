import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

@Global() // Make audit service available globally
@Module({
    imports: [PrismaModule],
    controllers: [AuditController],
    providers: [AuditService, AuditInterceptor],
    exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}