/**
 * CR-012 T8 — Slide-over de drill-down de una visita.
 *
 * Trigger: useOperacionStore.selectedVisitaId. Cuando el usuario hace click
 * en un pin del mapa, parada del Gantt (T9) o "ver detalle" de una alerta
 * (T10), ese ID se setea y este componente se abre.
 *
 * NO es modal bloqueante: el mapa y los paneles siguen interactivos atrás.
 * Cerrar = setSelectedVisita(null).
 *
 * Acciones:
 *   - 📞 Contactar driver (deshabilitado si driver_phone_is_mock)
 *   - 🚨 Escalar a supervisor (abre EscalationConfirmModal — T11)
 *   - 🔖 Marcar para seguimiento (local Zustand watchlist — TODO)
 *   - 📍 Centrar en mapa (flyTo)
 *
 * Decisión usuario (CR-012, decisión 4): NO notificar cliente. La acción
 * "Notificar cliente con ETA" del brief queda OUT-OF-SCOPE v1.
 */
import { useMemo, useState } from 'react';
import {
  X, Phone, Bookmark, Crosshair, AlertCircle, MapPin, Clock,
  CheckCircle2, XCircle, MessageSquare,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { useOperacionStore } from '../../stores/useOperacionStore';
import type { Visita, Ruta, Empresa, AlertEvent } from '../../types/operacion';
import { EscalationConfirmModal } from './EscalationConfirmModal';

interface Props {
  fecha: string | null;
  empresaId: number | null;
  /** CR-012 Fix V2: region/onlyVip se reciben para que el queryKey de plan-diario
   *  coincida con el del padre y se dedupee (1 fetch en vez de 2). */
  region: string;
  onlyVip: boolean;
}

/** Devuelve 2-3 razones explicativas del p_fallo, derivadas de campos del
 *  payload. TODO(ai-integration): reemplazar por GET /api/p-fallo/explain/{tid}. */
function explainPFallo(v: Visita): string[] {
  const reasons: string[] = [];
  if (v.slack_min < -60) reasons.push(`Retraso acumulado: ${Math.abs(v.slack_min).toFixed(0)} min`);
  if (v.alert_slack === 'RED') reasons.push('Ventana de entrega vencida o muy próxima');
  if (v.is_vip && v.vip_tier === 'platinum') reasons.push('Cliente VIP Platinum con SLA estricto');
  if (v.priority_reason) reasons.push(v.priority_reason);
  return reasons.slice(0, 3);
}

function alertTypeLabel(t: AlertEvent['type']): string {
  if (t === 'retraso_vip') return 'Retraso VIP';
  if (t === 'driver_sin_respuesta') return 'Driver sin respuesta';
  return 'Motivo con patrón';
}

function channelIcon(c: AlertEvent['channel']) {
  if (c === 'whatsapp') return <MessageSquare size={11} className="text-emerald-500" />;
  if (c === 'sms') return <MessageSquare size={11} className="text-amber-500" />;
  return <AlertCircle size={11} className="text-text-muted" />;
}

export function VisitaDetailDrawer({ fecha, empresaId, region, onlyVip }: Props) {
  const selectedVisitaId = useOperacionStore(s => s.selectedVisitaId);
  const setSelectedVisita = useOperacionStore(s => s.setSelectedVisita);
  const [showEscalation, setShowEscalation] = useState(false);

  // CR-012 Fix V2: queryKey CANÓNICO compartido con OperacionModuleV2 →
  // 1 fetch sirve a KpiStrip, MapaTab, DriversAvancePanel, GanttPorParada,
  // y este drawer.
  const planQ = useQuery({
    queryKey: ['plan-diario', fecha, empresaId, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaId ?? undefined,
      region,
      only_vip: onlyVip,
      source: 'real',
      planned_date: fecha ?? undefined,
    }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!fecha,
  });

  // Busca visita + ruta + empresa por tracking_id.
  const ctx = useMemo(() => {
    if (!selectedVisitaId || !planQ.data) return null;
    for (const e of (planQ.data.empresas ?? []) as Empresa[]) {
      for (const r of (e.rutas ?? []) as Ruta[]) {
        const v = r.visitas?.find((x: Visita) => x.tracking_id === selectedVisitaId);
        if (v) return { visit: v, ruta: r, empresa: e };
      }
    }
    return null;
  }, [selectedVisitaId, planQ.data]);

  if (!selectedVisitaId) return null;

  return (
    <>
      <div
        className="absolute top-0 right-0 bottom-0 w-[280px] bg-bg-900 border-l border-line shadow-2xl z-30 overflow-y-auto"
        style={{ animation: 'slideInRight 200ms ease-out' }}
      >
        <div className="sticky top-0 bg-bg-800 border-b border-line px-3 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-mono text-text-muted truncate">
              {ctx?.visit.folio ?? selectedVisitaId}
            </span>
            {ctx?.visit.is_vip && (
              <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 font-bold">
                VIP {ctx.visit.vip_tier ?? ''}
              </span>
            )}
            {ctx?.visit.alert_valuedata && !ctx.visit.is_vip && (
              <span className="text-[8px] uppercase tracking-wider px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">
                VD
              </span>
            )}
          </div>
          <button
            onClick={() => setSelectedVisita(null)}
            className="text-text-muted hover:text-text-primary"
            title="Cerrar (Esc)"
          >
            <X size={14} />
          </button>
        </div>

        {!ctx ? (
          <div className="p-4 text-[11px] text-text-muted">Cargando visita…</div>
        ) : (
          <div className="p-3 space-y-3 text-[11px]">
            <section>
              <div className="font-semibold text-text-primary text-[13px] mb-0.5">
                {ctx.visit.cliente_nombre}
              </div>
              <div className="text-text-muted font-mono">{ctx.visit.tracking_id}</div>
              <div className="flex items-start gap-1.5 mt-1 text-text-secondary">
                <MapPin size={11} className="text-text-muted mt-0.5 shrink-0" />
                <div>
                  <div>{ctx.visit.address || '—'}</div>
                  <div className="text-text-muted">{ctx.visit.comuna ?? '—'} · {ctx.visit.region}</div>
                </div>
              </div>
            </section>

            {/* Bloque ETA */}
            <section className="bg-bg-800/50 rounded-md p-2">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                <Clock size={10} /> ETA
              </div>
              <div className="grid grid-cols-2 gap-1 tabular-nums">
                <div className="text-text-muted">Planificada</div>
                <div className="text-right">{ctx.visit.planned_arrival_time || '—'}</div>
                <div className="text-text-muted">Estimada</div>
                <div className="text-right">{ctx.visit.estimated_time_arrival || '—'}</div>
                <div className="text-text-muted">Ventana cierra</div>
                <div className="text-right">{ctx.visit.window_end || '—'}</div>
                <div className="text-text-muted">Slack</div>
                <div className={`text-right font-semibold ${
                  ctx.visit.slack_min < 0 ? 'text-red-500' :
                  ctx.visit.slack_min < 30 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {ctx.visit.slack_min >= 0 ? '+' : ''}{ctx.visit.slack_min.toFixed(0)} min
                </div>
              </div>
            </section>

            {/* Bloque P(fallo) */}
            <section className="bg-bg-800/50 rounded-md p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">P(fallo)</span>
                <span className={`text-[20px] font-bold tabular-nums ${
                  ctx.visit.p_fallo >= 0.5 ? 'text-red-500' :
                  ctx.visit.p_fallo >= 0.2 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {(ctx.visit.p_fallo * 100).toFixed(0)}%
                </span>
              </div>
              {(() => {
                const reasons = explainPFallo(ctx.visit);
                if (!reasons.length) {
                  return <div className="text-[10px] text-text-muted italic">Sin features explicativas.</div>;
                }
                return (
                  <ul className="space-y-0.5 text-text-secondary text-[10px]">
                    {reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-text-muted">·</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                );
              })()}
              <div className="text-[9px] text-text-muted italic mt-1.5">
                TODO(ai-integration): /api/p-fallo/explain/{ctx.visit.tracking_id}
              </div>
            </section>

            {/* Historial de alertas */}
            <section>
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">
                Historial de alertas ({ctx.visit.alert_history?.length ?? 0})
              </div>
              {(ctx.visit.alert_history?.length ?? 0) === 0 ? (
                <div className="text-[10px] text-text-muted italic">Sin alertas enviadas.</div>
              ) : (
                <ul className="space-y-1">
                  {ctx.visit.alert_history.map((ev, i) => {
                    const ack = !!ev.acknowledged_at;
                    return (
                      <li key={i} className="flex items-start gap-1.5 text-[10px] bg-bg-800/30 rounded p-1.5">
                        {channelIcon(ev.channel)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-text-primary">{alertTypeLabel(ev.type)}</span>
                            <span className="text-text-muted">→ {ev.target}</span>
                          </div>
                          <div className="text-text-muted tabular-nums">{ev.timestamp}</div>
                        </div>
                        {ack ? (
                          <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle size={12} className="text-red-500 shrink-0" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Acciones rápidas */}
            <section className="space-y-1.5 pt-2 border-t border-line/40">
              <ActionButton
                icon={Phone}
                label="Contactar driver"
                disabled={ctx.ruta.driver_phone_is_mock}
                tooltip={ctx.ruta.driver_phone_is_mock ? 'Teléfono no configurado en backend' : `Llamar ${ctx.ruta.driver_phone}`}
                onClick={() => {
                  if (!ctx.ruta.driver_phone_is_mock) {
                    window.location.href = `tel:${ctx.ruta.driver_phone}`;
                  }
                }}
              />
              <ActionButton
                icon={AlertCircle}
                label="Escalar a supervisor"
                tone="danger"
                disabled={ctx.empresa.supervisor_phone_is_mock}
                tooltip={ctx.empresa.supervisor_phone_is_mock ? 'Supervisor no configurado en backend' : 'Abre modal de confirmación'}
                onClick={() => setShowEscalation(true)}
              />
              <ActionButton
                icon={Bookmark}
                label="Marcar para seguimiento"
                onClick={() => {
                  // TODO(CR-013): watchlist manual en Zustand
                  console.warn('[drawer] manual watchlist no implementado');
                }}
              />
              <ActionButton
                icon={Crosshair}
                label="Centrar en mapa"
                onClick={() => {
                  // El mapa ya enfocó al hacer click en el pin; este botón
                  // re-centra cuando el drawer se abrió desde Gantt/alerta.
                  // TODO(CR-013): exponer flyTo desde el store.
                  setSelectedVisita(ctx.visit.tracking_id);
                }}
              />
            </section>
          </div>
        )}

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>

      {showEscalation && ctx && (
        <EscalationConfirmModal
          visit={ctx.visit}
          ruta={ctx.ruta}
          empresa={ctx.empresa}
          fecha={fecha ?? undefined}
          onClose={() => setShowEscalation(false)}
        />
      )}
    </>
  );
}

function ActionButton({
  icon: Icon, label, onClick, disabled, tooltip, tone = 'neutral',
}: {
  icon: typeof Phone;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
  tone?: 'neutral' | 'danger';
}) {
  const cls = disabled
    ? 'border-line/30 bg-bg-800/30 text-text-muted cursor-not-allowed'
    : tone === 'danger'
    ? 'border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20'
    : 'border-line/60 bg-bg-800/50 text-text-primary hover:bg-bg-700/60';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded border text-[11px] font-medium ${cls}`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
