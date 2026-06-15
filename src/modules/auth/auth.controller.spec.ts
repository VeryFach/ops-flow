import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import type { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  // Mock Response object
  const mockResponse = () => {
    const cookieFn = jest.fn();
    const clearCookieFn = jest.fn();
    const res = {
      cookie: cookieFn,
      clearCookie: clearCookieFn,
    };
    cookieFn.mockReturnValue(res);
    clearCookieFn.mockReturnValue(res);
    return { res, cookieFn, clearCookieFn };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    };

    it('should register a user and set cookie', async () => {
      const mockToken = { access_token: 'jwt-token' };
      mockAuthService.register.mockResolvedValue(mockToken);
      const { res, cookieFn } = mockResponse();

      const result = await controller.register(
        registerDto,
        res as unknown as Response,
      );

      expect(result).toEqual(mockToken);
      expect(cookieFn).toHaveBeenCalled();
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('should login user and set cookie', async () => {
      const mockToken = { access_token: 'jwt-token' };
      mockAuthService.login.mockResolvedValue(mockToken);
      const { res, cookieFn } = mockResponse();

      const result = await controller.login(
        loginDto,
        res as unknown as Response,
      );

      expect(result).toEqual(mockToken);
      expect(cookieFn).toHaveBeenCalled();
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success message', () => {
      const { res, clearCookieFn } = mockResponse();

      const result = controller.logout(res as unknown as Response);

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(clearCookieFn).toHaveBeenCalled();
    });
  });
});
