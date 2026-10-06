import { LoaderCircle } from 'lucide-react';
export function Loading({ label = 'Carregando...' }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />{label}</div>;
}
