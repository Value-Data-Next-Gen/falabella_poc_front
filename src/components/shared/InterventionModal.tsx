import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Ban, Calendar, Star, Wand2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../api';

interface Props {
  open: boolean;
  onClose: () => void;
  tracking_id: string;
  cliente?: string;
  driver_name?: string;
  current_eta?: string;
  current_motivo?: string;
  fecha: string;
}

type Action = 'cancel' | 'reschedule' | 'escalate_priority' | 'override_motivo';

const ACTIONS: Array<{
  key: Action; label: string; icon: typeof Ban; color: string; desc: string;
}> = [
  { key: 'cancel', label: 'Cancelar folio', icon: Ban, color: 'text-accent-red', desc: 'Suprime el folio. Driver no la visita.' },
  { key: 'reschedule', label: 'Reagendar ETA', icon: Calendar, color: 'text-accent-yellow', desc: 'Cambia la hora prevista de visita.' },
  { key: 'escalate_priority', label: 'Marcar urgente', icon: Star, color: 'text-cmr', desc: 'Eleva a prioridad HIGH.' },
  { key: 'override_motivo', label: 'Corregir motivo', icon: Wand2, color: 'text-brand', desc: 'Sobreescribe el motivo del último comentario.' },
];

const MOTIVOS = ['SIN MORADORES', 'DIRECCION ERRADA', 'CLIENTE RECHAZA', 'SINIESTRO', 'ENTREGADO OK', 'CALLE CORTADA'];

export function InterventionModal({
  open, onClose, tracking_id, cliente, driver_name,
  current_eta, current_motivo, fecha,
}: Props) {
  const [action, setAction] = useState<Action>('cancel');
  const [reason, setReason] = useState('');
  const [newEta, setNewEta] = useState('');
  const [newMotivo, setNewMotivo] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.admin.visitIntervention({
      tracking_id,
      action,
      reason: reason.trim() || undefined,
      new_eta: action === 'reschedule' ? newEta : undefined,
      new_motivo: action === 'override_motivo' ? newMotivo : undefined,
    }),
    onSuccess: (data) => {
      setError(null);
      setResult(
        `✓ ${data.action} aplicado. ` +
        `Driver notif: ${data.driver_notified ? 'sí' : 'no'} · ` +
        `Mgrs: ${data.manager_notified_count} · ` +
        `Admins: ${data.admin_notified_count}`
      );
      qc.invalidateQueries({ queryKey: ['driver-positions'] });
      qc.invalidateQueries({ queryKey: ['folios-tabla'] });
      qc.invalidateQueries({ queryKey: ['pilot-status'] });
    },
    onError: (e: any) => {
      setResult(null);
      setError(e?.message || String(e));
    },
  });

  if (!open) return null;

  const valid = action !== 'reschedule' || !!newEta;
  const validMotivo = action !== 'override_motivo' || !!newMotivo;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-800 border border-line rounded-lg max-w-lg w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Intervenir folio</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="text-[11px] text-text-muted mb-3 bg-bg-700/40 px-3 py-2 rounded">
          <div>TID: <span className="font-mono text-text-secondary">{tracking_id}</span></div>
          {cliente && <div>Cliente: <span className="text-text-secondary">{cliente}</span></div>}
          {driver_name && <div>Driver: <span className="text-text-secondary">{driver_name}</span></div>}
          {current_eta && <div>ETA actual: <span className="text-text-secondary">{current_eta}</span></div>}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {ACTIONS.map(a => {
            const Icon = a.icon;
            const active = action === a.key;
            return (
              <button
                key={a.key}
                onClick={() => { setAction(a.key); setResult(null); setError(null); }}
                className={`text-left p-2 rounded border ${
                  active ? 'border-brand bg-brand/10' : 'border-line hover:border-text-muted'
                }`}
              >
                <div className={`flex items-center gap-1.5 ${a.color}`}>
                  <Icon size={12} />
                  <span className="text-[11px] font-medium">{a.label}</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1">{a.desc}</div>
              </button>
            );
          })}
        </div>

        {action === 'reschedule' && (
          <div className="mb-3">
            <label className="text-[10px] text-text-muted block mb-1">Nueva ETA (datetime)</label>
            <input
              type="datetime-local"
              value={newEta}
              onChange={e => setNewEta(e.target.value)}
              className="input w-full text-[11px]"
            />
          </div>
        )}

        {action === 'override_motivo' && (
          <div className="mb-3">
            <label className="text-[10px] text-text-muted block mb-1">
              Nuevo motivo {current_motivo && <span>(actual: <span className="text-text-secondary">{current_motivo}</span>)</span>}
            </label>
            <select
              value={newMotivo}
              onChange={e => setNewMotivo(e.target.value)}
              className="input w-full text-[11px]"
            >
              <option value="">— elegir motivo —</option>
              {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="text-[10px] text-text-muted block mb-1">Razón / nota (opcional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="ej. cliente pidió mover a tarde, dirección incorrecta verificada..."
            className="input w-full text-[11px] min-h-[60px]"
            maxLength={500}
          />
        </div>

        {error && (
          <div className="text-[11px] text-accent-red flex items-center gap-1 mb-2 bg-accent-red/10 border border-accent-red/30 rounded px-2 py-1.5">
            <AlertCircle size={12} /> {error}
          </div>
        )}
        {result && (
          <div className="text-[11px] text-brand flex items-center gap-1 mb-2 bg-brand/10 border border-brand/30 rounded px-2 py-1.5">
            <CheckCircle2 size={12} /> {result}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="btn !text-[11px] !py-1.5 !px-3">Cerrar</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || !validMotivo || mutation.isPending}
            className="btn-primary !text-[11px] !py-1.5 !px-3 disabled:opacity-50"
          >
            {mutation.isPending ? 'Aplicando…' : 'Aplicar intervención'}
          </button>
        </div>
      </div>
    </div>
  );
}
