import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);
  const defaultOrigins = [
    'http://localhost:3002',
    'http://localhost:3001',
    'http://localhost:3000',
  ];
  const allowedOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

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

      callback(null, isAllowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
