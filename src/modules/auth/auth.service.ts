import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwt: JwtService,
        private config: ConfigService,
    ) { }

    async register(dto: RegisterDto) {
        const passwordHash = await argon2.hash(dto.password);
        try {
            const name = dto.name || 'Anonymous User';
            const user = await this.prisma.user.create({
                data: {
                    email: dto.email,
                    name: name,
                    password : passwordHash,
                    role: UserRole.USER,
                },
            });

            return this.signToken(user.id, user.email, user.role);
        } catch (error) {
            if (
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 'P2002'
            ) {
                throw new ForbiddenException('Email already in use');
            }
            throw error;
        }
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) throw new ForbiddenException('Invalid credentials');
        const passwordValid = await argon2.verify(user.password, dto.password);
        if (!passwordValid) throw new ForbiddenException('Invalid credentials');
        return this.signToken(user.id, user.email, user.role);
    }

    async signToken(
        userId: string,
        email: string,
        role: UserRole,
    ): Promise<{ access_token: string }> {
        const payload = {
            sub: userId,
            email,
            role,            // masukkan role ke payload
        };
        const secret = this.config.get<string>('JWT_SECRET');
        const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') || '1d';
        const token = await this.jwt.signAsync(payload, {
            expiresIn: expiresIn as any,
            secret,
        });
        return { access_token: token };
    }
}