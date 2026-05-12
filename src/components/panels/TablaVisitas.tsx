import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, ArrowDownUp, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../../api';
import { REGIONES_CL } from '../../lib/regiones';
import { formatMotivoLabel } from '../../lib/formatMotivoLabel';

type SortKey = 'folio' | 'ruta' | 'region' | 'empresa' | 'driver' | 'estado' | 'eta' | 'hora_real';
type SortDir = 'asc' | 'desc';

const STATUS_PILL: Record<string, string> = {
  completed: 'bg-brand/15 text-brand',
  failed: 'bg-accent-red/15 text-accent-red',
  pending: 'bg-bg-700 text-text-muted',
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function TablaVisitas() {
  const [fecha, setFecha] = useState(todayISO());
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [region, setRegion] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('ruta');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const empresasQ = useQuery({
    queryKey: ['empresa-contactos-empresas-list'],
    queryFn: api.empresaContactos.listEmpresas,
  });

  const foliosQ = useQuery({
    queryKey: ['tabla-visitas', fecha, empresaId],
    queryFn: () => api.operacion.folios({ fecha, empresa_id: empresaId || null, limit: 2000 }),
    enabled: !!fecha,
    refetchInterval: 30_000,
  });

  const rows = foliosQ.data ?? [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(r => {
      if (region && r.region !== region) return false;
      if (estado && r.status !== estado) return false;
      if (needle) {
        const hay = [
          r.folio, r.cliente, r.ruta_id, r.driver_name, r.comuna, r.empresa_nombre,
          ...(r.subfolios ?? []),
        ].filter(Boolean).map(s => String(s).toLowerCase());
        if (!hay.some(s => s.includes(needle))) return false;
      }
      return true;
    });
  }, [rows, region, estado, q]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    const key = sortKey;
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const va: any =
        key === 'folio'    ? (a.folio ?? '') :
        key === 'ruta'     ? (a.ruta_id ?? '') :
        key === 'region'   ? (a.region ?? '') :
        key === 'empresa'  ? (a.empresa_nombre ?? '') :
        key === 'driver'   ? (a.driver_name ?? '') :
        key === 'estado'   ? (a.status ?? '') :
        key === 'eta'      ? (a.eta ?? '') :
        key === 'hora_real'? (a.hora_real ?? '') : '';
      const vb: any =
        key === 'folio'    ? (b.folio ?? '') :
        key === 'ruta'     ? (b.ruta_id ?? '') :
        key === 'region'   ? (b.region ?? '') :
        key === 'empresa'  ? (b.empresa_nombre ?? '') :
        key === 'driver'   ? (b.driver_name ?? '') :
        key === 'estado'   ? (b.status ?? '') :
        key === 'eta'      ? (b.eta ?? '') :
        key === 'hora_real'? (b.hora_real ?? '') : '';
      if (va === vb) return 0;
      return va < vb ? -1 * dir : 1 * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowDownUp size={9} className="opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={9} className="text-brand" /> : <ArrowDown size={9} className="text-brand" />;
  }

  const totals = useMemo(() => {
    const okN = filtered.filter(r => r.status === 'completed').length;
    const failN = filtered.filter(r => r.status === 'failed').length;
    const vipN = filtered.filter(r => r.is_vip).length;
    return { total: filtered.length, okN, failN, vipN };
  }, [filtered]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="input !py-1 text-[11px]"
        />
        <select
          value={empresaId}
          onChange={e => setEmpresaId(e.target.value === '' ? '' : Number(e.target.value))}
          className="input !py-1 text-[11px]"
        >
          <option value="">Todas las empresas</option>
          {empresasQ.data?.map(em => (
            <option key={em.empresa_id} value={em.empresa_id}>{em.nombre}</option>
          ))}
        </select>
        <select
          value={region}
          onChange={e => setRegion(e.target.value)}
          className="input !py-1 text-[11px]"
        >
          <option value="">Todas las regiones</option>
          {REGIONES_CL.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          className="input !py-1 text-[11px]"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="completed">Entregada</option>
          <option value="failed">No entregada</option>
        </select>
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Folio, subfolio, cliente, ruta…"
            className="input pl-7 !py-1 text-[11px] w-[260px]"
          />
        </div>
        <div className="ml-auto text-text-muted">
          <span className="tabular-nums text-text-secondary">{totals.total}</span> visitas ·{' '}
          <span className="text-brand">{totals.okN} OK</span> ·{' '}
          <span className="text-accent-red">{totals.failN} fail</span> ·{' '}
          <span className="text-cmr">{totals.vipN} VIP</span>
        </div>
      </div>

      <div className="panel overflow-auto max-h-[calc(100vh-260px)]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-bg-800 z-10 border-b border-line">
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-muted">
              <Th k="folio"     onSort={toggleSort} icon={<SortIcon k="folio"/>}>Folio</Th>
              <th className="px-3 py-1.5">Subfolio</th>
              <Th k="ruta"      onSort={toggleSort} icon={<SortIcon k="ruta"/>}>Ruta</Th>
              <Th k="region"    onSort={toggleSort} icon={<SortIcon k="region"/>}>Región</Th>
              <Th k="empresa"   onSort={toggleSort} icon={<SortIcon k="empresa"/>}>Empresa</Th>
              <Th k="driver"    onSort={toggleSort} icon={<SortIcon k="driver"/>}>Driver</Th>
              <Th k="estado"    onSort={toggleSort} icon={<SortIcon k="estado"/>}>Estado</Th>
              <th className="px-3 py-1.5">Motivo</th>
              <Th k="eta"       onSort={toggleSort} icon={<SortIcon k="eta"/>}>ETA</Th>
              <Th k="hora_real" onSort={toggleSort} icon={<SortIcon k="hora_real"/>}>Hora real</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-text-muted">
                {foliosQ.isLoading ? 'Cargando visitas…' : 'Sin visitas para los filtros actuales.'}
              </td></tr>
            )}
            {sorted.map(r => (
              <tr key={r.tracking_id} className="border-b border-line/30 hover:bg-bg-700/30">
                <td className="px-3 py-1 font-mono">{r.folio ? `#${r.folio}` : <span className="text-text-muted">—</span>}</td>
                <td className="px-3 py-1 text-text-secondary">
                  {r.subfolios.length === 0 ? <span className="text-text-muted">—</span>
                   : r.subfolios.length <= 3 ? r.subfolios.map(s => `#${s}`).join(' ')
                   : <span title={r.subfolios.join(', ')}>{r.subfolios.length} subfolios</span>}
                </td>
                <td className="px-3 py-1 font-mono text-brand">{r.ruta_id ?? '—'}</td>
                <td className="px-3 py-1">{r.region ?? '—'}</td>
                <td className="px-3 py-1 truncate max-w-[160px]">{r.empresa_nombre ?? '—'}</td>
                <td className="px-3 py-1 truncate max-w-[160px]">{r.driver_name ?? '—'}</td>
                <td className="px-3 py-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${STATUS_PILL[r.status] ?? STATUS_PILL.pending}`}>
                    {r.status}
                  </span>
                  {r.is_vip && (
                    <span className="ml-1 text-cmr inline-flex items-center gap-0.5">
                      <Star size={9} />{r.vip_tier ?? 'VIP'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1 text-text-secondary truncate max-w-[180px]" title={r.motivo ?? undefined}>
                  {r.motivo ? formatMotivoLabel(r.motivo) : <span className="text-text-muted">—</span>}
                </td>
                <td className="px-3 py-1 tabular-nums text-text-muted">{r.eta?.slice(11, 16) ?? '—'}</td>
                <td className="px-3 py-1 tabular-nums text-text-muted">{r.hora_real?.slice(11, 16) ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ k, onSort, icon, children }: { k: SortKey; onSort: (k: SortKey) => void; icon: any; children: React.ReactNode }) {
  return (
    <th className="px-3 py-1.5">
      <button onClick={() => onSort(k)} className="flex items-center gap-1 hover:text-text-secondary">
        {children}
        {icon}
      </button>
    </th>
  );
}
