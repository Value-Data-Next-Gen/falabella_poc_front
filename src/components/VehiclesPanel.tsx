import { useQuery } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { api } from '../api';

export function VehiclesPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: api.vehicles,
    refetchInterval: 5000,
  });

  if (isLoading || !data) return <div className="text-text-muted">Cargando...</div>;

  return (
    <div className="grid grid-cols-3 gap-3">
      {data.map(v => {
        const completionPct = v.n_visits > 0 ? (v.completed / v.n_visits) * 100 : 0;
        const hasIncident = v.incident_extra_min > 0;
        const status =
          v.red_simpliroute > 0 ? 'red' : v.vd_alerts > 0 ? 'violet' : 'green';
        return (
          <div key={v.vehicle_id} className="panel">
            <div className="panel-title">
              <span className="flex items-center gap-2 text-text-primary normal-case tracking-normal">
                <Truck size={14} className={
                  status === 'red' ? 'text-accent-red'
                  : status === 'violet' ? 'text-accent-violet'
                  : 'text-accent-green'
                } />
                <span className="font-semibold">{v.vehicle_name}</span>
              </span>
              {hasIncident && (
                <span className="pill pill-yellow">+{v.incident_extra_min.toFixed(0)}m</span>
              )}
            </div>
            <div className="p-3 space-y-3">
              <div>
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-text-muted mb-1">
                  <span>Progreso</span>
                  <span>
                    {v.completed} / {v.n_visits}
                  </span>
                </div>
                <div className="h-2 bg-bg-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-blue"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-text-primary tabular-nums">
                    {v.pending}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-text-muted">
                    Pendientes
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-accent-red tabular-nums">
                    {v.red_simpliroute}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-text-muted">
                    Rojo Simpli
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-accent-violet tabular-nums">
                    {v.vd_alerts}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-text-muted">
                    Alertas VD
                  </div>
                </div>
              </div>

              <div className="border-t border-line pt-2 flex justify-between text-[11px]">
                <span className="text-text-muted">Último delay obs.</span>
                <span
                  className={
                    v.last_observed_delay_min > 30
                      ? 'text-accent-red font-semibold'
                      : v.last_observed_delay_min > 10
                      ? 'text-accent-yellow'
                      : 'text-text-secondary'
                  }
                >
                  {v.last_observed_delay_min > 0
                    ? `+${v.last_observed_delay_min.toFixed(1)}min`
                    : 'sin atraso'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
