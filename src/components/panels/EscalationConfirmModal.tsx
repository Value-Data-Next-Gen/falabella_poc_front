/**
 * CR-012 T11 + CR-013 — Modal confirmación de escalamiento a supervisor.
 *
 * Único modal bloqueante de toda la UI. Razón: escalar a supervisor es una
 * acción cara reputacionalmente — no debe dispararse por accidente.
 *
 * Preview del mensaje renderizado con variables interpoladas. Botón Enviar
 * deshabilitado si supervisor_phone_is_mock=true.
 *
 * CR-013: conectado a POST /api/whatsapp/escalate-supervisor. Maneja errores
 * estructurados:
 *   - 409 supervisor_phone_not_configured → banner amber, modal abierto.
 *   - 429 cooldown → banner amber con Retry-After, modal abierto.
 *   - 5xx / network → "Error al enviar. Intentá de nuevo." Modal abierto.
 * Success → invalida ['plan-diario', fecha], muestra banner "enviado" o
 * "modo simulación" (si dry_run=true) y cierra tras 1500ms.
 */
import { useState } from 'react';
import { X, AlertCircle, Send, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Visita, Ruta, Empresa } from '../../types/operacion';
import { api, EscalateSupervisorError } from '../../api';

interface Props {
  visit: Visita;
  ruta: Ruta;
  empresa: Empresa;
  /** CR-013: fecha del día operativo activo. Se usa para invalidate del
   *  queryKey `['plan-diario', fecha, ...]` tras success. Si no se pasa,
   *  invalidamos por prefijo. */
  fecha?: string;
  onClose: () => void;
}

interface SuccessState {
  dispatch_id: number;
  dry_run: boolean;
}

export function EscalationConfirmModal({ visit, ruta, empresa, fecha, onClose }: Props) {
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const isMock = empresa.supervisor_phone_is_mock;

  // Template del mensaje WhatsApp. Variables interpoladas en plain text.
  const template = [
    `🚨 ESCALAMIENTO · ${empresa.empresa_nombre}`,
    ``,
    `Folio: ${visit.folio ?? visit.tracking_id}`,
    `Cliente: ${visit.cliente_nombre}${visit.is_vip ? ` (VIP ${visit.vip_tier ?? ''})` : ''}`,
    `Dirección: ${visit.address}, ${visit.comuna ?? ''}`,
    ``,
    `Driver: ${ruta.driver_name ?? '—'} · Ruta ${ruta.ruta_id}`,
    `Slack: ${visit.slack_min >= 0 ? '+' : ''}${visit.slack_min.toFixed(0)} min`,
    `Ventana cierra: ${visit.window_end || '—'}`,
    `P(fallo): ${(visit.p_fallo * 100).toFixed(0)}%`,
    ``,
    `Acción requerida: revisar y coordinar con el cliente.`,
  ].join('\n');

  const handleSend = async () => {
    if (isMock || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.whatsapp.escalateSupervisor({
        tracking_id: visit.tracking_id,
      });
      // Refrescar plan-diario para que alert_history muestre la nueva entrada.
      // Si tenemos `fecha`, invalidamos el queryKey específico; si no, por prefijo.
      if (fecha) {
        queryClient.invalidateQueries({ queryKey: ['plan-diario', fecha] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['plan-diario'] });
      }
      setSuccess({ dispatch_id: result.dispatch_id, dry_run: result.dry_run });
      // Cierre con delay para que el ops vea el banner verde.
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      if (err instanceof EscalateSupervisorError) {
        if (err.status === 409) {
          const body = err.body as { error?: string; empresa_id?: number } | null;
          if (body?.error === 'supervisor_phone_not_configured') {
            setError(
              `Empresa no tiene teléfono de supervisor configurado` +
              (body.empresa_id != null ? ` (empresa ${body.empresa_id}).` : '.'),
            );
          } else {
            setError('Conflicto al enviar (409). Verificá la configuración de la empresa.');
          }
        } else if (err.status === 429) {
          const waitSec = err.retryAfterSec ?? 60;
          setError(`Esperá ${waitSec} segundos antes de re-enviar (cooldown anti-spam).`);
        } else if (err.status >= 500) {
          setError('Error al enviar. Intentá de nuevo.');
        } else {
          setError('Error al enviar. Intentá de nuevo.');
        }
      } else {
        setError('Error al enviar. Intentá de nuevo.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-bg-900 border border-line rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <header className="bg-bg-800 border-b border-line px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <h2 className="text-[13px] font-semibold">Escalar a supervisor</h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary" title="Cancelar">
            <X size={14} />
          </button>
        </header>

        <div className="p-4 space-y-3 text-[11px] overflow-y-auto">
          <div className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-2">
            <span className="text-text-muted">Destino</span>
            <span className="text-text-primary tabular-nums">
              {empresa.supervisor_phone}
              {isMock && (
                <span className="ml-2 text-[9px] uppercase tracking-wider bg-amber-500/20 text-amber-500 px-1 py-0.5 rounded font-bold">
                  MOCK
                </span>
              )}
            </span>
            <span className="text-text-muted">Canal</span>
            <span className="text-text-primary">WhatsApp</span>
            <span className="text-text-muted">Empresa</span>
            <span className="text-text-primary">{empresa.empresa_nombre}</span>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Mensaje</div>
            <pre className="bg-bg-800/60 border border-line/40 rounded p-2 text-[10px] font-mono whitespace-pre-wrap text-text-primary leading-relaxed">
              {template}
            </pre>
          </div>

          {isMock && (
            <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/40 rounded p-2">
              Teléfono supervisor no configurado en backend. Botón Enviar deshabilitado.
              <br />
              Configurar `fpoc_empresas_transporte.supervisor_phone_e164` para empresa {empresa.empresa_id}.
            </div>
          )}

          {error && (
            <div className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/40 rounded p-2 flex items-start gap-2">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/40 rounded p-2 flex items-start gap-2">
              <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
              <span>
                Escalamiento enviado (#{success.dispatch_id}).
                {success.dry_run && (
                  <span className="ml-1 italic">Modo simulación (dry-run) — no se envió WhatsApp real.</span>
                )}
              </span>
            </div>
          )}
        </div>

        <footer className="border-t border-line px-4 py-2.5 flex items-center justify-end gap-2 bg-bg-800/40">
          <button onClick={onClose} className="btn !py-1.5 !px-3 text-[11px]">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={isMock || sending || success !== null}
            className={`!py-1.5 !px-3 text-[11px] rounded font-medium flex items-center gap-1.5 ${
              isMock || sending || success !== null
                ? 'bg-bg-700 text-text-muted cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            <Send size={11} />
            {sending ? 'Enviando…' : success ? 'Enviado' : 'Enviar escalamiento'}
          </button>
        </footer>
      </div>
    </div>
  );
}
