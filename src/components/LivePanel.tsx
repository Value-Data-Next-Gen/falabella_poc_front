import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertOctagon, AlertTriangle, BookOpen, CheckCircle2, Clock, Database,
  Loader2, Play, Pause, Plus, RefreshCcw, Rewind, Trash2, Truck, XCircle, Zap, Wrench, Radio, Wifi,
} from 'lucide-react';
import { api } from '../api';
import { EventType, StreamEvent } from '../types';
import { useAuth } from '../hooks/useAuth';
import { AlgorithmModal } from './AlgorithmModal';

const META: Record<EventType, { icon: any; color: string; bg: string; label: string }> = {
  delivery:         { icon: CheckCircle2, color: 'text-brand',         bg: 'bg-brand/10',         label: 'Entrega OK' },
  failed_delivery:  { icon: XCircle,       color: 'text-accent-red',    bg: 'bg-accent-red/10',    label: 'Entrega tardía' },
  alert_triggered:  { icon: Zap,           color: 'text-accent-violet', bg: 'bg-accent-violet/10', label: 'Alerta VD' },
  alert_cleared:    { icon: CheckCircle2,  color: 'text-text-secondary',bg: 'bg-bg-700',           label: 'Alerta resuelta' },
  red_simpli:       { icon: AlertTriangle, color: 'text-accent-red',    bg: 'bg-accent-red/10',    label: 'RED SimpliRoute' },
  incident_auto:    { icon: AlertOctagon,  color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', label: 'Incidente auto' },
  incident_manual:  { icon: Wrench,        color: 'text-accent-yellow', bg: 'bg-accent-yellow/10', label: 'Incidente manual' },
  day_reset:        { icon: RefreshCcw,    color: 'text-accent-blue',   bg: 'bg-accent-blue/10',   label: 'Reset día' },
};

const EVENT_ORDER: EventType[] = [
  'delivery', 'failed_delivery', 'alert_triggered', 'alert_cleared',
  'red_simpli', 'incident_auto', 'incident_manual', 'day_reset',
];

export function LivePanel() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const stateQ = useQuery({ queryKey: ['state-live'], queryFn: api.state, refetchInterval: 2000 });
  const kpisQ  = useQuery({ queryKey: ['kpis-live'],  queryFn: () => api.kpis(), refetchInterval: 2000 });
  const eventsQ = useQuery({ queryKey: ['events-live'], queryFn: () => api.events(120), refetchInterval: 2000 });
  const liveGenQ = useQuery({ queryKey: ['live-gen-stats'], queryFn: api.liveGen.stats, refetchInterval: 3000 });

  const toggleMut = useMutation({
    mutationFn: (enabled: boolean) => api.liveGen.toggle(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live-gen-stats'] }),
  });
  const resetMut = useMutation({
    mutationFn: api.liveGen.reset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live-gen-stats'] }),
  });

  const [helpOpen, setHelpOpen] = useState(false);
  const [batchRows, setBatchRows] = useState(1800);
  const [simDays, setSimDays] = useState(7);
  const [simRows, setSimRows] = useState(1500);

  const batchMut = useMutation({
    mutationFn: () => api.liveGen.batch(batchRows),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live-gen-stats'] }),
  });
  const simMut = useMutation({
    mutationFn: () => api.liveGen.simulateDays(simDays, simRows, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['live-gen-stats'] }),
  });

  const [rowsFlash, setRowsFlash] = useState(false);
  const lastRowsRef = useRef<number>(0);
  useEffect(() => {
    const n = liveGenQ.data?.rows_today_db ?? 0;
    if (lastRowsRef.current && n > lastRowsRef.current) {
      setRowsFlash(true);
      const t = setTimeout(() => setRowsFlash(false), 900);
      lastRowsRef.current = n;
      return () => clearTimeout(t);
    }
    lastRowsRef.current = n;
  }, [liveGenQ.data?.rows_today_db]);

  const [flashId, setFlashId] = useState<string | null>(null);
  const [wallClock, setWallClock] = useState(Date.now());
  const lastEventIdRef = useRef<string | null>(null);
  const lastTickSeenRef = useRef<string | null>(null);
  const [pulseTick, setPulseTick] = useState(false);

  // Wall clock tick 1s (para "hace X segundos")
  useEffect(() => {
    const t = setInterval(() => setWallClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Flash cuando llega un evento nuevo
  useEffect(() => {
    const latest = eventsQ.data?.[0]?.event_id;
    if (latest && latest !== lastEventIdRef.current) {
      lastEventIdRef.current = latest;
      setFlashId(latest);
      const t = setTimeout(() => setFlashId(null), 1200);
      return () => clearTimeout(t);
    }
  }, [eventsQ.data]);

  // Pulso cuando avanza el tick del scheduler
  useEffect(() => {
    const lastTick = stateQ.data?.last_tick_at ?? null;
    if (lastTick && lastTick !== lastTickSeenRef.current) {
      lastTickSeenRef.current = lastTick;
      setPulseTick(true);
      const t = setTimeout(() => setPulseTick(false), 700);
      return () => clearTimeout(t);
    }
  }, [stateQ.data?.last_tick_at]);

  const events = eventsQ.data ?? [];
  const state = stateQ.data;
  const kpis = kpisQ.data;

  const simClockTxt = state?.sim_clock
    ? new Date(state.sim_clock).toLocaleTimeString('es-CL', { hour12: false })
    : '--:--:--';
  const lastTickMs = state?.last_tick_at ? wallClock - new Date(state.last_tick_at).getTime() : null;
  const isLive = lastTickMs != null && lastTickMs < 10_000;

  // Contadores por tipo (agregados sobre los últimos 120 eventos)
  const counts = useMemo(() => {
    const c: Record<EventType, number> = {} as any;
    EVENT_ORDER.forEach(t => (c[t] = 0));
    events.forEach(e => { c[e.type] = (c[e.type] ?? 0) + 1; });
    return c;
  }, [events]);

  return (
    <div className="flex flex-col gap-3 p-3 h-full">
      {/* Hero: sim clock + estado sim */}
      <section className="panel">
        <div className="p-4 flex flex-wrap items-center gap-6">
          <div className="flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
              <Clock size={11} /> Reloj simulado
            </div>
            <div className={`text-5xl font-semibold tabular-nums transition-colors ${pulseTick ? 'text-brand' : 'text-text-primary'}`}>
              {simClockTxt}
            </div>
            <div className="text-[11px] text-text-muted">
              {state?.today} · seed {state?.day_seed} · tick cada {state?.sim_minutes_per_tick} min sim
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Estado scheduler</div>
            <div className={`flex items-center gap-2 text-sm font-semibold ${isLive ? 'text-brand' : 'text-accent-yellow'}`}>
              <Radio size={14} className={isLive ? 'animate-pulse' : ''} />
              {isLive ? 'Live · generando datos' : 'Esperando tick'}
            </div>
            <div className="text-[11px] text-text-muted tabular-nums">
              {lastTickMs != null ? `Último tick hace ${(lastTickMs / 1000).toFixed(1)}s` : '—'}
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <MiniStat label="Visitas" value={kpis?.total ?? '—'} />
            <MiniStat label="Completadas" value={kpis?.completed ?? '—'} accent="text-brand" />
            <MiniStat label="Pending" value={kpis?.pending ?? '—'} />
            <MiniStat label="RED" value={kpis?.red_simpliroute ?? '—'} accent="text-accent-red" />
            <MiniStat label="Alertas VD" value={kpis?.vd_alerts ?? '—'} accent="text-accent-violet" />
          </div>
        </div>
      </section>

      {/* Live generator: datos que se guardan en SQL en tiempo real */}
      <section className="panel">
        <div className="panel-title flex items-center gap-2">
          <Database size={13} className="text-brand" />
          Generación de datos en Azure SQL
          <span className={`ml-auto flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal ${
            liveGenQ.data?.enabled ? 'text-brand' : 'text-text-muted'
          }`}>
            <span className={`w-2 h-2 rounded-full ${liveGenQ.data?.enabled ? 'bg-brand animate-pulse' : 'bg-text-muted'}`} />
            {liveGenQ.data?.enabled ? 'activo' : 'pausado'}
          </span>
        </div>
        <div className="p-3 flex flex-wrap items-center gap-4 text-xs">
          <div className={`flex flex-col transition-all ${rowsFlash ? 'scale-105' : ''}`}>
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Filas hoy en SQL</div>
            <div className={`text-3xl font-semibold tabular-nums ${rowsFlash ? 'text-brand' : 'text-text-primary'}`}>
              {liveGenQ.data?.rows_today_db ?? '—'}
            </div>
            <div className="text-[10px] text-text-muted">fpoc.simpli_visits (id ≥ 900B)</div>
          </div>
          <div className="flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Sesión actual</div>
            <div className="text-xl font-semibold tabular-nums">{liveGenQ.data?.total_inserted_session ?? 0}</div>
            <div className="text-[10px] text-text-muted">desde que arrancó el backend</div>
          </div>
          <div className="flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Ritmo</div>
            <div className="text-xl font-semibold tabular-nums">
              {liveGenQ.data ? `${liveGenQ.data.rows_per_tick} / ${liveGenQ.data.interval_sec}s` : '—'}
            </div>
            <div className="text-[10px] text-text-muted">
              ≈ {liveGenQ.data ? ((liveGenQ.data.rows_per_tick * 3600) / liveGenQ.data.interval_sec).toFixed(0) : '—'} rows/h
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Último insert</div>
            <div className="text-xs tabular-nums">
              {liveGenQ.data?.last_insert_at
                ? new Date(liveGenQ.data.last_insert_at + 'Z').toLocaleTimeString('es-CL', { hour12: false })
                : '—'}
            </div>
            {liveGenQ.data?.last_error && (
              <div className="text-[10px] text-accent-red max-w-[240px] truncate" title={liveGenQ.data.last_error}>
                err: {liveGenQ.data.last_error}
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => toggleMut.mutate(!liveGenQ.data?.enabled)}
                className={liveGenQ.data?.enabled ? 'btn' : 'btn-primary'}
                disabled={toggleMut.isPending}
              >
                {liveGenQ.data?.enabled ? (
                  <><Pause size={12} className="inline mr-1" /> Pausar</>
                ) : (
                  <><Play size={12} className="inline mr-1" /> Arrancar</>
                )}
              </button>
              <button
                onClick={() => {
                  if (confirm('¿Borrar todas las rows live-gen de hoy?')) resetMut.mutate();
                }}
                className="btn flex items-center gap-1 text-accent-red"
                disabled={resetMut.isPending}
                title="DELETE de rows del live-gen de hoy (id >= 900B)"
              >
                <Trash2 size={12} /> Limpiar hoy
              </button>
              <button onClick={() => setHelpOpen(true)} className="btn flex items-center gap-1" title="Cómo funciona">
                <BookOpen size={12} /> Cómo funciona
              </button>
            </div>
          )}
          {!isAdmin && (
            <button onClick={() => setHelpOpen(true)} className="btn flex items-center gap-1 ml-auto" title="Cómo funciona">
              <BookOpen size={12} /> Cómo funciona
            </button>
          )}
        </div>

        {/* Controles admin: batch & simulate-days */}
        {isAdmin && (
          <div className="px-3 pb-3 pt-2 border-t border-line grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-2 bg-bg-700/30 rounded border border-line">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
                <Plus size={10} /> Inyectar día en SQL
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={batchRows}
                  onChange={e => setBatchRows(Number(e.target.value))}
                  className="input w-24 tabular-nums"
                />
                <span className="text-text-muted">filas hoy</span>
                <button
                  onClick={() => batchMut.mutate()}
                  disabled={batchMut.isPending}
                  className="btn-primary flex items-center gap-1 ml-auto"
                >
                  {batchMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                  Inyectar
                </button>
              </div>
              {batchMut.data && (
                <div className="text-[10px] text-brand mt-1">
                  ✓ {batchMut.data.inserted} filas en {batchMut.data.elapsed_sec}s ({batchMut.data.date})
                </div>
              )}
              {batchMut.isError && <div className="text-[10px] text-accent-red mt-1">{String(batchMut.error)}</div>}
            </div>

            <div className="p-2 bg-bg-700/30 rounded border border-line">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
                <Rewind size={10} /> Simular N días hacia atrás
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="number" min={1} max={30}
                  value={simDays}
                  onChange={e => setSimDays(Number(e.target.value))}
                  className="input w-16 tabular-nums"
                  title="días"
                />
                <span className="text-text-muted">días ×</span>
                <input
                  type="number" min={100} max={5000} step={100}
                  value={simRows}
                  onChange={e => setSimRows(Number(e.target.value))}
                  className="input w-24 tabular-nums"
                  title="filas por día"
                />
                <span className="text-text-muted">filas</span>
                <button
                  onClick={() => simMut.mutate()}
                  disabled={simMut.isPending}
                  className="btn-primary flex items-center gap-1 ml-auto"
                >
                  {simMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Rewind size={11} />}
                  Simular
                </button>
              </div>
              {simMut.data && (
                <div className="text-[10px] text-brand mt-1">
                  ✓ {simMut.data.total_inserted} filas en {Object.keys(simMut.data.per_day).length} días ({simMut.data.elapsed_sec}s)
                </div>
              )}
              {simMut.isError && <div className="text-[10px] text-accent-red mt-1">{String(simMut.error)}</div>}
              <div className="text-[10px] text-text-muted mt-1">
                Estimado: ~{((simDays * simRows) / 1000).toFixed(0)}k filas · {simDays * 1.5}s aprox
              </div>
            </div>
          </div>
        )}
      </section>

      <AlgorithmModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* Contadores por tipo */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {EVENT_ORDER.map(t => {
          const m = META[t];
          const Icon = m.icon;
          const count = counts[t] ?? 0;
          return (
            <div
              key={t}
              className={`${m.bg} border border-line rounded-md p-2 flex flex-col gap-0.5 transition-all ${count > 0 ? '' : 'opacity-50'}`}
            >
              <div className={`text-[10px] uppercase tracking-wider ${m.color} flex items-center gap-1`}>
                <Icon size={11} /> {m.label}
              </div>
              <div className={`text-xl font-semibold tabular-nums ${m.color}`}>{count}</div>
            </div>
          );
        })}
      </section>

      {/* Stream principal */}
      <section className="panel flex-1 flex flex-col min-h-0">
        <div className="panel-title flex items-center gap-2">
          <Activity size={13} className={isLive ? 'text-brand animate-pulse' : 'text-text-muted'} />
          Flujo de eventos — últimos {events.length}
          <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-text-muted flex items-center gap-1">
            <Wifi size={11} className={isLive ? 'text-brand' : 'text-text-muted'} />
            refresh 2s
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-800 text-text-muted uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="text-left px-3 py-2 w-24">Sim clock</th>
                <th className="text-left px-2 py-2 w-32">Tipo</th>
                <th className="text-left px-2 py-2">Detalle</th>
                <th className="text-left px-2 py-2 w-24">Vehículo</th>
                <th className="text-right px-2 py-2 w-20">Métrica</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-text-muted italic">
                    Aún no hay eventos. Esperando el scheduler…
                  </td>
                </tr>
              )}
              {events.map(e => (
                <EventRow key={e.event_id} e={e} flash={flashId === e.event_id} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="text-[9px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${accent ?? 'text-text-primary'}`}>{value}</div>
    </div>
  );
}

function EventRow({ e, flash }: { e: StreamEvent; flash: boolean }) {
  const m = META[e.type] ?? { icon: Radio, color: 'text-text-muted', bg: '', label: e.type };
  const Icon = m.icon;
  const sim = e.sim_ts.slice(11, 19);

  return (
    <tr className={`border-b border-line/40 ${flash ? 'bg-brand/10 animate-pulse' : 'hover:bg-bg-700/30'}`}>
      <td className="px-3 py-1.5 font-mono text-[10px] text-text-muted tabular-nums">{sim}</td>
      <td className="px-2 py-1.5">
        <span className={`inline-flex items-center gap-1 ${m.color} font-semibold text-[11px]`}>
          <Icon size={11} /> {m.label}
        </span>
      </td>
      <td className="px-2 py-1.5 truncate max-w-[380px]">
        <span className="font-medium">{e.title ?? '—'}</span>
        {e.reason && <span className="text-text-muted ml-2 text-[11px]">· {e.reason}</span>}
      </td>
      <td className="px-2 py-1.5 font-mono text-[11px] text-text-secondary">
        {e.vehicle_name ? (
          <span className="flex items-center gap-1">
            <Truck size={10} /> {e.vehicle_name}
          </span>
        ) : '—'}
      </td>
      <td className="px-2 py-1.5 text-right text-[11px] tabular-nums">
        {e.p_fallo != null && <span className="text-accent-violet">p={Math.round(e.p_fallo * 100)}%</span>}
        {e.slack_min != null && (
          <span className={e.slack_min < 0 ? 'text-accent-red ml-1' : 'text-brand ml-1'}>
            {e.slack_min.toFixed(0)}m
          </span>
        )}
        {e.delay_min != null && e.delay_min > 0 && <span className="text-accent-red ml-1">+{e.delay_min.toFixed(0)}m</span>}
        {e.extra_min != null && <span className="text-accent-yellow ml-1">+{e.extra_min.toFixed(0)}m</span>}
      </td>
    </tr>
  );
}
