import {
  Res,
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { Response, CookieOptions } from 'express';

/** Opsi default untuk cookie autentikasi */
const COOKIE_NAME = 'cookie_token';
const COOKIE_SAME_SITE: 'none' | 'lax' =
  process.env.NODE_ENV === 'production' ? 'none' : 'lax';
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 1 hari (ms)
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint untuk mendaftarkan user baru menggunakan email dan password.
   */
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 403, description: 'Email already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenData = await this.authService.register(dto);
    res.cookie(COOKIE_NAME, tokenData.access_token, COOKIE_OPTIONS);
    return tokenData;
  }

  /**
   * Endpoint untuk login menggunakan email dan password. Mengembalikan JWT token.
   */
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT' })
  @ApiResponse({ status: 403, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokenData = await this.authService.login(dto);
    res.cookie(COOKIE_NAME, tokenData.access_token, COOKIE_OPTIONS);
    return tokenData;
  }

  /**
   * Endpoint untuk logout.
   * Menghapus cookie autentikasi dan mengembalikan pesan sukses.
   */
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: COOKIE_SAME_SITE,
      path: '/',
    });
    return { message: 'Logged out successfully' };
  }
}
