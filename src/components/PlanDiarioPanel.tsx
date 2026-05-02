import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Crown, Map as MapIcon, MapPin, Route as RouteIcon,
  Star, Truck, User, X,
} from 'lucide-react';
import { api } from '../api';
import { PlanRuta, PlanVisit, Priority, RegionFilter, TrackingNotifSummary } from '../types';
import { useAuth } from '../hooks/useAuth';
import { NotifiedBadge } from './NotifiedBadge';

// Sprint 6 helper: detecta si una visita pendiente está atrasada vs ETA esperado.
// Si ya pasaron >30 min desde current_eta_cl y aún está pending, devuelve true.
function isEtaLate(v: PlanVisit, simClock?: string): boolean {
  if (v.status !== 'pending') return false;
  if (!v.current_eta_cl) return false;
  try {
    const eta = new Date(v.current_eta_cl.replace(' UTC', '').replace(' ', 'T'));
    const now = simClock ? new Date(simClock) : new Date();
    return (now.getTime() - eta.getTime()) > 30 * 60 * 1000;
  } catch {
    return false;
  }
}

// =============================================================================
// PlanDiarioPanel: jerarquía Empresa → Ruta → Visitas (Sprint 2)
// =============================================================================
export interface PlanDiarioFilterOverrides {
  region?: RegionFilter;
  onlyVip?: boolean;
  empresaId?: number | 'all';
  /** Si true, oculta la barra de filtros local (porque el padre los provee) */
  hideLocalFilters?: boolean;
}

export function PlanDiarioPanel({ filters }: { filters?: PlanDiarioFilterOverrides } = {}) {
  const { isFalabella, isAdmin } = useAuth();
  const empresasQ = useQuery({ queryKey: ['empresas'], queryFn: api.empresas, enabled: isFalabella });
  const [selectedEmpresaLocal, setSelectedEmpresaLocal] = useState<number | 'all'>('all');
  const [regionLocal, setRegionLocal] = useState<RegionFilter>('all');
  const [onlyVipLocal, setOnlyVipLocal] = useState(false);

  const region = filters?.region ?? regionLocal;
  const onlyVip = filters?.onlyVip ?? onlyVipLocal;
  const selectedEmpresa = filters?.empresaId ?? selectedEmpresaLocal;
  const hideLocalFilters = !!filters?.hideLocalFilters;

  const planQ = useQuery({
    queryKey: ['plan-diario', selectedEmpresa, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: selectedEmpresa === 'all' ? undefined : selectedEmpresa,
      region,
      only_vip: onlyVip,
    }),
    refetchInterval: 5_000,
  });

  // Notificaciones por tracking_id (bulk)
  const allTids = useMemo(() => {
    const ids: string[] = [];
    planQ.data?.empresas.forEach(e => e.rutas.forEach(r => r.visitas.forEach(v => ids.push(v.tracking_id))));
    return ids;
  }, [planQ.data]);
  const notifMapQ = useQuery({
    queryKey: ['plan-notif-summary', allTids.length],
    queryFn: () => api.notif.byTrackings(allTids),
    enabled: allTids.length > 0,
    refetchInterval: 15_000,
  });
  const notifMap: Record<string, TrackingNotifSummary> = notifMapQ.data ?? {};

  const totals = useMemo(() => {
    const empresas = planQ.data?.empresas ?? [];
    return {
      empresas: empresas.length,
      rutas: empresas.reduce((s, e) => s + e.rutas.length, 0),
      visits: empresas.reduce((s, e) => s + e.total_visitas, 0),
      completadas: empresas.reduce((s, e) => s + e.completadas, 0),
      red: empresas.reduce((s, e) => s + e.red_visitas, 0),
      vip: empresas.reduce((s, e) => s + e.vip_visitas, 0),
      enRiesgo: empresas.reduce((s, e) => s + e.en_riesgo, 0),
    };
  }, [planQ.data]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="panel">
        <div className="panel-title flex items-center gap-2 flex-wrap">
          <span>Plan del día · {planQ.data?.planned_date ?? '—'}</span>

          {!hideLocalFilters && (
            <>
              {/* Tabs región */}
              <div className="ml-2 flex items-center gap-0 border border-line rounded overflow-hidden text-[11px] normal-case tracking-normal">
                {(['all', 'RM', 'regiones'] as RegionFilter[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRegionLocal(r)}
                    className={`px-2 py-1 ${region === r ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-700/50'}`}
                    title={r === 'all' ? 'Todas las regiones' : r === 'RM' ? 'Sólo Región Metropolitana' : 'Sólo regiones'}
                  >
                    <MapIcon size={11} className="inline mr-1" />
                    {r === 'all' ? 'Todos' : r === 'RM' ? 'RM' : 'Regiones'}
                  </button>
                ))}
              </div>

              {/* Toggle Solo VIP */}
              <label className="flex items-center gap-1.5 text-[11px] normal-case tracking-normal cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVip}
                  onChange={e => setOnlyVipLocal(e.target.checked)}
                  className="accent-cmr"
                />
                <Star size={11} className="text-cmr" />
                Solo VIP
              </label>

              {isFalabella && (
                <select
                  value={selectedEmpresa}
                  onChange={e => setSelectedEmpresaLocal(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="input ml-auto normal-case tracking-normal"
                >
                  <option value="all">Todas las empresas</option>
                  {empresasQ.data?.map(e => (
                    <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <Stat label="Empresas" value={totals.empresas} icon={Building2} />
          <Stat label="Rutas" value={totals.rutas} icon={Truck} />
          <Stat label="Visitas" value={totals.visits} icon={MapPin} />
          <Stat label="Completadas" value={totals.completadas} icon={CheckCircle2} accent="text-brand" />
          <Stat label="En riesgo" value={totals.enRiesgo} icon={AlertTriangle} accent="text-accent-yellow" />
          <Stat label="RED pendientes" value={totals.red} icon={AlertTriangle} accent="text-accent-red" />
          <Stat label="VIP" value={totals.vip} icon={Star} accent="text-cmr" />
        </div>
      </div>

      {/* Empresas → Rutas */}
      {planQ.data?.empresas.map(emp => (
        <EmpresaSection
          key={emp.empresa_id}
          empresa={emp}
          canMarkVip={isAdmin}
          notifMap={notifMap}
          simClock={planQ.data?.sim_clock}
        />
      ))}

      {!planQ.data?.empresas.length && (
        <div className="panel p-6 text-center text-text-muted text-sm">
          No hay visitas planificadas para los filtros seleccionados.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: {
  label: string; value: number | string; icon: any; accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        <Icon size={10} /> {label}
      </span>
      <span className={`text-xl font-semibold tabular-nums ${accent ?? ''}`}>{value}</span>
    </div>
  );
}

function EmpresaSection({ empresa, canMarkVip, notifMap, simClock }: {
  empresa: any; canMarkVip: boolean; notifMap: Record<string, TrackingNotifSummary>;
  simClock?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full panel-title flex items-center gap-2 hover:bg-bg-700/30 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Building2 size={13} />
        <span>{empresa.empresa_nombre}</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] font-normal normal-case tracking-normal text-text-muted">
          <span>{empresa.rutas.length} rutas</span>
          <span>{empresa.total_visitas} visitas</span>
          {empresa.completadas > 0 && (
            <span className="text-brand">{empresa.completadas} OK</span>
          )}
          {empresa.fallidas > 0 && (
            <span className="text-accent-red">{empresa.fallidas} fallidas</span>
          )}
          {empresa.en_riesgo > 0 && (
            <span className="text-accent-yellow">{empresa.en_riesgo} en riesgo</span>
          )}
          {empresa.vip_visitas > 0 && (
            <span className="text-cmr">★ {empresa.vip_visitas}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="flex flex-col">
          {empresa.rutas.map((r: PlanRuta) => (
            <RutaRow
              key={r.ruta_id}
              ruta={r}
              canMarkVip={canMarkVip}
              notifMap={notifMap}
              simClock={simClock}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RutaRow({ ruta, canMarkVip, notifMap, simClock }: {
  ruta: PlanRuta; canMarkVip: boolean; notifMap: Record<string, TrackingNotifSummary>;
  simClock?: string;
}) {
  const [open, setOpen] = useState(false);
  const pct = ruta.progreso_pct;
  const nextOrder = ruta.next_stop_order ?? ruta.orden_actual;
  const isActive = ruta.pendientes > 0 && ruta.completadas > 0;

  // Sprint 6: ETA del próximo stop pendiente para mostrar en el header
  const nextEta = useMemo(() => {
    if (nextOrder == null) return '';
    const v = ruta.visitas.find(x => x.order === nextOrder);
    return v?.estimated_time_arrival ?? '';
  }, [ruta.visitas, nextOrder]);

  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-bg-700/30 text-xs transition-colors text-left"
      >
        <span className="mt-0.5">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>

        {/* Sprint 6: ruta_id grande + meta inline */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* ruta_id como chip grande tipográfico */}
            <span className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-brand bg-brand/10 border border-brand/40 rounded px-2 py-0.5 tracking-tight">
              <RouteIcon size={11} />
              {ruta.ruta_id || '—'}
            </span>
            <span className="text-text-muted">·</span>
            <Truck size={11} className={isActive ? 'text-brand animate-pulse' : 'text-text-secondary'} />
            <span className="font-mono text-text-secondary">{ruta.patente ?? ruta.plate ?? ruta.vehicle_name}</span>
            <span className="text-text-muted">·</span>
            <User size={10} className="text-text-muted" />
            <span className="text-text-secondary truncate max-w-[180px]" title={ruta.driver_name}>{ruta.driver_name}</span>
            {ruta.ct && (
              <>
                <span className="text-text-muted">·</span>
                <span className="text-[10px] uppercase tracking-wider text-accent-blue/80 font-semibold">{ruta.ct}</span>
              </>
            )}
            {ruta.region && ruta.region !== 'RM' && (
              <span className="text-[10px] px-1 bg-accent-violet/15 text-accent-violet border border-accent-violet/40 rounded">
                {ruta.region}
              </span>
            )}
          </div>

          {/* Barra de progreso + KPIs */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[140px] max-w-[320px]">
              <div className="flex-1 h-1.5 bg-bg-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    pct === 100 ? 'bg-brand'
                    : pct >= 50 ? 'bg-brand'
                    : pct > 0 ? 'bg-accent-yellow'
                    : 'bg-bg-600'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-text-muted tabular-nums text-[11px] shrink-0">{pct.toFixed(0)}%</span>
            </div>
            <span className="text-text-muted text-[11px]">{ruta.completadas}/{ruta.total_visitas}</span>
            {nextOrder != null && (
              <span className="text-brand text-[11px] tabular-nums">
                Próximo stop: #{nextOrder}{nextEta && <span className="text-text-muted ml-1">({nextEta})</span>}
              </span>
            )}
            {ruta.red_visitas > 0 && <span className="text-accent-red text-[11px]">{ruta.red_visitas} RED</span>}
            {ruta.en_riesgo > 0 && <span className="text-accent-yellow text-[11px]">⚠ {ruta.en_riesgo}</span>}
            {ruta.vip_visitas > 0 && <span className="text-cmr text-[11px]">★ {ruta.vip_visitas}</span>}
            {ruta.high_priority > 0 && <span className="text-accent-yellow text-[11px]">▲ {ruta.high_priority}</span>}
          </div>
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-text-muted uppercase tracking-wider text-[10px] border-t border-b border-line/60 bg-bg-700/30">
              <tr>
                <th className="px-2 py-1 text-left w-10">#</th>
                <th className="px-2 py-1 text-left w-14">ETA</th>
                <th className="px-2 py-1 text-left">Cliente · Comuna</th>
                <th className="px-2 py-1 text-center w-16">Status</th>
                <th className="px-2 py-1 text-right w-16">P(fallo)</th>
                <th className="px-2 py-1 text-center w-8"></th>
              </tr>
            </thead>
            <tbody>
              {ruta.visitas.map((v: PlanVisit) => (
                <VisitRow
                  key={v.tracking_id}
                  v={v}
                  canMarkVip={canMarkVip}
                  isNext={v.order === nextOrder}
                  notif={notifMap[v.tracking_id]}
                  simClock={simClock}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VisitRow({ v, canMarkVip, isNext = false, notif, simClock }: {
  v: PlanVisit; canMarkVip: boolean; isNext?: boolean; notif?: TrackingNotifSummary;
  simClock?: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const setPriorityMut = useMutation({
    mutationFn: (req: { priority: Priority; reason?: string }) =>
      api.priorities.set(v.tracking_id, req.priority, req.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan-diario'] });
      setEditing(false);
    },
  });

  const markVipMut = useMutation({
    mutationFn: () => api.vip.create({
      match_type: 'title',
      match_value: v.cliente_nombre,
      tier: 'VIP',
      notes: `Marcado desde Plan Diario · ${v.tracking_id}`,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-diario'] }),
  });

  const slackClass =
    v.slack_min < 0 ? 'text-accent-red'
    : v.slack_min < 20 ? 'text-accent-yellow'
    : 'text-brand';
  const rowClass =
    v.status === 'completed' ? 'opacity-70'
    : isNext ? 'bg-accent-yellow/10 border-l-2 border-l-accent-yellow'
    : v.is_vip ? 'bg-cmr/5'
    : v.priority === 'high' ? 'bg-accent-red/5'
    : '';

  return (
    <>
      <tr className={`border-t border-line/30 hover:bg-bg-700/20 cursor-pointer ${rowClass}`} onClick={() => setExpanded(e => !e)}>
        <td className="px-2 py-1.5 font-mono text-text-muted">
          {isNext && <span className="text-accent-yellow mr-1">▶</span>}
          {v.order}
        </td>
        <td className={`px-2 py-1.5 tabular-nums ${
          isEtaLate(v, simClock) ? 'text-accent-red font-semibold' : 'text-text-secondary'
        }`}>
          <Clock size={10} className="inline mr-1" />
          {v.estimated_time_arrival ? v.estimated_time_arrival.slice(0, 5) : '—'}
        </td>
        <td className="px-2 py-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            {v.is_vip && <Crown size={11} className="text-cmr shrink-0" />}
            {v.alert_valuedata && <AlertTriangle size={10} className="text-accent-violet shrink-0" />}
            <span className="font-medium truncate max-w-[260px]">{v.cliente_nombre}</span>
            {/* Sprint 6: Folio destacado solo para VIP */}
            {v.is_vip && v.folio && (
              <span
                className="text-[10px] px-1.5 py-0.5 bg-cmr/15 text-cmr border border-cmr/40 rounded font-mono font-semibold inline-flex items-center gap-0.5"
                title={`Folio VIP ${v.folio}`}
              >
                <Crown size={9} /> {v.folio}
              </span>
            )}
            {v.is_vip && v.vip_deadline_time && (
              <span
                className="text-[9px] px-1 bg-accent-red/15 text-accent-red border border-accent-red/30 rounded font-mono inline-flex items-center gap-0.5"
                title={`Deadline VIP: llegar antes de ${v.vip_deadline_time}`}
              >
                <Clock size={8} />
                {v.vip_deadline_time}
              </span>
            )}
            <NotifiedBadge summary={notif} size="xs" />
          </div>
          <div className="text-[10px] text-text-muted truncate flex items-center gap-1">
            {v.comuna && <span>{v.comuna}</span>}
            {v.region && v.region !== 'RM' && (
              <span className="text-accent-violet/80">· {v.region}</span>
            )}
            {/* Folio gris cuando NO es VIP */}
            {!v.is_vip && v.folio && (
              <span className="font-mono text-text-muted">· {v.folio}</span>
            )}
          </div>
        </td>
        <td className="px-2 py-1.5 text-center">
          <span className={`pill ${v.status === 'completed' ? 'pill-green' : v.alert_slack === 'RED' ? 'pill-red' : v.alert_slack === 'YELLOW' ? 'pill-yellow' : 'pill-blue'}`}>
            {v.status === 'completed' ? 'OK' : v.alert_slack}
          </span>
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">
          <span className={v.p_fallo >= 0.5 ? 'text-accent-red' : v.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'}>
            {(v.p_fallo * 100).toFixed(0)}%
          </span>
        </td>
        <td className="px-2 py-1.5 text-center text-text-muted">
          {expanded ? <ChevronDown size={12} className="inline" /> : <ChevronRight size={12} className="inline" />}
        </td>
      </tr>
      {expanded && (
        <tr className={`bg-bg-800/40 ${rowClass}`}>
          <td></td>
          <td colSpan={5} className="px-3 py-2 text-[11px] text-text-secondary">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted">Dirección</div>
                <div className="truncate" title={v.address}>{v.address}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted">Slack</div>
                <div className={`tabular-nums font-semibold ${slackClass}`}>{v.slack_min.toFixed(0)} min</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted">Prioridad</div>
                <div><PriorityPill p={v.priority} /></div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted">Tracking</div>
                <div className="font-mono truncate">{v.tracking_id}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2" onClick={e => e.stopPropagation()}>
              {editing ? (
                <PriorityEditor
                  current={v.priority}
                  onSave={(p, reason) => setPriorityMut.mutate({ priority: p, reason })}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="btn text-[10px] flex items-center gap-1"
                    title="Cambiar prioridad"
                  >
                    Cambiar prioridad
                  </button>
                  {canMarkVip && !v.is_vip && (
                    <button
                      onClick={() => markVipMut.mutate()}
                      disabled={markVipMut.isPending}
                      className="btn text-[10px] flex items-center gap-1 hover:text-cmr"
                      title="Marcar cliente como VIP (title match)"
                    >
                      <Star size={10} /> Marcar VIP
                    </button>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PriorityPill({ p }: { p: PlanVisit['priority'] }) {
  const cls: Record<PlanVisit['priority'], string> = {
    vip: 'bg-cmr/20 text-cmr border-cmr/40',
    high: 'bg-accent-red/20 text-accent-red border-accent-red/40',
    normal: 'bg-bg-700 text-text-secondary border-line',
    low: 'bg-bg-700 text-text-muted border-line',
  };
  return <span className={`pill border ${cls[p]}`}>{p.toUpperCase()}</span>;
}

function PriorityEditor({ current, onSave, onCancel }: {
  current: Priority; onSave: (p: Priority, reason?: string) => void; onCancel: () => void;
}) {
  const [p, setP] = useState<Priority>(current);
  const [reason, setReason] = useState('');
  return (
    <div className="absolute bg-bg-800 border border-line rounded-md shadow-xl p-2 flex flex-col gap-1 z-10"
         style={{ transform: 'translate(-50%, -50%)', position: 'fixed', top: '50%', left: '50%' }}>
      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-text-muted">Prioridad:</span>
        {(['low', 'normal', 'high', 'vip'] as Priority[]).map(pp => (
          <button
            key={pp}
            onClick={() => setP(pp)}
            className={`px-2 py-0.5 rounded border text-[10px] ${p === pp ? 'bg-brand/20 border-brand text-brand' : 'border-line text-text-secondary'}`}
          >
            {pp}
          </button>
        ))}
      </div>
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        className="input text-[11px]"
      />
      <div className="flex items-center gap-1">
        <button onClick={() => onSave(p, reason || undefined)} className="btn-primary text-[10px]">Guardar</button>
        <button onClick={onCancel} className="btn text-[10px]"><X size={10} /></button>
      </div>
    </div>
  );
}
