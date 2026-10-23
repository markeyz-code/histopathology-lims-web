import { MiddlewareConsumer, Module, RequestMethod, type NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { validateEnv } from './common/config/env';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthModule } from './common/health/health.module';
import {
  RequestContextMiddleware,
  TenantMiddleware,
} from './common/middleware/request-context.middleware';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { CasesModule } from './modules/cases/cases.module';
import { CustodyModule } from './modules/custody/custody.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FhirModule } from './modules/fhir/fhir.module';
import { Hl7Module } from './modules/hl7/hl7.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { LabelsModule } from './modules/labels/labels.module';
import { LabsModule } from './modules/labs/labs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PatientsModule } from './modules/patients/patients.module';
import { PortalModule } from './modules/portal/portal.module';
import { PdfModule } from './modules/pdf/pdf.module';
import { ProtocolsModule } from './modules/protocols/protocols.module';
import { QaModule } from './modules/qa/qa.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SlidesModule } from './modules/slides/slides.module';
import { SpecimensModule } from './modules/specimens/specimens.module';
import { SyncModule } from './modules/sync/sync.module';
import { TerminologyModule } from './modules/terminology/terminology.module';
import { UsersModule } from './modules/users/users.module';
import { WorklistModule } from './modules/worklist/worklist.module';
import { WsiModule } from './modules/wsi/wsi.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.get<string>('NODE_ENV') === 'development';
        let prettyTarget: string | undefined;
        if (isDevelopment) {
          try {
            prettyTarget = require.resolve('pino-pretty');
          } catch {
            prettyTarget = undefined;
          }
        }
        return {
          pinoHttp: {
            level: config.get<string>('LOG_LEVEL') ?? 'info',
            genReqId: (req: Request, res: Response) => {
              const existing = req.headers['x-request-id'];
              const id =
                typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                'password',
                'passwordHash',
                'refreshToken',
              ],
              censor: '[redacted]',
            },
            autoLogging: true,
            transport: prettyTarget
              ? {
                  target: prettyTarget,
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
            customProps: () => ({ service: 'histopathology-lims-api' }),
          },
        };
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        autoIndex: true,
        maxPoolSize: 25,
        serverSelectionTimeoutMS: 15_000,
      }),
    }),
    AuditModule,
    BillingModule,
    IdempotencyModule,
    AuthModule,
    LabsModule,
    UsersModule,
    PatientsModule,
    CustodyModule,
    CasesModule,
    FhirModule,
    Hl7Module,
    SpecimensModule,
    BlocksModule,
    SlidesModule,
    ProtocolsModule,
    QaModule,
    SyncModule,
    TerminologyModule,
    WsiModule,
    PdfModule,
    JobsModule,
    ReportsModule,
    WorklistModule,
    DashboardModule,
    LabelsModule,
    InventoryModule,
    NotificationsModule,
    PortalModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware, TenantMiddleware)
      .forRoutes({ path: '{*splat}', method: RequestMethod.ALL });
  }
}
