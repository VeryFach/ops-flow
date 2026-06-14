import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';

// Mock argon2
jest.mock('argon2');
const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('AuthService', () => {
    let service: AuthService;
    let prisma: PrismaService;
    let jwt: JwtService;

    const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedPassword123',
        role: UserRole.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    };

    const mockToken = { access_token: 'jwt-token-123' };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: PrismaService,
                    useValue: {
                        user: {
                            findUnique: jest.fn(),
                            create: jest.fn(),
                        },
                    },
                },
                {
                    provide: JwtService,
                    useValue: {
                        signAsync: jest.fn().mockResolvedValue('jwt-token-123'),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            if (key === 'JWT_SECRET') return 'test-secret';
                            if (key === 'JWT_EXPIRES_IN') return '1d';
                            return null;
                        }),
                    },
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        prisma = module.get<PrismaService>(PrismaService);
        jwt = module.get<JwtService>(JwtService);
    });

    describe('register', () => {
        const registerDto = {
            email: 'new@example.com',
            password: 'password123',
            name: 'New User',
        };

        it('should register a new user successfully', async () => {
            mockedArgon2.hash.mockResolvedValue('hashedPassword' as never);
            (prisma.user.create as jest.Mock).mockResolvedValue({
                ...mockUser,
                email: registerDto.email,
                name: registerDto.name,
            });

            const result = await service.register(registerDto);

            expect(result).toEqual(mockToken);
            expect(prisma.user.create).toHaveBeenCalledWith({
                data: {
                    email: registerDto.email,
                    name: registerDto.name,
                    password: 'hashedPassword',
                    role: UserRole.USER,
                },
            });
        });

        it('should throw ForbiddenException if email already exists', async () => {
            mockedArgon2.hash.mockResolvedValue('hashedPassword' as never);
            const prismaError = { code: 'P2002' };
            (prisma.user.create as jest.Mock).mockRejectedValue(prismaError);

            await expect(service.register(registerDto)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('login', () => {
        const loginDto = {
            email: 'test@example.com',
            password: 'password123',
        };

        it('should login successfully with valid credentials', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
            mockedArgon2.verify.mockResolvedValue(true as never);

            const result = await service.login(loginDto);

            expect(result).toEqual(mockToken);
            expect(prisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: loginDto.email },
            });
        });

        it('should throw ForbiddenException if user not found', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

            await expect(service.login(loginDto)).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('should throw ForbiddenException if password is invalid', async () => {
            (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
            mockedArgon2.verify.mockResolvedValue(false as never);

            await expect(service.login(loginDto)).rejects.toThrow(
                ForbiddenException,
            );
        });
    });

    describe('signToken', () => {
        it('should generate a valid JWT token', async () => {
            const result = await service.signToken(
                mockUser.id,
                mockUser.email,
                mockUser.role,
            );

            expect(result).toEqual(mockToken);
            expect(jwt.signAsync).toHaveBeenCalledWith(
                {
                    sub: mockUser.id,
                    email: mockUser.email,
                    role: mockUser.role,
                },
                {
                    expiresIn: '1d',
                    secret: 'test-secret',
                },
            );
        });
    });
});