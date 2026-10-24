import { z } from 'zod';

const boolFromEnv = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    API_PREFIX: z.string().min(1).max(40).default('api'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api'),
    SWAGGER_ENABLED: boolFromEnv('false'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MONGODB_URI: z
      .string()
      .min(10)
      .default('mongodb://localhost:27017/histo_lims?replicaSet=rs0&directConnection=true'),
    REDIS_URL: z.string().min(5).default('redis://localhost:6379'),
    QUEUES_ENABLED: boolFromEnv('true'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters.'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters.'),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default('15m'),
    JWT_REFRESH_TTL: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default('7d'),
    STORAGE_DIR: z.string().min(1).default('./storage'),
    TRUST_PROXY: z.coerce.number().int().min(1).max(10).default(1),
    SEED_RESET: boolFromEnv('false'),

    // Phase 2 — referral portal and notification delivery
    PORTAL_DEBUG: boolFromEnv('false'),
    PORTAL_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(120).default(15),
    NOTIFICATIONS_MODE: z.enum(['outbox', 'live']).default('outbox'),
    EMAIL_PROVIDER: z.enum(['log', 'smtp']).default('log'),
    SMTP_HOST: z.string().min(1).optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(587),
    SMTP_SECURE: boolFromEnv('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().email().default('no-reply@histopathology.local'),
    SMS_PROVIDER: z.enum(['log', 'termii', 'twilio']).default('log'),
    TERMII_API_KEY: z.string().optional(),
    TERMII_SENDER_ID: z.string().max(20).default('HISTOLIMS'),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    TWILIO_FROM_NUMBER: z.string().optional(),
    TWILIO_WHATSAPP_FROM: z.string().optional(),

    // Phase 3 — interoperability
    FHIR_ENABLED: boolFromEnv('true'),
    HL7_ENABLED: boolFromEnv('false'),
    HL7_MLLP_PORT: z.coerce.number().int().min(1).max(65_535).default(2575),
    HL7_LAB_CODE: z.string().min(2).max(32).default('HISTO'),
    HL7_ALLOWED_IPS: z.string().optional(),
    WSI_WEBHOOK_SECRET: z.string().min(16).optional(),
    PAYMENTS_MODE: z.enum(['mock', 'live']).default('mock'),
    PAYSTACK_SECRET_KEY: z.string().optional(),
    FLUTTERWAVE_SECRET_KEY: z.string().optional(),
    FLUTTERWAVE_WEBHOOK_HASH: z.string().optional(),
    DEFAULT_CURRENCY: z.string().length(3).default('NGN'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (
          value[key].includes('change-me') ||
          value[key].includes('dev-') ||
          value[key].includes('local-')
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must not use the development default in production.`,
          });
        }
      }
    }

    if (value.NODE_ENV === 'production') {
      if (value.PORTAL_DEBUG) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PORTAL_DEBUG'],
          message: 'PORTAL_DEBUG must be false in production.',
        });
      }
      if (value.SEED_RESET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SEED_RESET'],
          message: 'SEED_RESET must be false in production.',
        });
      }
      if (!value.CORS_ORIGINS.split(',').every((origin) => origin.trim().startsWith('https://'))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'Production CORS_ORIGINS must contain only HTTPS origins.',
        });
      }
      if (
        !value.PUBLIC_WEB_URL.startsWith('https://') ||
        !value.PUBLIC_API_URL.startsWith('https://')
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PUBLIC_WEB_URL'],
          message: 'Production PUBLIC_WEB_URL and PUBLIC_API_URL must use HTTPS.',
        });
      }
    }

    if (value.PAYMENTS_MODE === 'live') {
      if (!value.PAYSTACK_SECRET_KEY && !value.FLUTTERWAVE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['PAYMENTS_MODE'],
          message: 'PAYMENTS_MODE=live requires PAYSTACK_SECRET_KEY or FLUTTERWAVE_SECRET_KEY.',
        });
      }
    }

    if (value.NOTIFICATIONS_MODE === 'live' && value.EMAIL_PROVIDER === 'smtp') {
      if (!value.SMTP_HOST || !value.SMTP_USER || !value.SMTP_PASS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'SMTP delivery requires SMTP_HOST, SMTP_USER and SMTP_PASS.',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${details}`);
  }
  return parsed.data;
}

export function parseTtlSeconds(ttl: string, fallbackSeconds: number): number {
  const match = /^(\d+)([smhd])$/.exec(ttl.trim());
  if (!match) return fallbackSeconds;
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3_600;
    case 'd':
      return value * 86_400;
    default:
      return fallbackSeconds;
  }
}
