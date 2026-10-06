import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../apps/api/src/app.ts';

type VercelLikeRequest = IncomingMessage & {
  query?: Record<string, string | string[] | undefined>;
};

export default function handler(req: VercelLikeRequest, res: ServerResponse) {
  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || '');

  const url = new URL(req.url || '/', 'http://localhost');
  url.searchParams.delete('path');
  const qs = url.searchParams.toString();

  req.url = `/api/${path}${qs ? `?${qs}` : ''}`;
  return app(req as any, res as any);
}
