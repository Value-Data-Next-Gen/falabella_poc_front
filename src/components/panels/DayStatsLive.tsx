import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertTriangle, Ban, Trophy, TrendingUp, Wrench, Star } from 'lucide-react';
import { api } from '../../api';

interface Props {
  fecha: string;
}

interface DayStatsTotals {
  total: number; completed: number; pending: number;
  failed: number; cancelled: number; completion_pct: number;
}
interface DayStatsByEmpresa {
  empresa_id: number; empresa_nombre: string;
  total: number; completed: number; pending: number;
  failed: number; cancelled: number; completion_pct: number;
}
interface DayStatsAtraso {
  tracking_id: string; cliente: string; comuna: string | null;
  driver_name: string | null; eta: string | null; minutes_late: number;
}
interface DayStatsMotivo { motivo: string; count: number }
interface DayStatsIntervention {
  intervention_id: number; tracking_id: string; action: string;
  admin_name: string; reason: string | null; created_at: string;
}
interface DayStatsTopDriver {
  driver_id: string; driver_name: string; empresa_nombre: string;
  completed: number; total: number; pct: number;
}
interface DayStatsResponse {
  fecha: string; sim_clock: string;
  totals: DayStatsTotals;
  by_empresa: DayStatsByEmpresa[];
  top_atrasos: DayStatsAtraso[];
  top_motivos: DayStatsMotivo[];
  intervenciones_count: number;
  intervenciones_recientes: DayStatsIntervention[];
  top_driver: DayStatsTopDriver | null;
}

const ACTION_ICON: Record<string, string> = {
  cancel: '⛔', reschedule: '📅', escalate_priority: '⭐', override_motivo: '🪄',
};

export function DayStatsLive({ fecha }: Props) {
  const statsQ = useQuery({
    queryKey: ['day-stats-live', fecha],
    queryFn: () => api.admin.dayStats(fecha) as Promise<DayStatsResponse>,
    refetchInterval: 15_000,
    enabled: !!fecha,
  });

  const stats = statsQ.data;
  if (!stats) {
    return <div className="panel p-3 text-[11px] text-text-muted">{statsQ.isLoading ? 'Cargando stats…' : 'Sin stats'}</div>;
  }

  const { totals, by_empresa, top_atrasos, top_motivos, intervenciones_recientes, intervenciones_count, top_driver } = stats;

  return (
    <div className="panel flex flex-col gap-2 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-muted">
        <TrendingUp size={11} className="text-brand" />
        <span>Stats en vivo</span>
        <span className="ml-auto text-[10px] normal-case tracking-normal">
          sim clock {stats.sim_clock.slice(11, 16)}
        </span>
      </div>

      {/* Tiles principales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
        <Tile label="Total" value={totals.total} className="bg-bg-700/40" icon={null} />
        <Tile label="Completadas" value={totals.completed} className="bg-brand/15 text-brand" icon={CheckCircle2} />
        <Tile label="Pendientes" value={totals.pending} className="bg-bg-700/60 text-text-secondary" icon={Clock} />
        <Tile label="Fallidas" value={totals.failed} className="bg-accent-red/15 text-accent-red" icon={AlertTriangle} />
        <Tile label="Canceladas" value={totals.cancelled} className="bg-accent-yellow/15 text-accent-yellow" icon={Ban} />
      </div>

      {/* Completion ratio + top driver */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="panel p-2 text-[11px]">
          <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Cumplimiento global</div>
          <div className="flex items-baseline gap-2">
            <span className="text-brand text-xl font-semibold tabular-nums">{totals.completion_pct}%</span>
            <span className="text-text-muted">{totals.completed}/{totals.total}</span>
          </div>
          <div className="w-full h-1.5 bg-bg-700 rounded mt-1.5 overflow-hidden">
            <div className="h-full bg-brand" style={{ width: `${totals.completion_pct}%` }} />
          </div>
        </div>
        {top_driver && (
          <div className="panel p-2 text-[11px]">
            <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Trophy size={10} className="text-cmr" /> Top driver del día
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-text-primary font-medium">{top_driver.driver_name}</span>
              <span className="text-text-muted text-[10px]">({top_driver.empresa_nombre})</span>
            </div>
            <div className="text-text-muted">{top_driver.completed}/{top_driver.total} · {top_driver.pct}%</div>
          </div>
        )}
      </div>

      {/* Por empresa */}
      {by_empresa.length > 0 && (
        <div className="panel p-2">
          <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1.5">Por empresa</div>
          <div className="flex flex-col gap-1">
            {by_empresa.map(e => (
              <div key={e.empresa_id} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 truncate">{e.empresa_nombre}</span>
                <span className="text-brand tabular-nums">{e.completed}</span>
                <span className="text-text-muted">/</span>
                <span className="tabular-nums">{e.total}</span>
                <span className="text-text-muted text-[10px] w-12 text-right">({e.completion_pct}%)</span>
                <div className="w-16 h-1 bg-bg-700 rounded overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${e.completion_pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {/* Top atrasos */}
        <div className="panel p-2">
          <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Clock size={10} className="text-accent-yellow" /> Atrasos ETA
          </div>
          {top_atrasos.length === 0 && <div className="text-[10px] text-text-muted">Sin atrasos.</div>}
          <div className="flex flex-col gap-0.5">
            {top_atrasos.slice(0, 5).map(a => (
              <div key={a.tracking_id} className="text-[10px] flex items-center gap-1.5">
                <span className="text-accent-red tabular-nums w-10">+{a.minutes_late}m</span>
                <span className="flex-1 truncate">{a.cliente}</span>
                <span className="text-text-muted">{(a.driver_name || '').split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top motivos */}
        <div className="panel p-2">
          <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Star size={10} className="text-cmr" /> Motivos
          </div>
          {top_motivos.length === 0 && <div className="text-[10px] text-text-muted">Sin motivos.</div>}
          <div className="flex flex-col gap-0.5">
            {top_motivos.map(m => (
              <div key={m.motivo} className="text-[10px] flex items-center gap-2">
                <span className="flex-1 truncate">{m.motivo}</span>
                <span className="text-text-muted tabular-nums">{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Intervenciones */}
        <div className="panel p-2">
          <div className="text-text-muted text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Wrench size={10} className="text-brand" /> Intervenciones <span className="text-text-muted">({intervenciones_count})</span>
          </div>
          {intervenciones_recientes.length === 0 && <div className="text-[10px] text-text-muted">Ninguna hoy.</div>}
          <div className="flex flex-col gap-0.5">
            {intervenciones_recientes.map(i => (
              <div key={i.intervention_id} className="text-[10px] flex items-center gap-1.5">
                <span>{ACTION_ICON[i.action] ?? '🛠️'}</span>
                <span className="flex-1 truncate" title={i.reason ?? ''}>{i.action}</span>
                <span className="text-text-muted">{i.admin_name.split(' ')[0]}</span>
                <span className="text-text-muted text-[9px]">{i.created_at.slice(11, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, className, icon: Icon }: {
  label: string; value: number; className?: string;
  icon: any | null;
}) {
  return (
    <div className={`p-2 rounded ${className ?? 'bg-bg-700/40'}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70">
        {Icon && <Icon size={10} />}
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums leading-tight">{value}</div>
    </div>
  );
}
