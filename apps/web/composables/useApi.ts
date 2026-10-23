import type { ApiErrorBody } from '@lims/shared';
import { useAuthStore } from '~/stores/auth';

export type ApiQuery = Record<
  string,
  string | number | boolean | null | undefined | Array<string | number>
>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: object | null;
  query?: ApiQuery;
  retry?: boolean;
}

function statusOf(error: unknown): number | undefined {
  const candidate = error as {
    statusCode?: number;
    response?: { status?: number };
    data?: { statusCode?: number };
  };
  return candidate?.statusCode ?? candidate?.response?.status ?? candidate?.data?.statusCode;
}

export function isNetworkError(error: unknown): boolean {
  if (statusOf(error) !== undefined) return false;
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof TypeError || /fetch|network|connection|offline/i.test(message);
}

export function apiErrorMessage(error: unknown): string {
  const candidate = error as {
    data?: ApiErrorBody;
    message?: string;
  };
  const message = candidate?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  if (typeof candidate?.message === 'string' && candidate.message.length > 0) {
    return candidate.message;
  }
  return 'The request could not be completed. Check the connection and try again.';
}

export function useApi() {
  const config = useRuntimeConfig();
  const auth = useAuthStore();
  const baseURL = String(config.public.apiBase).replace(/\/$/, '');

  function url(path: string): string {
    return path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;
  }

  function headers(): Record<string, string> {
    const token = auth.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await $fetch<T>(url(path), {
        method: options.method ?? 'GET',
        body: options.body ?? undefined,
        query: options.query,
        headers: headers(),
      });
    } catch (error) {
      if (statusOf(error) === 401 && options.retry !== false) {
        const refreshed = await auth.refreshSession();
        if (refreshed) return request<T>(path, { ...options, retry: false });
      }
      throw error;
    }
  }

  async function blob(path: string, retry = true): Promise<Blob> {
    try {
      return await $fetch<Blob>(url(path), {
        method: 'GET',
        responseType: 'blob',
        headers: headers(),
      });
    } catch (error) {
      if (statusOf(error) === 401 && retry) {
        const refreshed = await auth.refreshSession();
        if (refreshed) return blob(path, false);
      }
      throw error;
    }
  }

  return {
    baseURL,
    get: <T>(path: string, query?: ApiQuery) => request<T>(path, { query }),
    post: <T>(path: string, body?: object) => request<T>(path, { method: 'POST', body }),
    patch: <T>(path: string, body?: object) => request<T>(path, { method: 'PATCH', body }),
    put: <T>(path: string, body?: object) => request<T>(path, { method: 'PUT', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
    blob,
  };
}
