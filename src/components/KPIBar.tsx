import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, AlertTriangle, Target, TrendingUp, DollarSign, Package } from 'lucide-react';
import { api } from '../api';

export function KPIBar({ selectedVehicles }: { selectedVehicles: number[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ['kpis', selectedVehicles],
    queryFn: () => api.kpis(selectedVehicles),
    refetchInterval: 5000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-card animate-pulse h-[88px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 gap-3">
      <Card icon={Package} label="Visitas hoy" value={data.total} sub={`${data.completed} completadas`} />
      <Card
        icon={CheckCircle2}
        label="En ruta"
        value={data.pending}
        sub={`${data.completed} completadas`}
        color="text-accent-blue"
      />
      <Card
        icon={AlertTriangle}
        label="ROJO SimpliRoute"
        value={data.red_simpliroute}
        sub="slack ≤ 0 (incumpliendo)"
        color="text-accent-red"
      />
      <Card
        icon={Target}
        label="Alertas anticipadas VD"
        value={data.vd_alerts}
        sub={`${data.vd_alerts_caught_real} fallas reales capturadas`}
        color="text-accent-violet"
      />
      <Card
        icon={TrendingUp}
        label="Cumplimiento proyectado"
        value={`${data.projected_compliance_pct.toFixed(1)}%`}
        sub="con 60% recuperación"
        color="text-accent-green"
      />
      <Card
        icon={DollarSign}
        label="Delta de rescate"
        value={`$${data.rescue_clp.toLocaleString('es-CL')}`}
        sub="CLP estimados"
        color="text-accent-green"
      />
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-text-primary',
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className={`kpi-value ${color} tabular-nums`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}
