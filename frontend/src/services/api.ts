export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, any> | any | null;
  timeoutMs?: number;
  skipJsonParse?: boolean;
};

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

async function parseResponseBody(response: Response, skipJsonParse = false) {
  if (skipJsonParse) {
    return response.text();
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? text : null;
}

export async function apiRequest<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { timeoutMs = 20000, skipJsonParse = false, headers, body, ...rest } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const finalHeaders = new Headers(headers || {});

    if (!isFormData && !finalHeaders.has('Content-Type') && body != null && !(body instanceof URLSearchParams)) {
      finalHeaders.set('Content-Type', 'application/json');
    }

    if (!finalHeaders.has('Accept')) {
      finalHeaders.set('Accept', 'application/json');
    }

    const response = await fetch(buildUrl(path), {
      ...rest,
      headers: finalHeaders,
      body: body instanceof FormData || body instanceof URLSearchParams || typeof body === 'string' ? body : typeof body === 'object' ? JSON.stringify(body) : body,
      signal: controller.signal,
    });

    const payload = await parseResponseBody(response, skipJsonParse);

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error?: string }).error ?? 'Request failed.')
          : typeof payload === 'object' && payload && 'message' in payload
            ? String((payload as { message?: string }).message ?? 'Request failed.')
            : 'Request failed.';

      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timed out.', 408);
    }

    if (error instanceof ApiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Network request failed.';
    throw new ApiError(message, 0, error);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => apiRequest<T>(path, { ...options, method: 'POST', body: body ?? undefined }),
  put: <T = unknown>(path: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => apiRequest<T>(path, { ...options, method: 'PUT', body: body ?? undefined }),
  patch: <T = unknown>(path: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => apiRequest<T>(path, { ...options, method: 'PATCH', body: body ?? undefined }),
  del: <T = unknown>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) => apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
