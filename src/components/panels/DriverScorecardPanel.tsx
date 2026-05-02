import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Inbox, Loader2, Star, Truck, X } from 'lucide-react';
import { api } from '../../api';
import { DriverScorecardRow } from '../../types';

type SortKey =
  | 'driver_name' | 'fail_rate_30d' | 'deliveries_30d'
  | 'comments_total' | 'corrections_pending' | 'corrections_acceptance_rate'
  | 'rating' | 'alerts_critical_30d';

const PERIODS = [
  { value: 1,  label: 'Hoy' },
  { value: 7,  label: '7 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

export function DriverScorecardPanel() {
  const [period, setPeriod] = useState<number>(30);
  const [empresaId, setEmpresaId] = useState<number | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('fail_rate_30d');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [drawerDriver, setDrawerDriver] = useState<DriverScorecardRow | null>(null);

  const empresasQ = useQuery({
    queryKey: ['scorecard-empresas'],
    queryFn: api.empresaContactos.listEmpresas,
  });

  const scoreQ = useQuery({
    queryKey: ['scorecard', period, empresaId],
    queryFn: () => api.driversExt.scorecard({
      period_days: period,
      empresa_id: empresaId === 'all' ? undefined : empresaId,
    }),
    refetchInterval: 60_000,
  });

  const rows = useMemo(() => {
    const arr = [...(scoreQ.data ?? [])];
    arr.sort((a, b) => {
      const av: any = (a as any)[sortKey] ?? 0;
      const bv: any = (b as any)[sortKey] ?? 0;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av - bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [scoreQ.data, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Driver scorecard</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            Indicadores agregados por driver: entregas, fallas, correcciones IA, alertas, rating.
          </p>
        </div>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <div className="flex items-center border border-line/60 rounded-md overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2 py-1 text-[10px] uppercase tracking-wider ${
                period === p.value ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-700/50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <select
          value={empresaId}
          onChange={e => setEmpresaId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="input text-[11px] py-1"
        >
          <option value="all">Todas las empresas</option>
          {empresasQ.data?.map(e => (
            <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>
          ))}
        </select>

        <span className="ml-auto text-text-muted">
          {scoreQ.isLoading ? <Loader2 size={11} className="animate-spin inline" /> : `${rows.length} drivers`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="panel p-12 text-center">
          <Inbox size={36} className="mx-auto mb-2 text-text-muted/40" />
          <div className="text-[13px] text-text-secondary">Sin datos de drivers para los filtros aplicados.</div>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-280px)]">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50/5 border-b border-line/40 sticky top-0">
                <tr className="text-text-muted uppercase tracking-wider text-[10px] text-left">
                  <Th sortKey="driver_name" cur={sortKey} dir={sortDir} onClick={toggleSort}>Driver</Th>
                  <th className="px-3 py-2">Vehículo</th>
                  <th className="px-3 py-2">Empresa</th>
                  <Th sortKey="deliveries_30d" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">Entregas</Th>
                  <Th sortKey="fail_rate_30d" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">Fail rate</Th>
                  <Th sortKey="comments_total" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">Comments</Th>
                  <Th sortKey="corrections_pending" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">Pendientes</Th>
                  <Th sortKey="corrections_acceptance_rate" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">% acept.</Th>
                  <Th sortKey="rating" cur={sortKey} dir={sortDir} onClick={toggleSort} align="right">Rating</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/30">
                {rows.map(r => (
                  <tr
                    key={r.driver_id}
                    onClick={() => setDrawerDriver(r)}
                    className="hover:bg-bg-700/20 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.driver_name}</div>
                      <div className="text-[10px] text-text-muted font-mono">{r.driver_id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 text-text-secondary">
                        <Truck size={11} /> {r.vehicle_name ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{r.empresa_nombre ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.deliveries_30d}</td>
                    <td className="px-3 py-2 text-right">
                      <FailRateChip rate={r.fail_rate_30d} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.comments_total}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className={r.corrections_pending > 0 ? 'text-amber-400' : 'text-text-muted'}>
                        {r.corrections_pending}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(r.corrections_accepted + r.corrections_rejected) > 0
                        ? `${(r.corrections_acceptance_rate * 100).toFixed(0)}%`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Star size={11} className="text-amber-400" /> {r.rating.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {drawerDriver && (
        <DriverDetailDrawer row={drawerDriver} onClose={() => setDrawerDriver(null)} />
      )}
    </div>
  );
}

function Th({
  sortKey, cur, dir, onClick, children, align = 'left',
}: {
  sortKey: SortKey; cur: SortKey; dir: 'asc' | 'desc';
  onClick: (k: SortKey) => void; children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const isActive = cur === sortKey;
  return (
    <th className={`px-3 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-text-primary ${isActive ? 'text-text-primary' : ''}`}
      >
        {children}
        {isActive && (dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </button>
    </th>
  );
}

function FailRateChip({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(1);
  const cls = rate > 0.08 ? 'bg-red-500/15 text-red-400 ring-red-500/30'
            : rate > 0.05 ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
            : 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] tabular-nums ring-1 ${cls}`}>
      {pct}%
    </span>
  );
}

function DriverDetailDrawer({ row, onClose }: { row: DriverScorecardRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-[480px] h-full bg-bg-800 border-l border-line shadow-xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-line/60 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold">{row.driver_name}</h2>
            <div className="text-[11px] text-text-muted font-mono">{row.driver_id}</div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 text-[12px]">
          <Stat label="Vehículo"     value={row.vehicle_name ?? '—'} />
          <Stat label="Empresa"      value={row.empresa_nombre ?? '—'} />
          <Stat label="Entregas (período)" value={row.deliveries_30d.toString()} />
          <Stat label="Fail rate"    value={`${(row.fail_rate_30d * 100).toFixed(1)}%`} />
          <Stat label="Comentarios"  value={row.comments_total.toString()} />
          <Stat label="Rating"       value={row.rating.toFixed(2)} />
          <Stat label="Correcciones pendientes" value={row.corrections_pending.toString()} />
          <Stat label="Correcciones aceptadas"  value={row.corrections_accepted.toString()} />
          <Stat label="Correcciones rechazadas" value={row.corrections_rejected.toString()} />
          <Stat label="% aceptación" value={
            (row.corrections_accepted + row.corrections_rejected) > 0
              ? `${(row.corrections_acceptance_rate * 100).toFixed(0)}%`
              : '—'
          } />
          <Stat label="Alertas críticas" value={row.alerts_critical_30d.toString()} />
          <Stat label="Alertas medium" value={row.alerts_medium_30d.toString()} />
          <Stat label="Rank fail-rate" value={`#${row.rank_fail_rate}`} />
          <Stat label="Rank acept." value={`#${row.rank_acceptance}`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line/40 p-2.5 bg-bg-900/40">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-[13px] font-medium tabular-nums mt-0.5">{value}</div>
    </div>
  );
}
