import { z } from 'zod';

const boolFromEnv = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    API_PREFIX: z.string().min(1).max(40).default('api'),
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
    PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api'),
    SWAGGER_ENABLED: boolFromEnv('true'),
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
    SEED_RESET: boolFromEnv('false'),
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
