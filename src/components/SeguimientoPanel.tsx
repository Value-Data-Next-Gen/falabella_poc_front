import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowDown, ArrowUp, Building2, Calendar, CheckCircle2,
  Clock, Database, MapPin, Truck, XCircle, Minus,
} from 'lucide-react';
import { api } from '../api';
import { FpocVisitRow, SeguimientoKPIs } from '../types';

const FLAG_LABELS: Record<string, string> = {
  ruta_eta_futuro: 'ETA a > 24h',
  ruta_fecha_inicio_mayor_eta: 'Inicio > ETA',
  ruta_primer_punto_lejano: '1er punto lejos del CD',
  ruta_fecha_inicio_distinta_fecha_eta: 'Fechas distintas',
};

type PeriodPreset = 'latest' | 'prev_day' | 'prev_week' | 'prev_month' | 'custom';

function dateOffset(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function computeDates(base: string, preset: PeriodPreset, custom: string) {
  let primary = base;
  let compareTo: string | null = null;
  let comparelabel = '';
  switch (preset) {
    case 'latest':
      primary = base;
      compareTo = dateOffset(base, 1);
      comparelabel = 'vs día anterior';
      break;
    case 'prev_day':
      primary = dateOffset(base, 1);
      compareTo = dateOffset(base, 2);
      comparelabel = 'vs 2 días atrás';
      break;
    case 'prev_week':
      primary = dateOffset(base, 7);
      compareTo = dateOffset(base, 14);
      comparelabel = 'vs semana previa';
      break;
    case 'prev_month':
      primary = dateOffset(base, 30);
      compareTo = dateOffset(base, 60);
      comparelabel = 'vs 60 días atrás';
      break;
    case 'custom':
      primary = custom;
      compareTo = dateOffset(custom, 7);
      comparelabel = 'vs 7 días antes';
      break;
  }
  return { primary, compareTo, comparelabel };
}

export function SeguimientoPanel() {
  const datesQ = useQuery({ queryKey: ['seg-dates'], queryFn: api.seg.availableDates });
  const baseDate = datesQ.data?.max_date ?? '';

  const [preset, setPreset] = useState<PeriodPreset>('latest');
  const [custom, setCustom] = useState<string>('');

  const { primary, compareTo, comparelabel } = useMemo(
    () => computeDates(baseDate, preset, custom || baseDate),
    [baseDate, preset, custom],
  );

  const enabled = !!baseDate;

  const kpisQ = useQuery({
    queryKey: ['seg-kpis', primary], enabled,
    queryFn: () => api.seg.kpis(primary),
  });
  const kpisPrevQ = useQuery({
    queryKey: ['seg-kpis-prev', compareTo], enabled: enabled && !!compareTo,
    queryFn: () => api.seg.kpis(compareTo!),
  });
  const slaQ = useQuery({ queryKey: ['seg-sla', primary], queryFn: () => api.seg.slaDistribution(primary), enabled });
  const motivosQ = useQuery({ queryKey: ['seg-motivos'], queryFn: () => api.seg.motivos(10) });
  const empresasQ = useQuery({ queryKey: ['seg-empresas', primary], queryFn: () => api.seg.byEmpresa(primary), enabled });
  const localQ = useQuery({ queryKey: ['seg-localidades'], queryFn: () => api.seg.byLocalidad(10) });
  const flagsQ = useQuery({ queryKey: ['seg-flags', primary], queryFn: () => api.seg.rutasAnomalas(primary), enabled });

  // Tabla paginada
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'' | 'completed' | 'failed'>('');
  const [anomFilter, setAnomFilter] = useState<'' | 'true' | 'false'>('');
  const [search, setSearch] = useState('');
  const limit = 25;

  const visitsQ = useQuery({
    queryKey: ['seg-visits', primary, page, statusFilter, anomFilter, search],
    enabled,
    queryFn: () => api.seg.visits({
      limit, offset: page * limit,
      planned_date: primary,
      status: statusFilter || undefined,
      ruta_anomala: anomFilter === '' ? undefined : anomFilter === 'true',
      search: search || undefined,
    }),
  });

  const kpis = kpisQ.data;
  const kpisPrev = kpisPrevQ.data;
  const totalPages = useMemo(() => {
    const total = visitsQ.data?.total ?? 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [visitsQ.data]);

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-3">
      {/* Selector de período */}
      <section className="panel">
        <div className="p-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-muted uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Calendar size={11} /> Período
          </span>
          <PresetButton active={preset === 'latest'}     onClick={() => setPreset('latest')}>Última fecha</PresetButton>
          <PresetButton active={preset === 'prev_day'}   onClick={() => setPreset('prev_day')}>Día anterior</PresetButton>
          <PresetButton active={preset === 'prev_week'}  onClick={() => setPreset('prev_week')}>Misma sem. anterior</PresetButton>
          <PresetButton active={preset === 'prev_month'} onClick={() => setPreset('prev_month')}>Mes atrás</PresetButton>
          <PresetButton active={preset === 'custom'}     onClick={() => setPreset('custom')}>Custom</PresetButton>
          {preset === 'custom' && (
            <input
              type="date"
              value={custom}
              min={datesQ.data?.min_date ?? undefined}
              max={datesQ.data?.max_date ?? undefined}
              onChange={e => setCustom(e.target.value)}
              className="input"
            />
          )}
          <span className="ml-auto text-text-muted flex items-center gap-3">
            <span>Fecha activa: <span className="text-brand font-mono">{primary || '—'}</span></span>
            {compareTo && (
              <span>Comparando contra: <span className="text-text-primary font-mono">{compareTo}</span> <span className="text-text-muted">({comparelabel})</span></span>
            )}
          </span>
        </div>
      </section>

      {/* KPIs con delta vs período anterior */}
      <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
        <KPICard label="Visitas" icon={Database} curr={kpis?.total} prev={kpisPrev?.total} />
        <KPICard label="Completadas %" icon={CheckCircle2} curr={kpis?.completion_pct} prev={kpisPrev?.completion_pct} unit="%" accent="text-brand" />
        <KPICard label="Failed" icon={XCircle} curr={kpis?.failed} prev={kpisPrev?.failed} accent="text-accent-red" inverted />
        <KPICard label="Ruta anómala %" icon={AlertTriangle} curr={kpis?.ruta_anomala_pct} prev={kpisPrev?.ruta_anomala_pct} unit="%" accent="text-accent-yellow" inverted />
        <KPICard label="SLA prom (h)" icon={Clock} curr={kpis?.sla_hour_avg} prev={kpisPrev?.sla_hour_avg} precision={2} />
        <KPICard label="On-time (±1h)" icon={CheckCircle2} curr={kpis?.on_time} prev={kpisPrev?.on_time} accent="text-brand" />
        <KPICard label="Tarde > 1h" icon={Clock} curr={kpis?.late} prev={kpisPrev?.late} accent="text-accent-red" inverted />
      </section>

      {/* Fila 1: SLA histogram + motivos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="panel-title">Distribución SLA (horas checkout − ETA) · {primary}</div>
          <div className="h-56 p-2">
            <ResponsiveContainer>
              <BarChart data={slaQ.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="bin_start" fontSize={10} tick={{ fill: 'rgb(var(--text-muted))' }} />
                <YAxis fontSize={10} tick={{ fill: 'rgb(var(--text-muted))' }} />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--bg-800))', border: '1px solid rgb(var(--line))', fontSize: 11 }}
                  labelFormatter={(v) => `bin ${v}h`}
                />
                <Bar dataKey="count" fill="rgb(var(--brand))">
                  {(slaQ.data ?? []).map((d, i) => (
                    <Cell key={i} fill={
                      Math.abs(d.bin_start) <= 1 ? 'rgb(var(--brand))'
                      : Math.abs(d.bin_start) <= 3 ? '#e69600'
                      : '#cc2222'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Top motivos de no entrega (todas las fechas)</div>
          <div className="p-2 text-xs">
            {motivosQ.data?.length ? (
              <ul className="flex flex-col gap-1">
                {motivosQ.data.map(m => {
                  const max = Math.max(...motivosQ.data!.map(x => x.count));
                  const pct = (m.count / max) * 100;
                  return (
                    <li key={m.motivo} className="flex items-center gap-2">
                      <span className="flex-1 truncate" title={m.motivo}>{m.motivo}</span>
                      <span className="w-24 h-2 bg-bg-700 rounded overflow-hidden">
                        <span className="block h-full bg-accent-red" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="text-text-muted tabular-nums w-8 text-right">{m.count}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-text-muted italic p-4">Sin datos</div>
            )}
          </div>
        </div>
      </section>

      {/* Fila 2: by-empresa + rutas-anomalas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="panel">
          <div className="panel-title flex items-center gap-1"><Building2 size={12} /> Performance por empresa · {primary}</div>
          <div className="p-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-text-muted uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="text-left px-2 py-1">Empresa</th>
                  <th className="text-right px-2 py-1">Total</th>
                  <th className="text-right px-2 py-1">OK</th>
                  <th className="text-right px-2 py-1">Fail</th>
                  <th className="text-right px-2 py-1">Anom</th>
                  <th className="text-right px-2 py-1">SLA prom.</th>
                  <th className="text-right px-2 py-1">On-time</th>
                </tr>
              </thead>
              <tbody>
                {empresasQ.data?.map(e => (
                  <tr key={e.empresa_id} className="border-t border-line/50">
                    <td className="px-2 py-1">{e.nombre}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{e.total}</td>
                    <td className="px-2 py-1 text-right text-brand tabular-nums">{e.completed}</td>
                    <td className="px-2 py-1 text-right text-accent-red tabular-nums">{e.failed}</td>
                    <td className="px-2 py-1 text-right text-accent-yellow tabular-nums">{e.ruta_anomala}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{e.sla_hour_avg.toFixed(2)}h</td>
                    <td className="px-2 py-1 text-right tabular-nums">{e.on_time_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title flex items-center gap-1"><AlertTriangle size={12} /> Flags de ruta anómala · {primary}</div>
          <div className="p-2 text-xs flex flex-col gap-2">
            {flagsQ.data?.map(f => (
              <div key={f.flag} className="flex items-center gap-2">
                <span className="flex-1">{FLAG_LABELS[f.flag] ?? f.flag}</span>
                <span className="w-32 h-2 bg-bg-700 rounded overflow-hidden">
                  <span
                    className="block h-full bg-accent-yellow"
                    style={{ width: `${Math.min(100, f.pct * 4)}%` }}
                    title={`${f.pct}%`}
                  />
                </span>
                <span className="text-text-muted tabular-nums w-14 text-right">
                  {f.count} · {f.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fila 3: localidades top (cross-date) */}
      <section className="panel">
        <div className="panel-title flex items-center gap-1"><MapPin size={12} /> Top comunas (geo_suborders — acumulado)</div>
        <div className="h-48 p-2">
          <ResponsiveContainer>
            <BarChart data={localQ.data ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" horizontal={false} />
              <XAxis type="number" fontSize={10} tick={{ fill: 'rgb(var(--text-muted))' }} />
              <YAxis type="category" dataKey="localidad" fontSize={10} width={110} tick={{ fill: 'rgb(var(--text-muted))' }} />
              <Tooltip contentStyle={{ background: 'rgb(var(--bg-800))', border: '1px solid rgb(var(--line))', fontSize: 11 }} />
              <Bar dataKey="total" fill="rgb(var(--brand))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabla visitas */}
      <section className="panel flex-shrink-0">
        <div className="panel-title flex items-center gap-1">
          <Truck size={12} /> Visitas · {primary}
        </div>
        <div className="p-2 flex flex-wrap gap-2 border-b border-line">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar (título, dirección, driver)"
            className="input flex-1 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as any); setPage(0); }}
            className="input"
          >
            <option value="">Status: todos</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <select
            value={anomFilter}
            onChange={e => { setAnomFilter(e.target.value as any); setPage(0); }}
            className="input"
          >
            <option value="">Anomalía: todas</option>
            <option value="true">Solo ruta anómala</option>
            <option value="false">Sin anomalía</option>
          </select>
          <div className="flex items-center gap-1 ml-auto text-xs">
            <button className="btn" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>← Prev</button>
            <span className="text-text-muted px-2">
              {page + 1} / {totalPages} ({visitsQ.data?.total ?? 0})
            </span>
            <button className="btn" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-800 text-text-muted uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="text-left px-2 py-1">ID</th>
                <th className="text-left px-2 py-1">Cliente</th>
                <th className="text-left px-2 py-1">Dirección</th>
                <th className="text-left px-2 py-1">Driver</th>
                <th className="text-left px-2 py-1">CD</th>
                <th className="text-right px-2 py-1">#</th>
                <th className="text-right px-2 py-1">SLA h</th>
                <th className="text-center px-2 py-1">Anom</th>
                <th className="text-center px-2 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {(visitsQ.data?.rows ?? []).map(v => <VisitRow key={v.id} v={v} />)}
              {!visitsQ.data?.rows.length && (
                <tr><td colSpan={9} className="text-center text-text-muted italic p-6">Sin resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PresetButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${
        active ? 'bg-brand/20 border-brand text-brand' : 'border-line text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function KPICard({ label, icon: Icon, curr, prev, unit = '', precision = 0, accent, inverted = false }: {
  label: string; icon: any; curr: number | undefined; prev: number | undefined;
  unit?: string; precision?: number; accent?: string; inverted?: boolean;
}) {
  const valueStr = curr == null ? '—' : (precision ? curr.toFixed(precision) : Math.round(curr).toString()) + unit;
  let deltaEl = null;
  if (curr != null && prev != null && prev !== 0) {
    const delta = curr - prev;
    const pct = (delta / Math.abs(prev)) * 100;
    const isUp = delta > 0;
    const isFlat = Math.abs(pct) < 0.5;
    // inverted: subir es malo (ej: failed)
    const good = inverted ? !isUp : isUp;
    const cls = isFlat ? 'text-text-muted' : good ? 'text-brand' : 'text-accent-red';
    const Arrow = isFlat ? Minus : isUp ? ArrowUp : ArrowDown;
    deltaEl = (
      <span className={`flex items-center gap-0.5 text-[10px] ${cls} tabular-nums`}>
        <Arrow size={10} /> {Math.abs(pct).toFixed(1)}%
      </span>
    );
  }
  return (
    <div className="kpi-card min-w-[150px]">
      <div className="kpi-label flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`kpi-value tabular-nums ${accent ?? ''}`}>{valueStr}</span>
        {deltaEl}
      </div>
      {prev != null && (
        <div className="kpi-sub tabular-nums">prev: {precision ? prev.toFixed(precision) : Math.round(prev)}{unit}</div>
      )}
    </div>
  );
}

function VisitRow({ v }: { v: FpocVisitRow }) {
  const slaClass =
    Math.abs(v.sla_hour_checkout_eta) <= 1 ? 'text-brand'
    : Math.abs(v.sla_hour_checkout_eta) <= 3 ? 'text-accent-yellow'
    : 'text-accent-red';
  return (
    <tr className="border-t border-line/50 hover:bg-bg-700/40">
      <td className="px-2 py-1 font-mono text-[10px] text-text-muted">{v.id}</td>
      <td className="px-2 py-1">{v.title}</td>
      <td className="px-2 py-1 truncate max-w-[240px]" title={v.address}>{v.address}</td>
      <td className="px-2 py-1 truncate max-w-[140px]" title={v.drivername}>{v.drivername}</td>
      <td className="px-2 py-1 text-[10px] text-text-muted">{v.ct}</td>
      <td className="px-2 py-1 text-right tabular-nums">{v.order}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${slaClass}`}>{v.sla_hour_checkout_eta.toFixed(2)}</td>
      <td className="px-2 py-1 text-center">
        {v.ruta_anomala && <span className="pill pill-yellow">Sí</span>}
      </td>
      <td className="px-2 py-1 text-center">
        <span className={`pill ${v.status === 'failed' ? 'pill-red' : 'pill-green'}`}>{v.status}</span>
      </td>
    </tr>
  );
}
