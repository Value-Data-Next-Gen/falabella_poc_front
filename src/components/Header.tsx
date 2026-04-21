import { Activity, Clock, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { AppState } from '../types';
import { useTheme } from '../hooks/useTheme';

export function Header({
  state,
  isLoading,
  isError,
}: {
  state: AppState | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const simClock = state?.sim_clock ? new Date(state.sim_clock) : null;
  const { theme, toggle } = useTheme();

  return (
    <header className="border-b border-line bg-bg-800 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-accent-blue flex items-center justify-center font-bold text-bg-900">
          VD
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-wide">
            Torre de Control · ValueData × Falabella
          </h1>
          <p className="text-[11px] text-text-muted">
            Predicción anticipada de incumplimiento sobre SimpliRoute
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 text-text-muted text-[10px] uppercase tracking-wider">
            <Clock size={11} />
            Reloj simulado
          </div>
          <div className="text-2xl font-semibold text-accent-blue tabular-nums">
            {simClock
              ? simClock.toLocaleTimeString('es-CL', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : '--:--:--'}
          </div>
          <div className="text-[10px] text-text-muted">
            {state ? `${state.today} · día ${state.day_seed}` : '...'}
          </div>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs uppercase tracking-wider border ${
            isError
              ? 'border-accent-red/50 text-accent-red bg-accent-red/10'
              : isLoading
              ? 'border-accent-yellow/50 text-accent-yellow bg-accent-yellow/10'
              : 'border-accent-green/50 text-accent-green bg-accent-green/10'
          }`}
        >
          {isError ? <WifiOff size={14} /> : <Wifi size={14} />}
          {isError ? 'Sin conexión' : isLoading ? 'Cargando...' : 'En vivo'}
          <Activity size={14} className={isError ? '' : 'animate-pulse'} />
        </div>

        <button
          onClick={toggle}
          className="btn flex items-center gap-2"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          {theme === 'dark' ? 'Claro' : 'Oscuro'}
        </button>
      </div>
    </header>
  );
}
