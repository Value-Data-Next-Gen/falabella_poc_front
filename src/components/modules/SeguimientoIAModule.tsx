import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, Bot, Clock, MessageSquare, Radio, Sparkles, Truck,
} from 'lucide-react';
import { api } from '../../api';
import { EventType, StreamEvent } from '../../types';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
// RouteOpsPanel se removió de Auditoría IA en R4 (era operativo).
import { MotivoCorrectionsPanel } from '../panels/MotivoCorrectionsPanel';

// 'asistente' (Copiloto) sigue en SUBS para redirect desde links viejos.
const SUBS: Record<string, true> = { comentarios: true, asistente: true, correcciones: true };
// Redirect: si entra a #/auditoria-ia/asistente, lo mandamos a 'comentarios'
const SUB_REDIRECT: Record<string, string> = { asistente: 'comentarios' };

const ALERT_TYPES: EventType[] = [
  'comment_alert',
  'vip_deadline_warning',
  'motivo_correction_suggested',
];

const SEV_PILL: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 ring-red-500/30',
  high:     'bg-orange-500/15 text-orange-400 ring-orange-500/30',
  medium:   'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  low:      'bg-slate-500/15 text-slate-400 ring-slate-500/30',
};

export function SeguimientoIAModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const activeRaw = sub && SUBS[sub] ? sub : 'comentarios';
  const active = SUB_REDIRECT[activeRaw] ?? activeRaw;
  // Ronda 4: 'Copiloto' (RouteOpsPanel) era operativo, no de auditoría —
  // ya está accesible desde Operación → drawer 'Plan'. Auditoría IA queda
  // solo con las 2 vistas de revisión IA.
  const tabs: SubTabDef[] = [
    { key: 'comentarios',   label: 'Alertas IA',             icon: MessageSquare },
    { key: 'correcciones',  label: 'Correcciones de motivo', icon: Bot },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto">
        {active === 'comentarios' && <div className="p-4"><RecentCommentsTab /></div>}
        {active === 'correcciones' && <div className="p-4"><MotivoCorrectionsPanel /></div>}
      </div>
    </div>
  );
}

function RecentCommentsTab() {
  const eventsQ = useQuery({
    queryKey: ['events-comments-vip-correcciones'],
    queryFn: () => api.events(80, ALERT_TYPES),
    refetchInterval: 4_000,
  });

  const events = eventsQ.data ?? [];
  const grouped = useMemo(() => events, [events]);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight">Alertas IA</h1>
        <p className="text-[12px] text-text-muted mt-0.5">
          Eventos del stream que la IA marca como interesantes para revisión:
          comentarios alertables de drivers, deadlines VIP en riesgo y motivos
          de no entrega que el modelo sugiere corregir.
        </p>
      </div>
      <div className="panel">
        <div className="panel-title flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Radio size={12} className="text-accent-green animate-pulse" />
            {grouped.length} eventos · refresh 4s
          </span>
        </div>
        {eventsQ.isLoading ? (
          <div className="p-6 flex flex-col gap-2 animate-pulse">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-bg-700/50"></div>
                <div className="flex-1 h-3 bg-bg-700/50 rounded"></div>
              </div>
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-[12px] flex flex-col gap-2 items-center">
            <span className="text-[13px] font-medium text-text-secondary">
              Sin alertas recientes.
            </span>
            <span className="max-w-md text-[11px]">
              Acá vas a ver eventos generados automáticamente cuando un driver
              reporte un comentario alertable (ej. <span className="font-mono">SINIESTRO EN CALLE</span>),
              cuando un VIP esté por exceder su deadline, o cuando el LLM proponga corregir
              el motivo de no entrega que escribió un driver.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-line/40">
            {grouped.map(e => <AlertRow key={e.event_id} e={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertRow({ e }: { e: StreamEvent }) {
  const sevCls = SEV_PILL[e.severity ?? 'medium'];
  const hour = e.sim_ts.slice(11, 16);
  const isVipDeadline = e.type === 'vip_deadline_warning';
  const isCorrection = e.type === 'motivo_correction_suggested';

  let iconColor = 'text-accent-red';
  let Icon: any = AlertTriangle;
  if (isVipDeadline) { Icon = Clock; iconColor = 'text-cmr'; }
  if (isCorrection) { Icon = Bot; iconColor = 'text-brand'; }

  return (
    <div className="px-4 py-2.5 hover:bg-bg-700/20 flex items-start gap-3">
      <div className="shrink-0 mt-0.5">
        <Icon size={14} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {isCorrection ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ring-1 bg-brand/15 text-brand ring-brand/30">
              <Sparkles size={9} className="mr-1" /> Revisión IA
            </span>
          ) : e.motivo ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ring-1 ${sevCls}`}>
              {e.motivo}
            </span>
          ) : isVipDeadline ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ring-1 bg-cmr/15 text-cmr ring-cmr/30">
              VIP DEADLINE
            </span>
          ) : null}
          <span className="text-[12px] font-medium truncate">
            {isCorrection
              ? `${e.motivo_reportado ?? '—'} → ${e.motivo_sugerido ?? '—'}`
              : (e.title || e.reason || '—')}
          </span>
          {e.tracking_id && (
            <span className="text-[10px] font-mono text-text-muted">{e.tracking_id}</span>
          )}
          <span className="ml-auto text-[10px] text-text-muted tabular-nums shrink-0">{hour}</span>
        </div>
        {(e.razonamiento || e.comentario) && (
          <div className="text-[11px] text-text-muted mt-0.5 italic truncate" title={e.razonamiento ?? e.comentario}>
            “{e.razonamiento ?? e.comentario}”
          </div>
        )}
        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-text-muted">
          {e.vehicle_name && <span className="flex items-center gap-1"><Truck size={9} /> {e.vehicle_name}</span>}
          {e.window_end && <span>window {e.window_end.slice(0, 5)}</span>}
          {e.confianza && <span>conf={e.confianza}</span>}
        </div>
      </div>
    </div>
  );
}
