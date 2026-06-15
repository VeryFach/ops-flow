import { Controller, Get, Post, Body, HttpStatus, Res } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import type { Response } from 'express';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get('test')
  async test(@Res() res: Response) {
    const result = await this.telegramService.testConnection();
    if (result.success) {
      return res.status(HttpStatus.OK).json({
        message: 'Test message sent to Telegram successfully',
      });
    } else {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: `Failed: ${result.error}`,
      });
    }
  }

  @Post('send')
  async sendCustom(@Body('text') text: string, @Res() res: Response) {
    if (!text) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message: 'Text is required',
      });
    }
    const result = await this.telegramService.sendMessage(text);
    return res.status(HttpStatus.OK).json({
      ok: result.ok,
      description: 'Message sent',
    });
  }

  @Get('updates')
  async getUpdates(@Res() res: Response) {
    const result = await this.telegramService.getUpdates();
    return res.status(HttpStatus.OK).json(result);
  }
}
