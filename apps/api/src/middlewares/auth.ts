import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../lib/auth.js';
import { HttpError } from '../lib/http-error.js';

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'Autenticação necessária.'));
  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: Number(payload.sub), name: payload.name, email: payload.email, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, 'Token inválido ou expirado.'));
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'ADMIN') return next(new HttpError(403, 'Ação permitida somente para administradores.'));
  next();
}
