import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { getConnectionToken } from '@nestjs/mongoose';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import type { Connection } from 'mongoose';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const port = config.get<number>('API_PORT') ?? 4000;
  const prefix = config.get<string>('API_PREFIX') ?? 'api';
  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.set('trust proxy', 1);
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }),
  );
  app.use(compression());
  app.enableCors({
    origin: origins,
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'Content-Disposition'],
    maxAge: 86_400,
  });
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
      stopAtFirstError: false,
    }),
  );
  app.enableShutdownHooks();

  if (config.get<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Histopathology LIMS API')
      .setDescription(
        [
          'Block-and-slide level laboratory information management for hospital histopathology departments.',
          '',
          '**Tenancy** — every authenticated request is scoped to the laboratory in the JWT. There is no labId parameter.',
          '',
          '**Custody** — status is derived from immutable scan events through a state machine. Invalid transitions return 409 with the allowed next states.',
          '',
          '**Sign-out** — reports lock after sign-out; changes require an amendment and create a new immutable version.',
        ].join('\n'),
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token' },
        'bearer',
      )
      .addServer(`/${prefix}`)
      .addTag('Auth')
      .addTag('Cases')
      .addTag('Custody')
      .addTag('Reports')
      .addTag('Worklist')
      .addTag('Dashboard')
      .addTag('Labels')
      .addTag('Protocols')
      .addTag('Users')
      .addTag('Laboratories')
      .addTag('Audit')
      .addTag('Maintenance')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      deepScanRoutes: true,
    });
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
      customSiteTitle: 'Histopathology LIMS API',
    });
  }

  try {
    const connection = app.get<Connection>(getConnectionToken());
    const admin = connection.db?.admin();
    if (admin) {
      const hello = (await admin.command({ hello: 1 })) as { setName?: string };
      if (!hello.setName) {
        logger.warn(
          'MongoDB is running as a standalone server. Transactions require a replica set; use docker compose for local development.',
        );
      } else {
        logger.log(`MongoDB replica set: ${hello.setName}`);
      }
    }
  } catch (error) {
    logger.warn({ err: error }, 'Could not probe the MongoDB topology.');
  }

  await app.listen(port, '0.0.0.0');
  logger.log(
    `Histopathology LIMS API ready on http://localhost:${port}/${prefix} (${nodeEnv})` +
      (config.get<boolean>('SWAGGER_ENABLED') ? ` — docs at http://localhost:${port}/docs` : ''),
  );
}

void bootstrap();
