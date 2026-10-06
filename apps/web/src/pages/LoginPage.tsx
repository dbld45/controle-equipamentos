import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ScanBarcode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@controleav.local');
  const [password, setPassword] = useState('Admin@123');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try { await login(email.trim(), password); navigate('/'); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.'); }
  }

  return <div className="grid min-h-screen bg-slate-100 lg:grid-cols-2">
    <section className="hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-950"><ScanBarcode /></div><div><div className="text-lg font-bold">Controle AV</div><div className="text-xs text-slate-400">Gestão de equipamentos audiovisuais</div></div></div>
      <div className="max-w-xl"><p className="mb-5 text-sm font-semibold uppercase tracking-[.25em] text-slate-500">Operação e patrimônio</p><h1 className="text-5xl font-bold leading-tight">Saiba onde está cada equipamento, quem retirou e quando deve voltar.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">Controle de câmeras, áudio, iluminação, cabos e acessórios em um único fluxo de estoque, externa, aluguel e manutenção.</p></div>
      <p className="text-xs text-slate-600">Interface otimizada para computador, tablet e celular.</p>
    </section>
    <section className="flex items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-white"><ScanBarcode className="h-5 w-5" /></div><div><div className="font-bold">Controle AV</div><div className="text-xs text-slate-500">Gestão audiovisual</div></div></div>
        <div className="card p-6 sm:p-8">
          <div className="mb-7"><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-slate-100"><LockKeyhole className="h-5 w-5" /></div><h2 className="text-2xl font-bold">Entrar no sistema</h2><p className="mt-1 text-sm text-slate-500">Use seu e-mail e senha de acesso.</p></div>
          <form onSubmit={submit} className="space-y-5">
            <div><label className="label" htmlFor="email">E-mail</label><input id="email" className="input" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><label className="label" htmlFor="password">Senha</label><div className="relative"><input id="password" className="input pr-11" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} /><button type="button" onClick={() => setShow(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <button disabled={loading} className="btn-primary w-full py-3">{loading ? 'Entrando...' : 'Entrar'}</button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Usuário inicial de demonstração preenchido automaticamente.</p>
      </div>
    </section>
  </div>;
}
