import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, Loader2, Phone, Send, X } from 'lucide-react';
import { api } from '../api';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const prefsQ = useQuery({ queryKey: ['me-prefs'], queryFn: api.me.prefs, enabled: open });
  const configQ = useQuery({ queryKey: ['notif-config'], queryFn: api.notif.config, enabled: open });

  const [phone, setPhone] = useState('');
  const [notifyWA, setNotifyWA] = useState(false);
  const [pThresh, setPThresh] = useState(0.5);
  const [sThresh, setSThresh] = useState(15);
  const [onlyVip, setOnlyVip] = useState(false);

  useEffect(() => {
    if (prefsQ.data) {
      setPhone(prefsQ.data.phone_e164 ?? '');
      setNotifyWA(prefsQ.data.notify_whatsapp);
      setPThresh(prefsQ.data.notify_pfallo_threshold);
      setSThresh(prefsQ.data.notify_slack_min_threshold);
      setOnlyVip(prefsQ.data.notify_only_vip);
    }
  }, [prefsQ.data]);

  const saveMut = useMutation({
    mutationFn: () => api.me.updatePrefs({
      phone_e164: phone || null,
      notify_whatsapp: notifyWA,
      notify_pfallo_threshold: pThresh,
      notify_slack_min_threshold: sThresh,
      notify_only_vip: onlyVip,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me-prefs'] }),
  });

  const testMut = useMutation({
    mutationFn: api.notif.test,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-log'] }),
  });

  if (!open) return null;

  const dryRun = configQ.data?.dry_run;
  const hasCreds = configQ.data?.has_creds;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md panel max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold">Preferencias de notificación</h3>
          <button onClick={onClose} className="text-text-muted hover:text-accent-red">
            <X size={16} />
          </button>
        </div>

        {/* Estado Twilio */}
        <div className="px-4 py-3 border-b border-line text-xs flex items-center gap-2">
          {hasCreds ? (
            <span className="flex items-center gap-1 text-brand">
              <CheckCircle2 size={12} /> Twilio conectado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-accent-yellow">
              <AlertCircle size={12} /> Twilio sin credenciales
            </span>
          )}
          {dryRun && <span className="pill pill-yellow">DRY-RUN</span>}
          <span className="text-text-muted ml-auto">{configQ.data?.from_number}</span>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Phone */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1">
              <Phone size={11} /> Teléfono (formato E.164)
            </span>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+56912345678"
              className="input"
            />
          </label>

          {/* Toggle WA */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={notifyWA} onChange={e => setNotifyWA(e.target.checked)} />
            <span>Quiero recibir notificaciones por WhatsApp</span>
          </label>

          {/* Threshold p_fallo */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-text-muted">
              <span>Umbral P(fallo) → alerta</span>
              <span className="font-mono text-brand">{(pThresh * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min={0.1} max={0.95} step={0.05}
              value={pThresh}
              onChange={e => setPThresh(Number(e.target.value))}
              className="accent-brand"
              disabled={!notifyWA}
            />
            <span className="text-[10px] text-text-muted">
              Dispara si la probabilidad de fallo de una visita supera este valor.
            </span>
          </div>

          {/* Threshold slack */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-text-muted">
              <span>Umbral slack (min hasta window_end)</span>
              <span className="font-mono text-brand">{sThresh} min</span>
            </div>
            <input
              type="range"
              min={0} max={120} step={5}
              value={sThresh}
              onChange={e => setSThresh(Number(e.target.value))}
              className="accent-brand"
              disabled={!notifyWA}
            />
            <span className="text-[10px] text-text-muted">
              Dispara también si la visita tiene menos de este slack al deadline.
            </span>
          </div>

          {/* Only VIP */}
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={onlyVip}
              onChange={e => setOnlyVip(e.target.checked)}
              disabled={!notifyWA}
            />
            <span>Solo para clientes VIP</span>
          </label>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {saveMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Guardar
            </button>
            <button
              onClick={() => testMut.mutate()}
              disabled={!notifyWA || !phone || testMut.isPending}
              className="btn flex items-center gap-2"
            >
              {testMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Enviar test
            </button>
            {saveMut.isSuccess && <span className="text-[11px] text-brand">Guardado ✓</span>}
            {testMut.isSuccess && (
              <span className="text-[11px] text-text-secondary">
                {testMut.data.dry_run ? 'Dry-run OK' : `Enviado (${testMut.data.sent})`}
              </span>
            )}
            {testMut.isError && (
              <span className="text-[11px] text-accent-red">{String(testMut.error)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
