import {
  Catch,
  HttpException,
  HttpStatus,
  Injectable,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { TenantContextMissingError } from '../context/tenant-context';
import { getRequestId } from '../context/request-context';

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

interface NormalizedError {
  status: number;
  error: string;
  message: string | string[];
  details?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function normalizeHttpException(exception: HttpException): NormalizedError {
  const status = exception.getStatus();
  const response = exception.getResponse();
  let message: string | string[] = exception.message;
  let error = STATUS_TEXT[status] ?? 'Error';
  let details: unknown;

  if (typeof response === 'string') {
    message = response;
  } else {
    const record = asRecord(response);
    if (record) {
      if (Array.isArray(record.message)) {
        message = record.message.map((item) => String(item));
      } else if (typeof record.message === 'string') {
        message = record.message;
      }
      if (typeof record.error === 'string') error = record.error;
      const extras: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(record)) {
        if (key !== 'message' && key !== 'error' && key !== 'statusCode') extras[key] = value;
      }
      if (Object.keys(extras).length > 0) details = extras;
    }
  }

  return { status, error, message, details };
}

function isDuplicateKeyError(exception: unknown): boolean {
  const record = asRecord(exception);
  return record?.code === 11000;
}

function isCastError(exception: unknown): boolean {
  return asRecord(exception)?.name === 'CastError';
}

function isMongooseValidationError(exception: unknown): string[] | null {
  const record = asRecord(exception);
  if (record?.name !== 'ValidationError') return null;
  const errors = asRecord(record.errors);
  if (!errors) return null;
  return Object.values(errors).map((item) => {
    const errorRecord = asRecord(item);
    return typeof errorRecord?.message === 'string' ? errorRecord.message : 'Invalid value.';
  });
}

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const requestId = getRequestId() ?? 'unavailable';
    const path = request.originalUrl ?? request.url ?? '';

    let normalized: NormalizedError;
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      normalized = normalizeHttpException(exception);
      stack = exception.stack;
    } else if (isDuplicateKeyError(exception)) {
      normalized = {
        status: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'A record with this value already exists.',
      };
    } else if (isCastError(exception)) {
      normalized = {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid identifier or value.',
      };
    } else if (isMongooseValidationError(exception)) {
      normalized = {
        status: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: isMongooseValidationError(exception) ?? ['Invalid document.'],
      };
    } else if (exception instanceof TenantContextMissingError) {
      normalized = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'The request could not be scoped to a laboratory.',
      };
      stack = exception.stack;
    } else {
      normalized = {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Quote the request ID when contacting support.',
      };
      stack = exception instanceof Error ? exception.stack : undefined;
    }

    const body = {
      success: false as const,
      statusCode: normalized.status,
      error: normalized.error,
      message: normalized.message,
      ...(normalized.details !== undefined ? { details: normalized.details } : {}),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    };

    if (normalized.status >= 500) {
      this.logger.error(
        { err: exception, requestId, path, statusCode: normalized.status },
        'API request failed',
      );
    } else {
      this.logger.warn({ requestId, path, statusCode: normalized.status }, 'API request rejected');
    }
    void stack;

    if (response.headersSent) return;
    response.status(normalized.status).json(body);
  }
}
