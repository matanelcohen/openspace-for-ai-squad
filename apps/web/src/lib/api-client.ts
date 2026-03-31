// Detect API URL: env var (build-time) → auto-detect from browser hostname
const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  // If accessing from the same machine, use the env URL
  if (envUrl && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return envUrl;
  }
  // LAN access: use the same hostname but API port
  return `http://${window.location.hostname}:3001`;
})();

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: HeadersInit = {
    ...(options?.body != null ? { 'Content-Type': 'application/json' } : {}),
    ...options?.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new ApiError(res.status, `API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => apiClient<T>(path),
  patch: <T>(path: string, body: unknown) =>
    apiClient<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  post: <T>(path: string, body: unknown) =>
    apiClient<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiClient<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiClient<T>(path, { method: 'DELETE' }),
};
