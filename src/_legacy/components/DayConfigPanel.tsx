import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, Building2, ChevronDown, ChevronRight, Clock,
  Pause, Play, RefreshCcw, Star, Truck,
} from 'lucide-react';
import { api } from '../api';
import { PlanEmpresaLegacy, PlanVisit, Priority } from '../types';
import { useAuth } from '../hooks/useAuth';

const PRIO_COLORS: Record<Priority, string> = {
  low: 'pill-blue',
  normal: '',
  high: 'pill-yellow',
  vip: 'pill-violet',
};
const PRIO_LABEL: Record<Priority, string> = {
  low: 'Baja', normal: 'Normal', high: 'Alta', vip: 'VIP',
};

export function DayConfigPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const stateQ = useQuery({ queryKey: ['state'], queryFn: api.state, refetchInterval: 5000 });
  const planQ = useQuery<{ planned_date: string; sim_clock: string; empresas: PlanEmpresaLegacy[] }>({
    queryKey: ['plan-diario-cfg'],
    queryFn: () => api.planDiario({ legacy: true }) as any,
    refetchInterval: 10000,
  });
  const prioritiesQ = useQuery({ queryKey: ['priorities-cfg'], queryFn: () => api.priorities.list() });
  const vipQ = useQuery({ queryKey: ['vip-cfg'], queryFn: () => api.vip.list() });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['plan-diario-cfg'] });
    qc.invalidateQueries({ queryKey: ['priorities-cfg'] });
    qc.invalidateQueries({ queryKey: ['vip-cfg'] });
    qc.invalidateQueries({ queryKey: ['state'] });
  };

  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const showFlash = (kind: 'ok' | 'err', msg: string) => {
    setFlash({ kind, msg });
    setTimeout(() => setFlash(null), 4000);
  };

  const freezeMut = useMutation({
    mutationFn: api.postFreeze,
    onSuccess: () => { showFlash('ok', 'Día congelado a las 09:00'); refreshAll(); },
    onError: (e: Error) => showFlash('err', e.message),
  });
  const startDayMut = useMutation({
    mutationFn: (regen: boolean) => api.postStartDay({ regen_plan: regen }),
    onSuccess: () => { showFlash('ok', 'Día iniciado, reloj corriendo'); refreshAll(); },
    onError: (e: Error) => showFlash('err', e.message),
  });
  const resetMut = useMutation({
    mutationFn: api.postReset,
    onSuccess: r => { showFlash('ok', `Plan regenerado (seed ${r?.day_seed ?? '?'})`); refreshAll(); },
    onError: (e: Error) => showFlash('err', e.message),
  });

  const isAdmin = user?.role === 'falabella_admin';
  const planned = planQ.data;
  const isPaused = stateQ.data?.auto_advance === false;
  const simClock = stateQ.data?.sim_clock;
  const today = stateQ.data?.today;

  // Mapa rápido de overrides activos
  const prioMap = useMemo(() => {
    const m: Record<string, Priority> = {};
    for (const p of prioritiesQ.data ?? []) m[p.tracking_id] = p.priority;
    return m;
  }, [prioritiesQ.data]);

  // Stats de prioridad
  const stats = useMemo(() => {
    if (!planned) return null;
    let total = 0, vip = 0, high = 0, low = 0;
    for (const e of planned.empresas) for (const d of e.drivers) for (const v of d.visits) {
      total++;
      const p = (prioMap[v.tracking_id] ?? v.priority) as Priority;
      if (p === 'vip') vip++;
      if (p === 'high') high++;
      if (p === 'low') low++;
    }
    return { total, vip, high, low };
  }, [planned, prioMap]);

  if (!isAdmin) {
    return (
      <div className="panel p-6 text-center text-text-muted">
        <AlertCircle size={32} className="mx-auto mb-2 text-accent-yellow" />
        <div>Esta sección requiere rol <span className="text-accent-yellow">falabella_admin</span>.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header de control */}
      <div className="panel p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Día actual</div>
            <div className="text-lg font-semibold flex items-center gap-2">
              <Clock size={16} />
              {today ?? '—'}
              {' · '}
              <span className="font-mono">{simClock?.slice(11, 16) ?? '—'}</span>
              <span className={`pill ${isPaused ? 'pill-yellow' : 'pill-green'}`}>
                {isPaused ? 'CONGELADO' : 'CORRIENDO'}
              </span>
              <span className="pill pill-blue">seed {stateQ.data?.day_seed ?? 0}</span>
            </div>
            <div className="text-xs text-text-muted mt-1">
              {stats ? `${stats.total} visitas · ${stats.vip} VIP · ${stats.high} alta · ${stats.low} baja` : 'Cargando...'}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!isPaused) {
                  if (!confirm('El día está corriendo. ¿Querés regenerar el plan ahora? Se perderán los incidentes manuales.')) return;
                }
                resetMut.mutate({});
              }}
              className="btn flex items-center gap-2"
              disabled={resetMut.isPending}
              title="Genera otro plan para el mismo día (nuevo seed). Reloj vuelve a 09:00."
            >
              <RefreshCcw size={14} /> Nuevo plan
            </button>
            <button
              onClick={() => freezeMut.mutate()}
              className={`flex items-center gap-2 ${isPaused ? 'btn-primary opacity-60' : 'btn-danger'}`}
              disabled={freezeMut.isPending || isPaused}
              title={isPaused ? 'Ya está congelado' : 'Congela el día a las 09:00 y pausa el reloj'}
            >
              <Pause size={14} /> {isPaused ? 'Congelado ✓' : 'Congelar 09:00'}
            </button>
            <button
              onClick={() => startDayMut.mutate(false)}
              className={`flex items-center gap-2 ${!isPaused ? 'btn opacity-60' : 'btn-primary'}`}
              disabled={startDayMut.isPending || !isPaused}
              title={!isPaused ? 'El día ya está corriendo' : 'Arranca el reloj con el plan y prioridades configuradas'}
            >
              <Play size={14} /> {!isPaused ? 'Corriendo ✓' : 'Iniciar día'}
            </button>
          </div>
        </div>

        {flash && (
          <div className={`mt-3 px-3 py-2 rounded text-xs flex items-center gap-2 ${
            flash.kind === 'ok'
              ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
              : 'bg-accent-red/10 border border-accent-red/30 text-accent-red'
          }`}>
            {flash.kind === 'ok' ? '✅' : '❌'} {flash.msg}
          </div>
        )}

        {!isPaused && !flash && (
          <div className="mt-3 px-3 py-2 bg-accent-yellow/10 border border-accent-yellow/30 rounded text-xs text-accent-yellow flex items-center gap-2">
            <AlertCircle size={14} />
            El día está corriendo. Para configurar prioridades sin que avance el reloj, presioná <span className="font-semibold">Congelar 09:00</span>.
          </div>
        )}
      </div>

      {/* VIP bulk action */}
      <VipBulkSection vipCount={vipQ.data?.length ?? 0} onChanged={refreshAll} />

      {/* Plan agrupado */}
      {planQ.isLoading || !planned ? (
        <div className="panel p-4 text-text-muted text-xs">Cargando plan...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {planned.empresas.map(e => (
            <EmpresaBlock key={e.empresa_id} empresa={e} prioMap={prioMap} onChanged={refreshAll} />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// VIP Bulk
// =============================================================================
function VipBulkSection({ vipCount, onChanged }: { vipCount: number; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [matchType, setMatchType] = useState<'title' | 'customer_id' | 'reference'>('title');
  const [matchValue, setMatchValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="panel-title w-full flex items-center justify-between hover:bg-bg-700/30"
      >
        <span className="flex items-center gap-2">
          <Star size={14} className="text-accent-violet" />
          Marcar clientes como VIP ({vipCount} configurados)
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="px-3 py-3 border-t border-line">
          <div className="flex gap-2 flex-wrap items-end">
            <label className="flex-shrink-0">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Tipo</div>
              <select className="input" value={matchType}
                      onChange={e => setMatchType(e.target.value as any)}>
                <option value="title">Razón social</option>
                <option value="customer_id">Customer ID</option>
                <option value="reference">Referencia</option>
              </select>
            </label>
            <label className="flex-1 min-w-[240px]">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Valor</div>
              <input className="input w-full" value={matchValue}
                     onChange={e => setMatchValue(e.target.value)}
                     placeholder={matchType === 'title' ? 'ej: Wilnoscar Zurita Carrero' : 'ID o referencia exacta'} />
            </label>
            <button
              onClick={async () => {
                if (!matchValue.trim()) return;
                setSubmitting(true); setErr(null);
                try {
                  await api.vip.create({
                    match_type: matchType,
                    match_value: matchValue.trim(),
                    empresa_id: null,
                    tier: 'VIP',
                  });
                  setMatchValue('');
                  onChanged();
                } catch (ex: any) { setErr(ex.message); }
                finally { setSubmitting(false); }
              }}
              className="btn-primary"
              disabled={submitting || !matchValue.trim()}
            >
              {submitting ? 'Agregando...' : 'Marcar VIP'}
            </button>
          </div>
          {err && <div className="text-accent-red text-xs mt-2">{err}</div>}
          <div className="text-[11px] text-text-muted mt-2">
            Los VIP marcados aplican globalmente. Las visitas que coincidan se mostrarán con prioridad VIP automáticamente y dispararán notificaciones aunque no superen el umbral de p(fallo).
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Empresa block (collapsible)
// =============================================================================
function EmpresaBlock({ empresa, prioMap, onChanged }: {
  empresa: PlanEmpresaLegacy;
  prioMap: Record<string, Priority>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="panel-title w-full flex items-center justify-between hover:bg-bg-700/30"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Building2 size={14} />
          {empresa.nombre} <span className="text-text-muted">#{empresa.empresa_id}</span>
        </span>
        <span className="flex gap-2 text-[11px]">
          <span>{empresa.total_visits} visitas</span>
          {empresa.vip_visits > 0 && <span className="pill pill-violet">{empresa.vip_visits} VIP</span>}
          {empresa.high_priority > 0 && <span className="pill pill-yellow">{empresa.high_priority} alta</span>}
          {empresa.red_visits > 0 && <span className="pill pill-red">{empresa.red_visits} en rojo</span>}
        </span>
      </button>
      {open && (
        <div className="border-t border-line">
          {empresa.drivers.map(d => (
            <div key={d.vehicle_id} className="px-3 py-2 border-b border-line/50 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs flex items-center gap-2">
                  <Truck size={12} className="text-text-muted" />
                  <span className="font-semibold">{d.vehicle_name}</span>
                  <span className="text-text-muted">— {d.driver_name}</span>
                </div>
                <BulkPriorityForVehicle visits={d.visits} prioMap={prioMap} onChanged={onChanged} />
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                    <th className="px-2 py-1 text-left w-8">#</th>
                    <th className="px-2 py-1 text-left">Cliente</th>
                    <th className="px-2 py-1 text-left">Ventana</th>
                    <th className="px-2 py-1 text-right">p(fallo)</th>
                    <th className="px-2 py-1 text-left w-44">Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {d.visits.map(v => (
                    <VisitRow key={v.tracking_id} visit={v}
                               currentPrio={prioMap[v.tracking_id] ?? v.priority}
                               onChanged={onChanged} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Visit row con dropdown de prioridad
// =============================================================================
function VisitRow({ visit, currentPrio, onChanged }: {
  visit: PlanVisit;
  currentPrio: Priority;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const setPrio = async (p: Priority) => {
    setBusy(true);
    try {
      if (p === 'normal' && currentPrio !== 'normal') {
        await api.priorities.clear(visit.tracking_id);
      } else if (p !== 'normal') {
        await api.priorities.set(visit.tracking_id, p);
      }
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <tr className={`border-t border-line/30 hover:bg-bg-700/30 ${visit.is_vip ? 'bg-accent-violet/5' : ''}`}>
      <td className="px-2 py-1 text-text-muted tabular-nums">{visit.order}</td>
      <td className="px-2 py-1 truncate max-w-[300px]" title={visit.title}>
        <div className="truncate">{visit.title}</div>
        {visit.is_vip && <span className="text-[9px] text-accent-violet">★ Cliente VIP</span>}
      </td>
      <td className="px-2 py-1 font-mono text-[11px]">
        {(visit.window_start ?? '').slice(0, 5)} – {(visit.window_end ?? '').slice(0, 5)}
      </td>
      <td className={`px-2 py-1 text-right tabular-nums ${
        visit.p_fallo >= 0.5 ? 'text-accent-red' : visit.p_fallo >= 0.3 ? 'text-accent-yellow' : 'text-text-secondary'
      }`}>{(visit.p_fallo * 100).toFixed(0)}%</td>
      <td className="px-2 py-1">
        <div className="flex gap-1">
          {(['low', 'normal', 'high', 'vip'] as Priority[]).map(p => (
            <button
              key={p}
              onClick={() => setPrio(p)}
              disabled={busy}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                currentPrio === p
                  ? `${PRIO_COLORS[p]} border-current font-semibold`
                  : 'border-line text-text-muted hover:border-accent-blue hover:text-accent-blue'
              }`}
              title={p === 'normal' ? 'Quitar override' : `Marcar como ${PRIO_LABEL[p]}`}
            >
              {PRIO_LABEL[p]}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

// =============================================================================
// Bulk priority por vehículo
// =============================================================================
function BulkPriorityForVehicle({ visits, prioMap, onChanged }: {
  visits: PlanVisit[];
  prioMap: Record<string, Priority>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const promoteRiskyVisits = async () => {
    const candidates = visits.filter(v =>
      v.p_fallo >= 0.5 && (prioMap[v.tracking_id] ?? v.priority) === 'normal'
    );
    if (!candidates.length) return;
    setBusy(true);
    try {
      for (const v of candidates) {
        await api.priorities.set(v.tracking_id, 'high', `auto: p_fallo=${(v.p_fallo*100).toFixed(0)}%`);
      }
      onChanged();
    } finally { setBusy(false); }
  };

  const riskyCount = visits.filter(v =>
    v.p_fallo >= 0.5 && (prioMap[v.tracking_id] ?? v.priority) === 'normal'
  ).length;

  if (riskyCount === 0) return null;
  return (
    <button
      onClick={promoteRiskyVisits}
      disabled={busy}
      className="text-[10px] text-accent-yellow hover:underline flex items-center gap-1"
      title="Marca como Alta prioridad todas las visitas con p(fallo) ≥ 50% que aún están en Normal"
    >
      <AlertCircle size={10} />
      Subir {riskyCount} con p≥50% → Alta
    </button>
  );
}
