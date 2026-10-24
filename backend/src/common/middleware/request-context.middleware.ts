import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithRequestContext } from '../context/request-context';
import { runWithTenant } from '../context/tenant-context';
import { isAccessTokenPayload } from '../auth/authenticated-user';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
    res.setHeader('x-request-id', requestId);
    runWithRequestContext(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip ?? null,
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
      },
      () => next(),
    );
  }
}

/**
 * Establishes the lab context for the whole request lifetime. The tenant is read
 * from a verified access token only; no header or body value can switch labs.
 * The JWT guard runs later and performs the authoritative user lookup.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    try {
      const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload = verify(token, secret);
      if (!isAccessTokenPayload(payload)) {
        next();
        return;
      }
      runWithTenant(
        {
          labId: payload.labId,
          userId: payload.sub,
          userName: payload.name,
          userRole: payload.role,
        },
        () => next(),
      );
    } catch {
      // Expired or malformed tokens are rejected by the auth guard, not here.
      next();
    }
  }
}
