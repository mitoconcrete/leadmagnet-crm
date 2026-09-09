import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'sid';
export const VISITOR_COOKIE = 'vid';

export const sessionCookieOptions = (ttlSeconds: number): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  path: '/api/admin',
  maxAge: ttlSeconds * 1000,
});

export const visitorCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  path: '/p',
  maxAge: 365 * 24 * 3600 * 1000,
});
