import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        config: ConfigService,
        private prisma: PrismaService,
    ) {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is not defined');
        }

        super({
            jwtFromRequest: (req: Request) => {
                // 1. Get token from cookie
                const cookieToken = req?.cookies?.['cookie_token'];
                if (cookieToken) return cookieToken;

                // 2. Fallback Authorization: Bearer header
                return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
            },
            secretOrKey: secret,
        });
    }

    async validate(payload: { sub: string; email: string }) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user) {
            return null;
        }

        // Remove hash from the user object before attaching to request
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
}