import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, MessageSquare, Send, Truck, X } from 'lucide-react';
import { api } from '../api';
import { AnticipatedAlert } from '../types';
import { NotifiedBadge } from './NotifiedBadge';

export function AlertsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.alerts(20),
    refetchInterval: 5000,
  });
  const [notifyFor, setNotifyFor] = useState<AnticipatedAlert | null>(null);

  const trackingIds = useMemo(() => (data ?? []).map(a => a.tracking_id), [data]);
  const notifMap = useQuery({
    queryKey: ['alerts-notif-summary', trackingIds.join(',')],
    queryFn: () => api.notif.byTrackings(trackingIds),
    enabled: trackingIds.length > 0,
    refetchInterval: 10_000,
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
              <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                <span className="truncate">{alert.title}</span>
                <NotifiedBadge summary={notifMap.data?.[alert.tracking_id]} />
              </div>
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
            onClick={() => setNotifyFor(alert)}
          >
            <MessageSquare size={11} /> Notificar por WhatsApp
          </button>
        </div>
      ))}
      <NotifyAlertModal alert={notifyFor} onClose={() => setNotifyFor(null)} />
    </div>
  );
}

function NotifyAlertModal({ alert, onClose }: { alert: AnticipatedAlert | null; onClose: () => void }) {
  const { data: cfg } = useQuery({ queryKey: ['notif-config'], queryFn: api.notif.config, enabled: !!alert });
  const [body, setBody] = useState('');
  const [numbers, setNumbers] = useState('');
  const [mode, setMode] = useState<'freeform' | 'template'>('freeform');
  const [var1, setVar1] = useState('');
  const [var2, setVar2] = useState('');

  const defaultTemplateSid = cfg?.default_content_sid ?? '';
  const defaultBody = alert
    ? `[Falabella ValueData] Alerta anticipada\nCliente: ${alert.title}\nVehículo: ${alert.vehicle_name}\nWindow end: ${alert.window_end}\nETA: ${alert.estimated_time_arrival}\nRiesgo: ${(alert.p_fallo * 100).toFixed(0)}%\nAcción: llamar al cliente.`
    : '';

  // Pre-fill template variables con window_end y eta
  if (alert && !var1 && !var2 && mode === 'template') {
    setVar1(alert.window_end.slice(0, 10));
    setVar2(alert.estimated_time_arrival.slice(0, 5));
  }

  const sendMut = useMutation({
    mutationFn: () => {
      if (mode === 'template') {
        return api.notif.send({
          content_sid: defaultTemplateSid,
          content_variables: { '1': var1, '2': var2 },
          to_numbers: numbers.split(',').map(s => s.trim()).filter(Boolean),
          tracking_id: alert?.tracking_id,
          subject: `Alerta ${alert?.title}`,
          triggered_by: 'manual',
        } as any);
      }
      return api.notif.send({
        body: body || defaultBody,
        to_numbers: numbers.split(',').map(s => s.trim()).filter(Boolean),
        tracking_id: alert?.tracking_id,
        subject: `Alerta ${alert?.title}`,
        triggered_by: 'manual',
      });
    },
    onSuccess: () => { setBody(''); setNumbers(''); onClose(); },
  });

  if (!alert) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md panel">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold">Notificar: {alert.title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-accent-red"><X size={16} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3 text-xs">
          {/* Selector modo */}
          <div className="flex items-center gap-2 p-2 bg-bg-700/40 rounded">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Modo:</span>
            <button
              onClick={() => setMode('freeform')}
              className={`px-2 py-1 rounded text-[11px] ${mode === 'freeform' ? 'bg-brand/20 text-brand border border-brand/40' : 'text-text-secondary border border-line'}`}
            >
              Freeform body
            </button>
            <button
              onClick={() => setMode('template')}
              disabled={!defaultTemplateSid}
              className={`px-2 py-1 rounded text-[11px] ${mode === 'template' ? 'bg-brand/20 text-brand border border-brand/40' : 'text-text-secondary border border-line'} disabled:opacity-50`}
              title={!defaultTemplateSid ? 'Config TWILIO_CONTENT_SID para habilitar' : undefined}
            >
              Template
            </button>
            {mode === 'template' && (
              <span className="text-[10px] text-text-muted ml-auto font-mono">{defaultTemplateSid}</span>
            )}
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Destinatarios (E.164, separados por coma)</span>
            <input
              value={numbers}
              onChange={e => setNumbers(e.target.value)}
              placeholder="+56912345678, +56987654321"
              className="input"
            />
          </label>

          {mode === 'freeform' ? (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-text-muted">Mensaje</span>
              <textarea
                value={body || defaultBody}
                onChange={e => setBody(e.target.value)}
                rows={6}
                className="input font-mono text-[11px] resize-none"
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-text-muted">Variable {'{{1}}'}</span>
                <input value={var1} onChange={e => setVar1(e.target.value)} className="input" placeholder="ej: 12/1" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-text-muted">Variable {'{{2}}'}</span>
                <input value={var2} onChange={e => setVar2(e.target.value)} className="input" placeholder="ej: 3pm" />
              </label>
              <div className="text-[10px] text-text-muted">
                El contenido exacto depende de tu template aprobado en Twilio Console.
              </div>
            </>
          )}
          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending || !numbers.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {sendMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar
            </button>
            <button onClick={onClose} className="btn">Cancelar</button>
            {sendMut.isError && <span className="text-[11px] text-accent-red">{String(sendMut.error)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
