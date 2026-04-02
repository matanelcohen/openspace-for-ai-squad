const AUTH_TOKEN_KEY = 'openspace:auth-token';

/** Read the stored JWT from localStorage. Returns null when absent or in SSR. */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/** Persist a JWT to localStorage. */
export function setAuthToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/** Remove the stored JWT (e.g. on logout or 401). */
export function clearAuthToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Handle an authentication failure (HTTP 401).
 * Clears the stored token and redirects to the login page.
 */
export function handleUnauthorized(): void {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname + window.location.search;
    // Avoid redirect loop if already on the login page
    if (currentPath.startsWith('/login')) return;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  }
}
