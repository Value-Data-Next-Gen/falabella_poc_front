import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, MessageCircle } from 'lucide-react';
import { api } from '../../api';
import { Modal } from './Modal';

interface Props {
  phone: string | null;
  name?: string;
  roleHint?: 'driver' | 'manager' | 'contacto';
  driverId?: string;
  userId?: number;
  contactId?: number;
  size?: 'sm' | 'md';
}

/** Botón "Invitar a WhatsApp" — abre modal de confirmación + permite editar mensaje. */
export function WhatsAppInviteButton({
  phone, name, roleHint, driverId, userId, contactId, size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const disabled = !phone || phone.trim().length < 8;

  return (
    <>
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${
          size === 'sm' ? 'text-[10px]' : 'text-[11px]'
        } text-accent-green hover:underline flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed`}
        title={disabled ? 'Sin teléfono cargado' : `Invitar ${phone} a WhatsApp`}
      >
        <MessageCircle size={size === 'sm' ? 10 : 12} />
        invitar
      </button>
      {open && phone && (
        <InviteModal
          phone={phone}
          name={name}
          roleHint={roleHint}
          driverId={driverId}
          userId={userId}
          contactId={contactId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}


function InviteModal({ phone, name, roleHint, driverId, userId, contactId, onClose }: {
  phone: string;
  name?: string;
  roleHint?: 'driver' | 'manager' | 'contacto';
  driverId?: string;
  userId?: number;
  contactId?: number;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState('');
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.admin.whatsappInvite>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const inviteMut = useMutation({
    mutationFn: () => api.admin.whatsappInvite({
      phone_e164: phone,
      name,
      role_hint: roleHint,
      driver_id: driverId,
      user_id: userId,
      contact_id: contactId,
      custom_message: custom.trim() || undefined,
    }),
    onSuccess: (r) => { setResult(r); setErr(null); },
    onError: (e: Error) => setErr(e?.message ?? 'error'),
  });

  return (
    <Modal title="Invitar a WhatsApp" onClose={onClose}>
      <div className="flex flex-col gap-3 text-[12px]">
        <div className="text-[11px] text-text-muted">
          Se enviará un mensaje proactivo al número <span className="font-mono">{phone}</span>.
          El destinatario debe responder <strong>SI</strong> para activar las alertas y poder
          reportar entregas por WhatsApp.
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Mensaje custom (opcional)</span>
          <textarea className="input" rows={4} maxLength={500}
                    value={custom} onChange={e => setCustom(e.target.value)}
                    placeholder="Si dejás vacío se usa la plantilla por defecto." />
        </label>

        {err && (
          <div className="text-accent-red text-[11px] flex items-center gap-1">
            <AlertCircle size={11} /> {err}
          </div>
        )}
        {result && (
          <div className="flex flex-col gap-1 text-[11px]">
            {result.ok ? (
              <div className="text-accent-green flex items-center gap-1">
                <CheckCircle2 size={11} /> Estado: <strong>{result.status}</strong>
                {result.twilio_sid && <span className="font-mono text-text-muted">· {result.twilio_sid.slice(0, 14)}…</span>}
              </div>
            ) : (
              <div className="text-accent-red flex items-center gap-1">
                <AlertCircle size={11} /> No enviado: {result.error ?? result.status}
              </div>
            )}
            {result.sandbox_warning && (
              <div className="text-accent-yellow text-[10px] mt-1 italic">
                ⚠ {result.sandbox_warning}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 justify-end">
          <button onClick={onClose} className="btn text-[11px]">
            {result?.ok ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result?.ok && (
            <button onClick={() => inviteMut.mutate()}
                    disabled={inviteMut.isPending}
                    className="btn-primary text-[11px] flex items-center gap-1">
              {inviteMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
              Enviar invitación
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
