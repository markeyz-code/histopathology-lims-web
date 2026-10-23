import { z } from 'zod';

export const loginSchema = z.object({
  labCode: z
    .string()
    .trim()
    .min(2, 'Enter your laboratory code.')
    .max(32)
    .transform((value) => value.toUpperCase()),
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.')
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Enter your password.').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
