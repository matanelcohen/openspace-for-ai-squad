/**
 * Secure CORS origin handling.
 *
 * Parses CORS_ORIGIN as a comma-separated allowlist and validates incoming
 * request origins against it. When CORS_ORIGIN is '*' or unset, falls back
 * to localhost-only in development and rejects all origins in production.
 */

const DEV_FALLBACK_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

/** Parse comma-separated origin list, trimming whitespace. */
export function parseOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '' || raw.trim() === '*') {
    return [];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Build the allowlist from env, applying safe defaults when unset or '*'. */
export function buildAllowlist(corsOrigin: string | undefined, nodeEnv: string | undefined): string[] {
  const explicit = parseOrigins(corsOrigin);
  if (explicit.length > 0) {
    return explicit;
  }
  // Wildcard or unset — safe fallback
  const isDev = !nodeEnv || nodeEnv === 'development' || nodeEnv === 'test';
  return isDev ? DEV_FALLBACK_ORIGINS : [];
}

/**
 * Origin validator for @fastify/cors.
 * Returns the matched origin string so the header reflects the actual origin
 * (required when credentials: true).
 */
export function createOriginValidator(allowlist: string[]) {
  return function validateOrigin(
    origin: string | undefined,
    callback: (err: Error | null, origin: boolean | string | RegExp | Array<boolean | string | RegExp>) => void,
  ): void {
    // Non-browser requests (curl, server-to-server) have no origin header — allow them.
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowlist.includes(origin)) {
      // Echo back the matched origin (not '*').
      callback(null, origin);
      return;
    }
    callback(null, false);
  };
}
