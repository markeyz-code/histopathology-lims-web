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
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { BillingModule } from './extensions/billing/billing.module';
import { TestRequestsModule } from './core/test-requests/test-requests.module';
import { CatalogModule } from './core/catalog/catalog.module';
import { ResultsModule } from './core/results/results.module';
import { RulesModule } from './core/rules/rules.module';
import { QcModule } from './core/qc/qc.module';
import { PreanalyticsModule } from './core/preanalytics/preanalytics.module';
import { MicrobiologyModule } from './disciplines/microbiology/microbiology.module';
import { QualityModule } from './core/quality/quality.module';
import { InstrumentsModule } from './extensions/instruments/instruments.module';
import { PlatformModule } from './core/platform/platform.module';
import { LeadsModule } from './core/leads/leads.module';
import { DisciplineRegistryModule } from './core/discipline/discipline.module';
import { DisciplineGuard } from './core/discipline/discipline.guard';
import { DisciplinesModule } from './disciplines/disciplines.module';
import { HistopathologyModule } from './disciplines/histopathology/histopathology.module';
import { BlocksModule } from './disciplines/histopathology/blocks/blocks.module';
import { CasesModule } from './core/cases/cases.module';
import { CustodyModule } from './core/custody/custody.module';
import { DashboardModule } from './core/dashboard/dashboard.module';
import { FhirModule } from './extensions/fhir/fhir.module';
import { Hl7Module } from './extensions/hl7/hl7.module';
import { InventoryModule } from './extensions/inventory/inventory.module';
import { JobsModule } from './core/jobs/jobs.module';
import { LabelsModule } from './core/labels/labels.module';
import { LabsModule } from './core/labs/labs.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { PatientsModule } from './core/patients/patients.module';
import { PortalModule } from './extensions/portal/portal.module';
import { PdfModule } from './disciplines/histopathology/pdf/pdf.module';
import { ProtocolsModule } from './disciplines/histopathology/protocols/protocols.module';
import { QaModule } from './extensions/qa/qa.module';
import { ReportsModule } from './core/reports/reports.module';
import { SlidesModule } from './disciplines/histopathology/slides/slides.module';
import { SpecimensModule } from './core/specimens/specimens.module';
import { SyncModule } from './extensions/sync/sync.module';
import { TerminologyModule } from './extensions/terminology/terminology.module';
import { UsersModule } from './core/users/users.module';
import { WorklistModule } from './core/worklist/worklist.module';
import { WsiModule } from './extensions/wsi/wsi.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env', '../.env', '../../.env'],
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
    TestRequestsModule,
    CatalogModule,
    RulesModule,
    QcModule,
    PreanalyticsModule,
    MicrobiologyModule,
    QualityModule,
    InstrumentsModule,
    PlatformModule,
    LeadsModule,
    ResultsModule,
    DisciplineRegistryModule,
    DisciplinesModule,
    HistopathologyModule,
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
    { provide: APP_GUARD, useClass: DisciplineGuard },
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
