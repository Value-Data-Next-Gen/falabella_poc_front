import { useState } from 'react';
import { CheckCircle2, Clock, MessageSquare, XCircle } from 'lucide-react';
import { TrackingNotifSummary } from '../types';

/** Pill clickeable que muestra si una visita/tracking_id ya fue notificada.
 *  Click → popover con último mensaje enviado. */
export function NotifiedBadge({ summary, size = 'sm' }: {
  summary: TrackingNotifSummary | undefined;
  size?: 'xs' | 'sm';
}) {
  const [open, setOpen] = useState(false);

  if (!summary || summary.count === 0) {
    return null;
  }

  const all_sent = summary.sent_count === summary.count;
  const none_sent = summary.sent_count === 0;
  const color = none_sent ? 'text-accent-red border-accent-red/50 bg-accent-red/10'
    : all_sent ? 'text-brand border-brand/50 bg-brand/10'
    : 'text-accent-yellow border-accent-yellow/50 bg-accent-yellow/10';

  const Icon = none_sent ? XCircle : all_sent ? CheckCircle2 : Clock;
  const padding = size === 'xs' ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]';

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`inline-flex items-center gap-0.5 rounded border ${color} ${padding} font-semibold hover:shadow-md transition-shadow`}
        title={`${summary.sent_count}/${summary.count} enviadas`}
      >
        <Icon size={size === 'xs' ? 9 : 10} />
        {summary.count}
      </button>

      {open && (
        <>
          {/* overlay para cerrar clicando afuera */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 right-0 mt-1 w-80 bg-bg-800 border border-line rounded-md shadow-xl p-3 text-xs text-left"
               onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-line">
              <div className="font-semibold flex items-center gap-1">
                <MessageSquare size={12} className="text-brand" />
                Último envío
              </div>
              <span className={`pill ${summary.last_status === 'sent' ? 'pill-green' : summary.last_status === 'dry_run' ? 'pill-yellow' : 'pill-red'}`}>
                {summary.last_status}
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] mb-2">
              <span className="text-text-muted">A:</span>
              <span className="font-mono">{summary.last_to}</span>
              <span className="text-text-muted">Cuándo:</span>
              <span>{new Date(summary.last_created_at).toLocaleString('es-CL', { hour12: false })}</span>
              <span className="text-text-muted">Trigger:</span>
              <span>{summary.last_triggered_by}</span>
              <span className="text-text-muted">Envíos:</span>
              <span>{summary.sent_count} enviadas · {summary.count} total</span>
              {summary.last_twilio_sid && (
                <>
                  <span className="text-text-muted">Twilio SID:</span>
                  <span className="font-mono text-[10px] truncate">{summary.last_twilio_sid}</span>
                </>
              )}
              {summary.last_content_sid && (
                <>
                  <span className="text-text-muted">Template:</span>
                  <span className="font-mono text-[10px] truncate">{summary.last_content_sid}</span>
                </>
              )}
            </div>
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Mensaje</div>
              <div className="bg-bg-700 p-2 rounded text-[11px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                {summary.last_body}
              </div>
              {summary.last_content_variables && (
                <div className="mt-2">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Variables</div>
                  <div className="bg-bg-700 p-2 rounded text-[11px] font-mono">
                    {Object.entries(summary.last_content_variables).map(([k, v]) => (
                      <div key={k}>{`{{${k}}} = `}<span className="text-brand">{String(v)}</span></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </span>
  );
}
