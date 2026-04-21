import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Phone, Truck } from 'lucide-react';
import { api } from '../api';

export function AlertsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.alerts(20),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <div className="p-4 text-text-muted text-xs">Cargando...</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-text-muted text-xs">
        <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
        Sin alertas anticipadas en este momento.
        <br />
        El modelo no detecta visitas con riesgo &gt; 50% y horizonte ≥ 2h.
      </div>
    );
  }

  return (
    <div className="divide-y divide-line">
      {data.map(alert => (
        <div key={alert.tracking_id} className="p-3 hover:bg-bg-700/50 transition-colors">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{alert.title}</div>
              <div className="text-[11px] text-text-muted flex items-center gap-2 mt-0.5">
                <Truck size={10} />
                {alert.vehicle_name}
                <span>·</span>
                <span>window {alert.window_end}</span>
                <span>·</span>
                <span>{alert.horas_hasta_window_end.toFixed(1)}h</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-semibold text-accent-red tabular-nums">
                {(alert.p_fallo * 100).toFixed(0)}%
              </div>
              <div className="text-[9px] uppercase tracking-wider text-text-muted">P(fallo)</div>
            </div>
          </div>

          {/* Probability bar */}
          <div className="h-1.5 bg-bg-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-accent-yellow to-accent-red"
              style={{ width: `${Math.min(100, alert.p_fallo * 100)}%` }}
            />
          </div>

          {/* SHAP factors */}
          {alert.top_factors.length > 0 && (
            <div className="space-y-1 mt-2">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                Factores de riesgo
              </div>
              {alert.top_factors.slice(0, 3).map((f, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-text-secondary truncate" title={f.display}>
                    {f.display}
                  </span>
                  <span className="text-accent-red tabular-nums shrink-0 ml-2">
                    +{f.contribution.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            className="mt-3 w-full btn-primary flex items-center justify-center gap-1 text-[10px]"
            onClick={() =>
              alert &&
              window.alert(`Demo: notificación a ${alert.title} (no envía)`)
            }
          >
            <Phone size={11} /> Notificar cliente
          </button>
        </div>
      ))}
    </div>
  );
}
