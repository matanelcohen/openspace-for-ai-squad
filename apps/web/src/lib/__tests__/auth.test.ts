import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearAuthToken, getAuthToken, handleUnauthorized, setAuthToken } from '@/lib/auth';

describe('auth token helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('getAuthToken', () => {
    it('returns null when no token is stored', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('returns the stored token', () => {
      localStorage.setItem('openspace:auth-token', 'my-jwt-token');
      expect(getAuthToken()).toBe('my-jwt-token');
    });
  });

  describe('setAuthToken', () => {
    it('persists the token to localStorage', () => {
      setAuthToken('jwt-123');
      expect(localStorage.getItem('openspace:auth-token')).toBe('jwt-123');
    });

    it('overwrites an existing token', () => {
      setAuthToken('old');
      setAuthToken('new');
      expect(getAuthToken()).toBe('new');
    });
  });

  describe('clearAuthToken', () => {
    it('removes the token from localStorage', () => {
      setAuthToken('jwt-to-remove');
      clearAuthToken();
      expect(getAuthToken()).toBeNull();
    });

    it('is safe to call when no token exists', () => {
      expect(() => clearAuthToken()).not.toThrow();
    });
  });

  describe('handleUnauthorized', () => {
    it('clears the stored token', () => {
      setAuthToken('expired-token');
      // Prevent actual navigation
      const original = window.location.href;
      Object.defineProperty(window, 'location', {
        value: { ...window.location, href: original, pathname: '/dashboard', search: '' },
        writable: true,
      });

      handleUnauthorized();
      expect(getAuthToken()).toBeNull();
    });

    it('redirects to /login with redirect param', () => {
      setAuthToken('expired');
      const locationMock = {
        ...window.location,
        pathname: '/tasks',
        search: '?filter=open',
        href: '',
      };
      Object.defineProperty(window, 'location', { value: locationMock, writable: true });

      handleUnauthorized();
      expect(locationMock.href).toBe('/login?redirect=%2Ftasks%3Ffilter%3Dopen');
    });

    it('does not redirect if already on /login', () => {
      setAuthToken('expired');
      const locationMock = {
        ...window.location,
        pathname: '/login',
        search: '',
        href: '',
      };
      Object.defineProperty(window, 'location', { value: locationMock, writable: true });

      handleUnauthorized();
      // href should remain empty — no redirect
      expect(locationMock.href).toBe('');
    });
  });
});
