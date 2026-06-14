import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

describe('AuthController', () => {
    let controller: AuthController;
    let service: AuthService;

    const mockAuthService = {
        register: jest.fn(),
        login: jest.fn(),
    };

    // Mock Response object
    const mockResponse = () => {
        const res: any = {};
        res.cookie = jest.fn().mockReturnValue(res);
        res.clearCookie = jest.fn().mockReturnValue(res);
        return res;
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
        service = module.get<AuthService>(AuthService);
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
            const res = mockResponse();

            const result = await controller.register(registerDto, res);

            expect(result).toEqual(mockToken);
            expect(res.cookie).toHaveBeenCalled();
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
            const res = mockResponse();

            const result = await controller.login(loginDto, res);

            expect(result).toEqual(mockToken);
            expect(res.cookie).toHaveBeenCalled();
            expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
        });
    });

    describe('logout', () => {
        it('should clear cookie and return success message', async () => {
            const res = mockResponse();

            const result = await controller.logout(res);

            expect(result).toEqual({ message: 'Logged out successfully' });
            expect(res.clearCookie).toHaveBeenCalled();
        });
    });
});