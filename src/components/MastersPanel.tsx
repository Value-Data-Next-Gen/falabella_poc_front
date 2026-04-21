import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Star, Truck, User } from 'lucide-react';
import { api } from '../api';

type Sub = 'drivers' | 'vehicles' | 'clients';

export function MastersPanel() {
  const [sub, setSub] = useState<Sub>('drivers');

  const subs: { key: Sub; label: string; icon: any }[] = [
    { key: 'drivers', label: 'Conductores', icon: User },
    { key: 'vehicles', label: 'Vehículos', icon: Truck },
    { key: 'clients', label: 'Empresas / Clientes', icon: Building2 },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-line">
        {subs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors ${
              sub === key
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {sub === 'drivers' && <DriversTable />}
      {sub === 'vehicles' && <VehiclesTable />}
      {sub === 'clients' && <ClientsTable />}
    </div>
  );
}

function DriversTable() {
  const { data, isLoading } = useQuery({ queryKey: ['drivers'], queryFn: api.drivers });
  if (isLoading || !data) return <div className="text-text-muted">Cargando...</div>;

  return (
    <div className="panel">
      <div className="panel-title">{data.length} conductores activos</div>
      <table className="w-full text-xs">
        <thead className="border-b border-line">
          <tr className="text-text-muted uppercase tracking-wider text-[10px]">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Teléfono</th>
            <th className="px-3 py-2 text-left">Vehículo</th>
            <th className="px-3 py-2 text-right">Rating</th>
            <th className="px-3 py-2 text-right">Entregas 30d</th>
            <th className="px-3 py-2 text-right">% fallo 30d</th>
            <th className="px-3 py-2 text-left">Antigüedad</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.driver_id} className="border-b border-line/50 hover:bg-bg-700/30">
              <td className="px-3 py-2 text-text-muted">{d.driver_id}</td>
              <td className="px-3 py-2 font-semibold">{d.name}</td>
              <td className="px-3 py-2 text-text-secondary">{d.phone}</td>
              <td className="px-3 py-2">{d.vehicle_name}</td>
              <td className="px-3 py-2 text-right">
                <span className={`flex items-center justify-end gap-1 ${
                  d.rating >= 4.5 ? 'text-accent-green' : d.rating >= 4.0 ? 'text-accent-yellow' : 'text-accent-red'
                }`}>
                  <Star size={11} className="fill-current" />
                  {d.rating.toFixed(2)}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{d.deliveries_30d}</td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${
                d.fail_rate_30d > 0.18 ? 'text-accent-red' : d.fail_rate_30d > 0.12 ? 'text-accent-yellow' : 'text-accent-green'
              }`}>
                {(d.fail_rate_30d * 100).toFixed(1)}%
              </td>
              <td className="px-3 py-2 text-text-muted">{d.joined_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VehiclesTable() {
  const { data, isLoading } = useQuery({ queryKey: ['fleet-vehicles'], queryFn: api.fleetVehicles });
  if (isLoading || !data) return <div className="text-text-muted">Cargando...</div>;

  return (
    <div className="panel">
      <div className="panel-title">{data.length} vehículos</div>
      <table className="w-full text-xs">
        <thead className="border-b border-line">
          <tr className="text-text-muted uppercase tracking-wider text-[10px]">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Patente</th>
            <th className="px-3 py-2 text-right">Capacidad m³</th>
            <th className="px-3 py-2 text-left">Año</th>
            <th className="px-3 py-2 text-left">Conductor</th>
            <th className="px-3 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.map(v => (
            <tr key={v.vehicle_id} className="border-b border-line/50 hover:bg-bg-700/30">
              <td className="px-3 py-2 text-text-muted">#{v.vehicle_id}</td>
              <td className="px-3 py-2 font-semibold">{v.name}</td>
              <td className="px-3 py-2">{v.type}</td>
              <td className="px-3 py-2 font-mono text-accent-blue">{v.plate}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.capacity_m3}</td>
              <td className="px-3 py-2 text-text-secondary">{v.year}</td>
              <td className="px-3 py-2">
                <div className="text-xs">{v.driver_name}</div>
                <div className="text-[10px] text-text-muted">{v.driver_id}</div>
              </td>
              <td className="px-3 py-2">
                <span className={`pill ${v.active ? 'pill-green' : 'pill-red'}`}>
                  {v.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClientsTable() {
  const [search, setSearch] = useState('');
  const [onlyProblem, setOnlyProblem] = useState(false);
  const [minFail, setMinFail] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search, onlyProblem, minFail],
    queryFn: () => api.clients({
      limit: 200,
      search: search || undefined,
      only_problem_zone: onlyProblem,
      min_fail_rate: minFail || undefined,
    }),
  });

  return (
    <div className="panel">
      <div className="panel-title">
        <span>{data?.length ?? 0} empresas (orden por % fallo desc)</span>
      </div>
      <div className="px-3 py-2 border-b border-line flex items-center gap-3 flex-wrap">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Buscar empresa o ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={onlyProblem}
            onChange={e => setOnlyProblem(e.target.checked)}
            className="accent-accent-violet"
          />
          Solo zonas problemáticas
        </label>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          % fallo mín:
          <select
            className="input"
            value={minFail}
            onChange={e => setMinFail(Number(e.target.value))}
          >
            <option value={0}>0%</option>
            <option value={0.1}>10%</option>
            <option value={0.2}>20%</option>
            <option value={0.4}>40%</option>
            <option value={0.6}>60%</option>
          </select>
        </label>
      </div>

      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: 600 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-800 border-b border-line">
              <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Comuna (grid)</th>
                <th className="px-3 py-2 text-right">Visitas 60d</th>
                <th className="px-3 py-2 text-right">Fallidas</th>
                <th className="px-3 py-2 text-right">% fallo</th>
                <th className="px-3 py-2 text-left">Tags</th>
              </tr>
            </thead>
            <tbody>
              {data.map(c => (
                <tr key={c.customer_id} className="border-b border-line/50 hover:bg-bg-700/30">
                  <td className="px-3 py-2 text-text-muted">{c.customer_id}</td>
                  <td className="px-3 py-2 truncate max-w-[280px]" title={c.title}>
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-[10px] text-text-muted truncate">{c.address}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{c.comuna_id}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.n_visits_60d}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.n_failed_60d}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-semibold ${
                    c.fail_rate_60d > 0.4 ? 'text-accent-red' : c.fail_rate_60d > 0.2 ? 'text-accent-yellow' : 'text-text-secondary'
                  }`}>
                    {(c.fail_rate_60d * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    {c.is_problem_zone && <span className="pill pill-red mr-1">Zona</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
