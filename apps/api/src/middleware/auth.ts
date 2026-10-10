import { fromNodeHeaders } from 'better-auth/node';
import type { Request, RequestHandler } from 'express';
import { type AuthSession, auth } from '../auth/auth.js';
import { unauthorized } from '../lib/http-error.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express exposes its Request type for augmentation this way.
  namespace Express {
    interface Request {
      /** Set by `loadSession` / `requireAuth` when the request carries a valid session cookie. */
      auth?: AuthSession;
    }
  }
}

async function resolveSession(req: Request) {
  return (await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })) ?? undefined;
}

/** Attaches the session (if any) to `req.auth`; never rejects. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  req.auth = await resolveSession(req);
  next();
};

/** Rejects with 401 unless the request has a valid session; the session is on `req.auth`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  req.auth ??= await resolveSession(req);
  if (!req.auth) throw unauthorized();
  next();
};

/** The session of a request that passed `requireAuth`. */
export function getAuth(req: Request): AuthSession {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
