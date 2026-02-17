import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { ObservabilityService } from './modules/observability/observability.service';

function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isAllowedByPattern(origin: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return origin === pattern;
  }

  // Support simple wildcard patterns like:
  // https://*.vercel.app
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(origin);
}

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function normalizeRequestPath(url: string | undefined): string {
  const basePath = (url || '/').split('?')[0] || '/';
  return basePath
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      ':id',
    )
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const observabilityService = app.get(ObservabilityService);

  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const defaultOrigins = [
    'http://localhost:3002',
    'http://localhost:3001',
    'http://localhost:3000',
  ];
  const allowedOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;
  logger.log(`CORS allowlist configured: ${allowedOrigins.join(', ')}`);

  // Enable CORS for frontend
  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server and same-origin requests with no Origin header.
      if (!origin) {
        callback(null, true);
        return;
      }

      const isAllowed = allowedOrigins.some((allowed) =>
        isAllowedByPattern(origin, allowed),
      );
      if (!isAllowed) {
        logger.warn(`Blocked CORS origin: ${origin}`);
      }

      callback(null, isAllowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  const requestLoggingEnabled = parseBooleanFlag(
    process.env.REQUEST_LOGGING_ENABLED,
    true,
  );

  if (requestLoggingEnabled) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      const startedAt = process.hrtime.bigint();
      const requestIdHeader = request.headers['x-request-id'];
      const requestId =
        typeof requestIdHeader === 'string' && requestIdHeader.trim().length > 0
          ? requestIdHeader.trim()
          : randomUUID();
      response.setHeader('x-request-id', requestId);

      response.on('finish', () => {
        const endedAt = process.hrtime.bigint();
        const durationMs = Number(endedAt - startedAt) / 1_000_000;
        const normalizedPath = normalizeRequestPath(
          request.originalUrl || request.url,
        );

        logger.log(
          `HTTP ${request.method} ${normalizedPath} ${response.statusCode} ${durationMs.toFixed(1)}ms requestId=${requestId}`,
        );
        observabilityService.recordHttpRequest(
          request.method,
          normalizedPath,
          response.statusCode,
          durationMs,
        );
      });

      next();
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
