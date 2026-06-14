import { Controller, Get, Post, Body } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import axios from 'axios'

@Controller('telegram')
export class TelegramController {
    constructor(private readonly telegramService: TelegramService) { }

    @Get('test')
    async test() {
        const result = await this.telegramService.testConnection();
        if (result.success) {
            return { message: 'Test message sent to Telegram successfully' };
        } else {
            return { message: `Failed: ${result.error}` };
        }
    }

    @Post('send')
    async sendCustom(@Body('text') text: string) {
        const result = await this.telegramService.sendMessage(text);
        return { ok: result.ok, description: 'Message sent' };
    }

    @Get('updates')
    async getUpdates() {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`;
        const response = await axios.get(url);
        return response.data;
    }
}