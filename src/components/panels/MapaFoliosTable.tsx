import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Star, Truck, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { api } from '../../api';

interface Props {
  fecha: string;
  empresaId: number | null;       // null = todas las empresas
  empresaNombre?: string | null;
  onlyVip?: boolean;
  onOpenRuta?: (rutaId: string) => void;
}

const STATUS_PILL: Record<string, string> = {
  completed: 'bg-brand/15 text-brand',
  failed: 'bg-accent-red/15 text-accent-red',
  pending: 'bg-bg-700 text-text-muted',
};

export function MapaFoliosTable({ fecha, empresaId, empresaNombre, onlyVip = false, onOpenRuta }: Props) {
  const [q, setQ] = useState('');
  const [expandedRutas, setExpandedRutas] = useState<Set<string>>(new Set());

  // CR-012 Fix V2: queryKey CANÓNICO ['driver-positions', fecha, empresaId]
  // compartido con OperationsMap y DriversAvancePanel → 1 fetch dedupado.
  const driversQ = useQuery({
    queryKey: ['driver-positions', fecha, empresaId],
    queryFn: () => api.operacion.driverPositions(fecha, empresaId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!fecha,
  });

  const foliosQ = useQuery({
    queryKey: ['folios-tabla', fecha, empresaId, onlyVip],
    queryFn: () => api.operacion.folios({ fecha, empresa_id: empresaId, only_vip: onlyVip, limit: 2000 }),
    refetchInterval: 30_000,
    enabled: !!fecha,
  });

  // Fase 3: el shape nuevo de driver-positions no expone `vip_visitas` ni
  // `stops_failed`. Mantenemos los counters que sí siguen vivos: total drivers,
  // en_ruta / finalizados, y completed/total derivado de completed_count +
  // pending_count. "conVip" y "fail" se omiten (no hay equivalente directo en
  // el nuevo endpoint; se levantan desde folios o alertas en otro CR).
  const driverSummary = useMemo(() => {
    const drivers = driversQ.data ?? [];
    const total = drivers.length;
    const enRuta = drivers.filter(d => d.status === 'en_ruta').length;
    const finalizados = drivers.filter(d => d.status === 'finalizado').length;
    const okTotal = drivers.reduce((s, d) => s + d.completed_count, 0);
    const stopsTotal = drivers.reduce((s, d) => s + d.completed_count + d.pending_count, 0);
    return { total, enRuta, finalizados, okTotal, stopsTotal };
  }, [driversQ.data]);

  const rows = foliosQ.data ?? [];
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter(r =>
      r.cliente.toLowerCase().includes(needle) ||
      (r.folio ?? '').toLowerCase().includes(needle) ||
      r.subfolios.some(s => s.toLowerCase().includes(needle)) ||
      (r.ruta_id ?? '').toLowerCase().includes(needle) ||
      (r.driver_name ?? '').toLowerCase().includes(needle) ||
      (r.comuna ?? '').toLowerCase().includes(needle)
    );
  }, [rows, q]);

  // Agrupado por ruta_id para mostrar header de ruta
  const byRuta = useMemo(() => {
    const out: Record<string, typeof filtered> = {};
    filtered.forEach(r => {
      const k = r.ruta_id ?? '(sin ruta)';
      (out[k] ??= []).push(r);
    });
    return out;
  }, [filtered]);

  const rutaKeys = Object.keys(byRuta).sort();
  const totalFolios = new Set(rows.map(r => r.folio).filter(Boolean)).size;
  const totalSubfolios = rows.reduce((s, r) => s + r.subfolios.length, 0);
  const totalVip = rows.filter(r => r.is_vip).length;

  function toggleRuta(k: string) {
    setExpandedRutas(s => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  if (!empresaId) {
    return (
      <div className="panel p-4 text-center text-text-muted text-[12px]">
        Selecciona una empresa transportista en el filtro superior para ver folios y subfolios.
      </div>
    );
  }

  return (
    <div className="panel flex flex-col">
      <div className="panel-title flex items-center gap-2 flex-wrap">
        <Truck size={13} className="text-brand" />
        <span>Folios y subfolios — {empresaNombre ?? `Empresa ${empresaId}`}</span>
        <span className="text-text-muted normal-case tracking-normal text-[10px]">
          {fecha}
        </span>
        <span className="ml-auto flex items-center gap-3 text-[10px] normal-case tracking-normal">
          <span><Truck size={10} className="inline mr-1" />{driverSummary.total} drivers</span>
          <span className="text-brand">{driverSummary.okTotal}/{driverSummary.stopsTotal} entregas</span>
          <span className="text-text-muted">{driverSummary.finalizados} finalizados</span>
        </span>
      </div>

      <div className="px-3 py-2 border-b border-line flex flex-wrap items-center gap-2 text-[11px]">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Folio, subfolio, cliente, comuna…"
            className="input pl-7 !py-1 text-[11px] w-[260px]"
          />
        </div>
        <div className="ml-auto text-text-muted">
          <span className="tabular-nums text-text-secondary">{totalFolios}</span> folios ·{' '}
          <span className="tabular-nums text-text-secondary">{totalSubfolios}</span> subfolios ·{' '}
          <span className="tabular-nums text-cmr">{totalVip}</span> VIP
        </div>
      </div>

      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-bg-800 z-10 border-b border-line">
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-1.5">#</th>
              <th className="px-3 py-1.5">Folio</th>
              <th className="px-3 py-1.5">Subfolios</th>
              <th className="px-3 py-1.5">Cliente</th>
              <th className="px-3 py-1.5">Comuna</th>
              <th className="px-3 py-1.5">ETA</th>
              <th className="px-3 py-1.5">VIP</th>
              <th className="px-3 py-1.5">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rutaKeys.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-text-muted">
                {foliosQ.isLoading ? 'Cargando folios…' : 'Sin folios para los filtros actuales.'}
              </td></tr>
            )}
            {rutaKeys.map(rk => {
              const items = byRuta[rk];
              const expanded = expandedRutas.has(rk);
              const driver = items[0]?.driver_name ?? '—';
              const vipInRuta = items.filter(i => i.is_vip).length;
              return (
                <>
                  <tr
                    key={`hdr-${rk}`}
                    className="bg-bg-700/40 border-b border-line/60 cursor-pointer hover:bg-bg-700/70"
                    onClick={() => toggleRuta(rk)}
                  >
                    <td colSpan={8} className="px-3 py-1.5">
                      <div className="flex items-center gap-2">
                        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        <span className="font-mono text-brand">{rk}</span>
                        <span className="text-text-muted">·</span>
                        <span>{driver}</span>
                        <span className="text-text-muted">·</span>
                        <span className="tabular-nums">{items.length} stops</span>
                        {vipInRuta > 0 && (
                          <span className="ml-1 flex items-center gap-1 text-cmr">
                            <Star size={10} />{vipInRuta} VIP
                          </span>
                        )}
                        {rk !== '(sin ruta)' && onOpenRuta && (
                          <button
                            onClick={e => { e.stopPropagation(); onOpenRuta(rk); }}
                            className="ml-auto text-[10px] text-text-muted hover:text-brand"
                          >
                            ver detalle →
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded && items.map(r => (
                    <tr key={r.tracking_id} className="border-b border-line/30 hover:bg-bg-700/30">
                      <td className="px-3 py-1 tabular-nums text-text-muted">{r.order ?? '—'}</td>
                      <td className="px-3 py-1 font-mono text-text-primary">
                        {r.folio ? `#${r.folio}` : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-3 py-1 text-text-secondary">
                        {r.subfolios.length === 0 ? (
                          <span className="text-text-muted">0</span>
                        ) : (
                          <span title={r.subfolios.join(', ')}>
                            {r.subfolios.length <= 3
                              ? r.subfolios.map(s => `#${s}`).join(' ')
                              : `${r.subfolios.length} subfolios`}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1 truncate max-w-[260px]">{r.cliente}</td>
                      <td className="px-3 py-1 text-text-muted">{r.comuna ?? '—'}</td>
                      <td className="px-3 py-1 tabular-nums text-text-muted">{r.eta?.slice(11, 16) ?? '—'}</td>
                      <td className="px-3 py-1">
                        {r.is_vip ? (
                          <span className="text-cmr flex items-center gap-1">
                            <Star size={10} />{r.vip_tier ?? 'VIP'}
                          </span>
                        ) : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="px-3 py-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_PILL[r.status] ?? STATUS_PILL.pending}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
