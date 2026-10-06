import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Box, ChevronRight, ArrowDownToLine, ArrowUpFromLine, FileBarChart, LogOut, Menu, ScanBarcode, Settings, Tags, Users, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard', icon: BarChart3 },
  { to: '/equipamentos', label: 'Equipamentos', icon: Box },
  { to: '/saidas', label: 'Saídas', icon: ArrowUpFromLine },
  { to: '/devolucoes', label: 'Devoluções', icon: ArrowDownToLine },
  { to: '/scanner', label: 'Scanner', icon: ScanBarcode },
  { to: '/etiquetas', label: 'Etiquetas', icon: Tags },
  { to: '/relatorios', label: 'Relatórios', icon: FileBarChart }
];

const adminNav = [
  { to: '/admin/categorias', label: 'Categorias', icon: Tags },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users },
  { to: '/admin/configuracoes', label: 'Configurações', icon: Settings }
];

const mobileNav = [
  { to: '/', label: 'Início', icon: BarChart3 },
  { to: '/scanner', label: 'Scanner', icon: ScanBarcode },
  { to: '/saidas/nova', label: 'Saída', icon: ArrowUpFromLine },
  { to: '/devolucoes', label: 'Devolver', icon: ArrowDownToLine }
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const combined = [...nav, ...adminNav];
  const current = combined.find(x => x.to !== '/' ? location.pathname.startsWith(x.to) : location.pathname === '/')?.label || 'Controle AV';

  const Sidebar = () => <div className="flex h-full flex-col bg-slate-950 text-slate-200">
    <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-950"><ScanBarcode className="h-5 w-5" /></div>
      <div><div className="font-bold leading-tight">Controle AV</div><div className="text-[11px] text-slate-400">Patrimônio audiovisual</div></div>
    </div>
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-1">{nav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon className="h-4.5 w-4.5" /><span>{label}</span></NavLink>)}</div>
      {user?.role === 'ADMIN' && <div className="mt-5 border-t border-white/10 pt-4"><div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Administração</div><div className="space-y-1">{adminNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</NavLink>)}</div></div>}
    </nav>
    <div className="border-t border-white/10 p-3">
      <div className="mb-2 rounded-xl bg-white/5 p-3"><div className="truncate text-sm font-semibold text-white">{user?.name}</div><div className="truncate text-xs text-slate-400">{user?.email}</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}</div></div>
      <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" />Sair</button>
    </div>
  </div>;

  return <div className="min-h-screen bg-slate-50">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar /></aside>
    {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[84%] max-w-xs"><Sidebar /><button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-slate-300 hover:bg-white/10"><X className="h-5 w-5" /></button></aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"><Menu className="h-5 w-5" /></button><div><div className="flex items-center gap-1 text-xs text-slate-400"><span>Controle AV</span><ChevronRight className="h-3 w-3" /><span>{current}</span></div><h1 className="font-semibold text-slate-900">{current}</h1></div></div>
        <div className="hidden text-right sm:block"><div className="text-sm font-medium text-slate-800">{user?.name}</div><div className="text-xs text-slate-500">{user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}</div></div>
      </header>
      <main className="mx-auto max-w-[1600px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8"><Outlet /></main>
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur lg:hidden">
      {mobileNav.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold ${isActive ? 'text-slate-950' : 'text-slate-400'}`}><Icon className="h-5 w-5" />{label}</NavLink>)}
    </nav>
  </div>;
}
