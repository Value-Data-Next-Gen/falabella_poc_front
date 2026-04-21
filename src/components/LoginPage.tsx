import { FormEvent, useState } from 'react';
import { AlertCircle, Lock, Mail, Truck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const SAMPLE_USERS = [
  { label: 'Admin Falabella', email: 'admin@falabella.cl', password: 'admin123' },
  { label: 'Ops Falabella',   email: 'ops@falabella.cl',   password: 'ops123' },
  { label: 'Transportista',   email: 'transporte22@demo.cl', password: 'demo123' },
];

export function LoginPage() {
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch {
      /* error ya queda en context */
    }
  };

  const useSample = (u: typeof SAMPLE_USERS[number]) => {
    setEmail(u.email);
    setPassword(u.password);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg-900 p-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-lg">
            VD
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-wide">
              Torre de Control
            </h1>
            <p className="text-xs text-text-muted">ValueData × Falabella</p>
          </div>
        </div>

        {/* Card */}
        <div className="panel p-6">
          <h2 className="text-sm uppercase tracking-wider text-text-secondary mb-4">
            Iniciar sesión
          </h2>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1">
                <Mail size={11} /> Email
              </span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="nombre@dominio.cl"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1">
                <Lock size={11} /> Contraseña
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 text-[11px] text-accent-red bg-accent-red/10 border border-accent-red/30 rounded px-2 py-1.5">
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-line">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
              <Truck size={11} /> Cuentas demo
            </div>
            <div className="flex flex-col gap-1">
              {SAMPLE_USERS.map(u => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => useSample(u)}
                  className="text-left text-[11px] text-text-secondary hover:text-brand transition-colors px-2 py-1 rounded hover:bg-bg-700 flex items-center justify-between"
                >
                  <span>{u.label}</span>
                  <span className="font-mono text-[10px] text-text-muted">{u.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-text-muted text-center mt-4">
          POC interno · multi-tenant por empresa de transporte
        </p>
      </div>
    </div>
  );
}
