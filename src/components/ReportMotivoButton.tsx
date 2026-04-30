import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { api } from '../api';

export function ReportMotivoButton({
  trackingId,
  variant = 'primary',
  className = '',
  onSent,
}: {
  trackingId: string;
  variant?: 'primary' | 'ghost';
  className?: string;
  onSent?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className={
          (variant === 'primary' ? 'btn-primary ' : 'btn ') +
          'flex items-center gap-1 ' +
          className
        }
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Reportar motivo"
      >
        <MessageSquare size={12} /> Reportar motivo
      </button>
      {open && (
        <ReportMotivoModal
          trackingId={trackingId}
          onClose={() => setOpen(false)}
          onSent={onSent}
        />
      )}
    </>
  );
}

function ReportMotivoModal({
  trackingId,
  onClose,
  onSent,
}: {
  trackingId: string;
  onClose: () => void;
  onSent?: () => void;
}) {
  const qc = useQueryClient();
  const motivosQ = useQuery({ queryKey: ['motivos-catalog'], queryFn: api.motivos.list });
  const cfgQ = useQuery({
    queryKey: ['motivos-alert-config-effective'],
    queryFn: () => api.motivos.alertConfig(),
  });

  const cfgByMotivo = new Map((cfgQ.data ?? []).map(c => [c.motivo, c]));

  const [motivo, setMotivo] = useState<string>('');
  const [comentario, setComentario] = useState<string>('');

  const sendMut = useMutation({
    mutationFn: () => api.comments.add(trackingId, { motivo, comentario }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events-live'] });
      qc.invalidateQueries({ queryKey: ['comments-recent'] });
      qc.invalidateQueries({ queryKey: ['comments-for-visit', trackingId] });
      onSent?.();
      onClose();
    },
  });

  const selected = motivo ? cfgByMotivo.get(motivo) : undefined;
  const willAlert = selected?.alertable ?? false;
  const severity = selected?.severity ?? 'medium';

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!motivo || !comentario.trim()) return;
    sendMut.mutate();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="panel p-5 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare size={14} /> Reportar motivo
          </h3>
          <button onClick={onClose} className="btn p-1" title="Cerrar">
            <X size={14} />
          </button>
        </div>

        <p className="text-[11px] text-text-muted mb-3">
          Visita <span className="font-mono text-text-primary">{trackingId}</span>
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">
              Motivo
            </span>
            <select
              className="input"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              required
              disabled={motivosQ.isLoading}
            >
              <option value="">— elegí un motivo —</option>
              {(motivosQ.data ?? []).map(m => {
                const c = cfgByMotivo.get(m.motivo);
                const isAlert = c?.alertable ?? m.default_alertable;
                return (
                  <option key={m.motivo} value={m.motivo}>
                    {isAlert ? '🔔 ' : ''}
                    {m.motivo}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">
              Comentario
            </span>
            <textarea
              className="input min-h-[100px]"
              value={comentario}
              onChange={e => setComentario(e.target.value)}
              maxLength={2000}
              placeholder="Detalle de lo que pasó (lo lee el operador)…"
              required
            />
            <span className="text-[10px] text-text-muted text-right">
              {comentario.length}/2000
            </span>
          </label>

          {motivo && (
            <div
              className={
                willAlert
                  ? 'rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red flex items-center gap-2'
                  : 'rounded border border-line bg-bg-700 px-3 py-2 text-[11px] text-text-muted flex items-center gap-2'
              }
            >
              <Bell size={12} />
              {willAlert
                ? `Este motivo dispara alerta (severidad ${severity}). Operadores serán notificados.`
                : 'Este motivo NO dispara alerta — quedará registrado solamente.'}
            </div>
          )}

          {sendMut.isError && (
            <div className="text-[11px] text-accent-red">
              {(sendMut.error as Error)?.message ?? 'Error al enviar'}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-1"
              disabled={!motivo || !comentario.trim() || sendMut.isPending}
            >
              {sendMut.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Enviar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
