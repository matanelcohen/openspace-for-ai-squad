/**
 * Authentication service — JWT-based login, logout, and token refresh.
 *
 * Uses bcrypt for password hashing and jsonwebtoken for token management.
 * Refresh tokens are stored in the SQLite database to support revocation.
 */

import crypto from 'node:crypto';

import bcrypt from 'bcrypt';
import type Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

// ── Constants ──────────────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked: number;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

// ── Errors ─────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'TOKEN_REVOKED' | 'USER_NOT_FOUND' | 'EMAIL_TAKEN',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ── Service ────────────────────────────────────────────────────────

export class AuthService {
  private readonly db: Database.Database;
  private readonly jwtSecret: string;

  constructor(opts: { db: Database.Database; jwtSecret?: string }) {
    this.db = opts.db;
    this.jwtSecret = opts.jwtSecret ?? process.env.JWT_SECRET ?? 'openspace-dev-secret';
  }

  // ── User Management ────────────────────────────────────────────

  /** Hash a plaintext password with bcrypt. */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  }

  /** Verify a password against a bcrypt hash. */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Register a new user. Returns the created user (no password). */
  async registerUser(opts: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }): Promise<AuthUser> {
    const existing = this.db
      .prepare('SELECT id FROM auth_users WHERE email = ?')
      .get(opts.email) as { id: string } | undefined;

    if (existing) {
      throw new AuthError('Email already registered', 'EMAIL_TAKEN');
    }

    const id = crypto.randomUUID();
    const passwordHash = await this.hashPassword(opts.password);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO auth_users (id, email, password_hash, name, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, opts.email, passwordHash, opts.name, opts.role ?? 'member', now, now);

    return { id, email: opts.email, name: opts.name, role: opts.role ?? 'member' };
  }

  // ── Login / Logout / Refresh ───────────────────────────────────

  /** Authenticate a user by email+password and return tokens. */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = this.db
      .prepare('SELECT id, email, name, role, password_hash FROM auth_users WHERE email = ?')
      .get(email) as UserRow | undefined;

    if (!user) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const valid = await this.verifyPassword(password, user.password_hash);
    if (!valid) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const tokens = await this.generateTokenPair(user);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tokens,
    };
  }

  /** Revoke a refresh token (logout). */
  logout(refreshToken: string): boolean {
    const tokenHash = this.hashToken(refreshToken);
    const result = this.db
      .prepare('UPDATE auth_refresh_tokens SET revoked = 1 WHERE token_hash = ? AND revoked = 0')
      .run(tokenHash);
    return result.changes > 0;
  }

  /** Revoke all refresh tokens for a user (logout everywhere). */
  logoutAll(userId: string): number {
    const result = this.db
      .prepare('UPDATE auth_refresh_tokens SET revoked = 1 WHERE user_id = ? AND revoked = 0')
      .run(userId);
    return result.changes;
  }

  /** Exchange a valid refresh token for a new token pair. */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = this.hashToken(refreshToken);
    const row = this.db
      .prepare('SELECT * FROM auth_refresh_tokens WHERE token_hash = ?')
      .get(tokenHash) as RefreshTokenRow | undefined;

    if (!row) {
      throw new AuthError('Invalid refresh token', 'INVALID_CREDENTIALS');
    }

    if (row.revoked) {
      throw new AuthError('Refresh token has been revoked', 'TOKEN_REVOKED');
    }

    if (new Date(row.expires_at) < new Date()) {
      throw new AuthError('Refresh token has expired', 'TOKEN_EXPIRED');
    }

    // Revoke the used token (rotation)
    this.db
      .prepare('UPDATE auth_refresh_tokens SET revoked = 1 WHERE id = ?')
      .run(row.id);

    const user = this.db
      .prepare('SELECT id, email, name, role, password_hash FROM auth_users WHERE id = ?')
      .get(row.user_id) as UserRow | undefined;

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND');
    }

    const tokens = await this.generateTokenPair(user);

    return {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      tokens,
    };
  }

  // ── Token Utilities ────────────────────────────────────────────

  /** Verify and decode an access token. */
  verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, this.jwtSecret) as AccessTokenPayload;
  }

  /** Generate an access + refresh token pair and persist the refresh token. */
  private async generateTokenPair(user: UserRow): Promise<TokenPair> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = crypto.randomUUID();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString();

    this.db
      .prepare(
        `INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at, revoked)
         VALUES (?, ?, ?, ?, 0)`,
      )
      .run(crypto.randomUUID(), user.id, tokenHash, expiresAt);

    return { accessToken, refreshToken };
  }

  /** SHA-256 hash a token for safe storage. */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
