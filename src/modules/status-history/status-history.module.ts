import { Module } from '@nestjs/common';
import { StatusHistoryService } from './status-history.service';
import { StatusHistoryController } from './status-history.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [StatusHistoryController],
    providers: [StatusHistoryService],
    exports: [StatusHistoryService],
})
export class StatusHistoryModule { }