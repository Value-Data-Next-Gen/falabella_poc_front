/**
 * CR-012 T11 — Modal confirmación de escalamiento a supervisor.
 *
 * Único modal bloqueante de toda la UI. Razón: escalar a supervisor es una
 * acción cara reputacionalmente — no debe dispararse por accidente.
 *
 * Preview del mensaje renderizado con variables interpoladas. Botón Enviar
 * deshabilitado si supervisor_phone_is_mock=true.
 *
 * Backend: TODO(integration) — endpoint `/api/whatsapp/escalate-supervisor`
 * todavía no existe. Mock: console.warn + cierre. La hidratación real va
 * cuando exista el endpoint (CR-013).
 */
import { useState } from 'react';
import { X, AlertCircle, Send } from 'lucide-react';
import type { Visita, Ruta, Empresa } from '../../types/operacion';

interface Props {
  visit: Visita;
  ruta: Ruta;
  empresa: Empresa;
  onClose: () => void;
}

export function EscalationConfirmModal({ visit, ruta, empresa, onClose }: Props) {
  const [sending, setSending] = useState(false);
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
    if (isMock) return;
    setSending(true);
    try {
      // TODO(CR-013): conectar a POST /api/whatsapp/escalate-supervisor
      console.warn('[escalation] mock send to', empresa.supervisor_phone);
      await new Promise(r => setTimeout(r, 500));
      onClose();
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
        </div>

        <footer className="border-t border-line px-4 py-2.5 flex items-center justify-end gap-2 bg-bg-800/40">
          <button onClick={onClose} className="btn !py-1.5 !px-3 text-[11px]">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={isMock || sending}
            className={`!py-1.5 !px-3 text-[11px] rounded font-medium flex items-center gap-1.5 ${
              isMock || sending
                ? 'bg-bg-700 text-text-muted cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            <Send size={11} />
            {sending ? 'Enviando…' : 'Enviar escalamiento'}
          </button>
        </footer>
      </div>
    </div>
  );
}
