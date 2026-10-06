const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function getToken() { return localStorage.getItem('controle-av-token'); }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && options.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
  if (!response.ok) {
    let payload: any = null;
    try { payload = await response.json(); } catch { /* ignore */ }
    throw new ApiError(payload?.message || payload?.error || 'Não foi possível concluir a operação.', response.status, payload);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function assetUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^(https?:\/\/|data:|blob:)/.test(path)) return path;
  const base = API_URL.replace(/\/api\/?$/, '');
  return `${base}${path}`;
}


export async function downloadApiFile(path: string, fallbackName: string) {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (response.status === 401 && token) window.dispatchEvent(new Event('auth:expired'));
  if (!response.ok) {
    let payload: any = null;
    try { payload = await response.json(); } catch { /* ignore */ }
    throw new ApiError(payload?.message || payload?.error || 'Não foi possível baixar o arquivo.', response.status, payload);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
