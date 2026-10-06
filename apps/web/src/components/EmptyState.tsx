import { PackageOpen } from 'lucide-react';
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center"><div className="mb-3 rounded-2xl bg-slate-100 p-3"><PackageOpen className="h-6 w-6 text-slate-500" /></div><h3 className="font-semibold text-slate-800">{title}</h3>{description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}</div>;
}
