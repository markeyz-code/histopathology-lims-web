import { z } from 'zod';

export const OBJECT_ID_REGEX = /^[a-f0-9]{24}$/i;
export const objectIdSchema = z.string().regex(OBJECT_ID_REGEX, 'Invalid identifier.');
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const dateStringSchema = z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD.');
export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ApiErrorBody {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  requestId: string;
  timestamp: string;
  path: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}
