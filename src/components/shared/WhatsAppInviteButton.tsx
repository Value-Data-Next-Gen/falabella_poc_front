import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { OnboardWhatsAppModal } from './OnboardWhatsAppModal';

interface Props {
  phone: string | null;
  name?: string;
  roleHint?: 'driver' | 'manager' | 'contacto';
  driverId?: string;
  userId?: number;
  contactId?: number;
  size?: 'sm' | 'md';
}

/** Botón "Invitar a WhatsApp" — abre el flow guiado de onboarding (3 steps:
 *  join sandbox → test → resultado). Sirve tanto para personas recién creadas
 *  como para reenviar invitación a alguien existente. */
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
        title={
          disabled
            ? 'Sin teléfono cargado'
            : `Onboarding WhatsApp → ${phone}`
        }
      >
        <MessageCircle size={size === 'sm' ? 10 : 12} />
        invitar
      </button>
      {open && phone && (
        <OnboardWhatsAppModal
          phone={phone}
          name={name ?? '(sin nombre)'}
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
