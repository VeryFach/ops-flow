import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
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
        type CookieRequest = Omit<Request, 'cookies'> & {
          cookies?: Record<string, string>;
        };
        const cookies = (req as CookieRequest).cookies;
        const cookieToken = cookies?.['cookie_token'];
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
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  }
}
