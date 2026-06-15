import { Injectable } from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import { ConfigService } from '@nestjs/config';

interface TelegramMessageResponse {
  ok: boolean;
  result: Record<string, unknown>;
}

interface TelegramUpdate {
  update_id: number;
  message?: Record<string, unknown>;
}

@Injectable()
export class TelegramService {
  private botToken: string;
  private chatId: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') ?? '';
  }

  async sendMessage(text: string): Promise<TelegramMessageResponse> {
    if (!this.botToken || !this.chatId) {
      throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing');
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: this.chatId,
      text: text,
      parse_mode: 'HTML',
    };

    try {
      const response = await axios.post<TelegramMessageResponse>(url, payload);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Telegram send error:',
          error.response?.data || error.message,
        );
      } else if (error instanceof Error) {
        console.error('Telegram send error:', error.message);
      } else {
        console.error('Telegram send error:', error);
      }
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sendMessage('Hidup Jokowi!!!!');
      return { success: true };
    } catch (error) {
      let errorDetail = 'Unknown error';
      if (isAxiosError(error) && error.response?.data) {
        errorDetail = JSON.stringify(error.response.data);
      } else if (error instanceof Error) {
        errorDetail = error.message;
      }
      console.error('Telegram test error:', errorDetail);
      return { success: false, error: errorDetail };
    }
  }

  async getBotInfo() {
    const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
    const response = await axios.get<TelegramMessageResponse>(url);
    return response.data;
  }

  // ✅ TAMBAHKAN METHOD INI
  async getUpdates(): Promise<TelegramUpdate[]> {
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is missing');
    }

    const url = `https://api.telegram.org/bot${this.botToken}/getUpdates`;

    try {
      const response = await axios.get<{ result: TelegramUpdate[] }>(url);
      return response.data.result;
    } catch (error) {
      if (isAxiosError(error)) {
        console.error(
          'Telegram getUpdates error:',
          error.response?.data || error.message,
        );
      } else if (error instanceof Error) {
        console.error('Telegram getUpdates error:', error.message);
      } else {
        console.error('Telegram getUpdates error:', error);
      }
      throw error;
    }
  }
}
