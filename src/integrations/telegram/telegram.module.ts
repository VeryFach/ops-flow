import { Module } from '@nestjs/common';
import { TelegramService } from '../../modules/notifications/telegram.service';

@Module({
    providers: [TelegramService],
    exports: [TelegramService],
})
export class TelegramModule {}