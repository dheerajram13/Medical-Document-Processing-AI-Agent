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
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
