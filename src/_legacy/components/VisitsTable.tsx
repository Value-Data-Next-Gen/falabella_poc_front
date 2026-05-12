import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { api } from '../api';
import { Visit } from '../types';

type SortKey = 'vehicle_id' | 'order' | 'window_end' | 'estimated_time_arrival' | 'slack_min' | 'p_fallo';
type SortDir = 'asc' | 'desc';

export function VisitsTable({ selectedVehicles }: { selectedVehicles: number[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['visits-table', selectedVehicles],
    queryFn: () => api.visits({ vehicle_ids: selectedVehicles }),
    refetchInterval: 5000,
  });

  const [sortKey, setSortKey] = useState<SortKey>('p_fallo');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState('');

  const visits = data ?? [];

  const sorted = useMemo(() => {
    const filtered = filter
      ? visits.filter(v => v.title.toLowerCase().includes(filter.toLowerCase()))
      : visits;
    const sortedArr = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sortedArr;
  }, [visits, sortKey, sortDir, filter]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  if (isLoading) return <div className="p-4 text-text-muted text-xs">Cargando...</div>;

  return (
    <div>
      <div className="px-3 py-2 border-b border-line flex items-center gap-3 text-xs">
        <input
          className="input flex-1"
          placeholder="Buscar cliente..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <span className="text-text-muted">{sorted.length} visitas</span>
      </div>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-800 border-b border-line">
          <tr className="text-text-muted uppercase tracking-wider text-[10px]">
            <Th k="vehicle_id" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Vehículo</Th>
            <Th k="order" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>#</Th>
            <th className="px-3 py-2 text-left">Cliente</th>
            <Th k="window_end" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Window</Th>
            <Th k="estimated_time_arrival" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>ETA</Th>
            <Th k="slack_min" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>Slack</Th>
            <th className="px-3 py-2 text-left">Simpli</th>
            <Th k="p_fallo" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort}>P(fallo)</Th>
            <th className="px-3 py-2 text-left">VD</th>
            <th className="px-3 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(v => (
            <Row key={v.tracking_id} v={v} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  k, sortKey, sortDir, onClick, children,
}: {
  k: SortKey; sortKey: SortKey; sortDir: SortDir;
  onClick: (k: SortKey) => void; children: React.ReactNode;
}) {
  const active = sortKey === k;
  return (
    <th
      className="px-3 py-2 text-left cursor-pointer hover:text-text-primary"
      onClick={() => onClick(k)}
    >
      <span className={`flex items-center gap-1 ${active ? 'text-accent-blue' : ''}`}>
        {children}
        {active && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </span>
    </th>
  );
}

function Row({ v }: { v: Visit }) {
  return (
    <tr className="border-b border-line/50 hover:bg-bg-700/40">
      <td className="px-3 py-1.5 text-text-secondary">FAL-{1000 + v.vehicle_id - 1}</td>
      <td className="px-3 py-1.5 tabular-nums text-text-muted">{v.order}</td>
      <td className="px-3 py-1.5 truncate max-w-[260px]" title={v.title}>{v.title}</td>
      <td className="px-3 py-1.5 tabular-nums">{v.window_end.slice(0, 5)}</td>
      <td className="px-3 py-1.5 tabular-nums">{v.estimated_time_arrival.slice(0, 5)}</td>
      <td className={`px-3 py-1.5 tabular-nums ${v.slack_min < 0 ? 'text-accent-red' : v.slack_min < 20 ? 'text-accent-yellow' : 'text-text-secondary'}`}>
        {v.slack_min.toFixed(0)}
      </td>
      <td className="px-3 py-1.5">
        <span className={`pill ${
          v.alert_slack === 'RED' ? 'pill-red' : v.alert_slack === 'YELLOW' ? 'pill-yellow' : 'pill-green'
        }`}>
          {v.alert_slack}
        </span>
      </td>
      <td className={`px-3 py-1.5 tabular-nums font-semibold ${
        v.p_fallo >= 0.5 ? 'text-accent-red' : v.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'
      }`}>
        {(v.p_fallo * 100).toFixed(0)}%
      </td>
      <td className="px-3 py-1.5">
        {v.alert_valuedata && <span className="pill pill-violet">⚡ VD</span>}
      </td>
      <td className="px-3 py-1.5">
        <span className={v.status === 'completed' ? 'text-accent-green' : 'text-text-muted'}>
          {v.status === 'completed' ? '✓' : '○'} {v.status}
        </span>
      </td>
    </tr>
  );
}
