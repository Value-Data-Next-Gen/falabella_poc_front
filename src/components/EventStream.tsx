import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Radio,
  RefreshCcw,
  Truck,
  UserPlus,
  XCircle,
  Zap,
  Wrench,
} from 'lucide-react';
import { api } from '../api';
import { EventType, StreamEvent } from '../types';

const ICON_BY_TYPE: Record<EventType, { icon: any; color: string; label: string }> = {
  delivery: { icon: CheckCircle2, color: 'text-accent-green', label: 'Entrega' },
  failed_delivery: { icon: XCircle, color: 'text-accent-red', label: 'Entrega tardía' },
  alert_triggered: { icon: Zap, color: 'text-accent-violet', label: 'Alerta VD' },
  alert_cleared: { icon: CheckCircle2, color: 'text-text-secondary', label: 'Alerta resuelta' },
  red_simpli: { icon: AlertTriangle, color: 'text-accent-red', label: 'Rojo SimpliRoute' },
  incident_auto: { icon: AlertOctagon, color: 'text-accent-yellow', label: 'Incidente auto' },
  incident_manual: { icon: Wrench, color: 'text-accent-yellow', label: 'Incidente manual' },
  day_reset: { icon: RefreshCcw, color: 'text-accent-blue', label: 'Reset día' },
  comment_alert: { icon: MessageSquare, color: 'text-accent-red', label: 'Motivo alertable' },
  vip_deadline_warning: { icon: AlertTriangle, color: 'text-cmr', label: 'Deadline VIP próximo' },
  motivo_correction_suggested: { icon: MessageSquare, color: 'text-brand', label: 'Revisión IA' },
  motivo_correction_decided:   { icon: CheckCircle2,  color: 'text-text-secondary', label: 'Decisión IA' },
  wa_user_onboarded: { icon: UserPlus, color: 'text-accent-green', label: 'Nuevo en WhatsApp' },
};

export function EventStream() {
  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.events(80),
    refetchInterval: 3000,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (data && data.length > 0 && data[0].event_id !== lastIdRef.current) {
      lastIdRef.current = data[0].event_id;
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [data]);

  if (isLoading) {
    return <div className="p-4 text-text-muted text-xs">Cargando stream...</div>;
  }

  const events = data ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-line flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-secondary">
          <Radio size={12} className="text-accent-green animate-pulse" />
          Stream en vivo
        </span>
        <span className="text-[10px] text-text-muted">{events.length} eventos · refresh 3s</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto divide-y divide-line/50">
        {events.length === 0 ? (
          <div className="p-4 text-center text-text-muted text-xs">Sin eventos aún.</div>
        ) : (
          events.map(e => <EventRow key={e.event_id} e={e} />)
        )}
      </div>
    </div>
  );
}

function EventRow({ e }: { e: StreamEvent }) {
  const meta = ICON_BY_TYPE[e.type] ?? {
    icon: Radio,
    color: 'text-text-muted',
    label: e.type,
  };
  const Icon = meta.icon;
  const sim = e.sim_ts.slice(11, 19);

  return (
    <div className="px-3 py-2 hover:bg-bg-700/40">
      <div className="flex items-start gap-2">
        <Icon size={14} className={`${meta.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-[10px] uppercase tracking-wider ${meta.color}`}>
              {meta.label}
            </span>
            <span className="text-[10px] text-text-muted tabular-nums">{sim}</span>
          </div>
          <div className="text-xs mt-0.5 text-text-primary truncate">
            {e.type === 'wa_user_onboarded' ? (
              <>
                <span className="font-medium">{e.name || e.phone}</span>
                {e.kind && <span className="text-text-muted"> · {e.kind}</span>}
                {e.empresa_nombre && <span className="text-text-muted"> · {e.empresa_nombre}</span>}
                {e.source === 'inbound' && <span className="text-text-muted"> · 📥 vía WhatsApp</span>}
                {e.source === 'manual_admin' && <span className="text-text-muted"> · 👤 alta admin</span>}
              </>
            ) : (e.title || e.reason || '')}
          </div>
          {e.motivo && (
            <div className="text-[10px] mt-0.5 flex items-center gap-2 flex-wrap">
              <span
                className={
                  'pill border ' +
                  (e.severity === 'critical'
                    ? 'bg-accent-violet/15 text-accent-violet border-accent-violet/40'
                    : e.severity === 'high'
                      ? 'bg-accent-red/15 text-accent-red border-accent-red/40'
                      : e.severity === 'medium'
                        ? 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40'
                        : 'bg-bg-700 text-text-secondary border-line')
                }
              >
                {e.motivo}
              </span>
              {e.comentario && (
                <span className="text-text-muted truncate">
                  "{e.comentario.length > 60 ? e.comentario.slice(0, 60) + '…' : e.comentario}"
                </span>
              )}
            </div>
          )}
          <div className="text-[10px] text-text-muted flex items-center gap-2 mt-0.5 flex-wrap">
            {e.vehicle_name && (
              <span className="flex items-center gap-1">
                <Truck size={9} /> {e.vehicle_name}
              </span>
            )}
            {e.window_end && <span>window {e.window_end.slice(0, 5)}</span>}
            {e.p_fallo != null && (
              <span className="text-accent-violet">
                p={Math.round(e.p_fallo * 100)}%
              </span>
            )}
            {e.slack_min != null && (
              <span className={e.slack_min < 0 ? 'text-accent-red' : 'text-accent-green'}>
                slack {e.slack_min.toFixed(0)}m
              </span>
            )}
            {e.delay_min != null && e.delay_min > 0 && (
              <span className="text-accent-red">+{e.delay_min.toFixed(0)}m tarde</span>
            )}
            {e.extra_min != null && (
              <span className="text-accent-yellow">+{e.extra_min.toFixed(0)}m</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
