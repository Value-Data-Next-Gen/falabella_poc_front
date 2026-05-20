import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, MessageCircle } from 'lucide-react';

interface ActivationSuccessBlockProps {
  link: string | null;
  name: string;
  /** Texto que precede al nombre. Por defecto "creado correctamente". */
  verb?: string;
}

/** Bloque que se renderiza después de POST exitoso (crear user/driver/contacto)
 *  cuando el backend devuelve un `activation_link`. Muestra:
 *    - Confirmación "✓ <name> <verb>"
 *    - Input read-only con el link
 *    - Botones copiar / abrir WhatsApp
 *    - Microtexto explicando qué pasa cuando el usuario lo abre.
 */
export function ActivationSuccessBlock({
  link, name, verb = 'creado correctamente',
}: ActivationSuccessBlockProps) {
  const [copied, setCopied] = useState(false);

  if (!link) {
    return (
      <div className="rounded-md border border-accent-green/40 bg-accent-green/10 p-3">
        <div className="flex items-center gap-2 text-accent-green text-sm font-semibold">
          <CheckCircle2 size={14} /> {name} {verb}
        </div>
        <div className="text-[11px] text-text-muted mt-1">
          No se generó link de activación (la persona no tiene teléfono o el
          backend no lo devolvió). Podés generar uno desde la tabla.
        </div>
      </div>
    );
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copialo a mano:', link);
    }
  };

  const doOpen = () => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="rounded-md border border-accent-green/40 bg-accent-green/10 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-accent-green text-sm font-semibold">
        <CheckCircle2 size={14} /> {name} {verb}
      </div>

      <div className="text-[11px] uppercase tracking-wider text-text-muted mt-1">
        Link de activación (compartir con la persona)
      </div>
      <div className="flex items-center gap-1">
        <input
          readOnly
          value={link}
          onFocus={e => e.currentTarget.select()}
          className="input w-full font-mono text-[11px] !py-1.5"
        />
        <button
          type="button"
          onClick={doCopy}
          className="btn !py-1.5 !px-2 text-[11px] flex items-center gap-1 shrink-0"
          title="Copiar al portapapeles"
        >
          {copied ? <ClipboardCheck size={12} /> : <Copy size={12} />}
          {copied ? 'copiado' : 'copiar'}
        </button>
        <button
          type="button"
          onClick={doOpen}
          className="btn !py-1.5 !px-2 text-[11px] flex items-center gap-1 shrink-0 text-accent-green border-accent-green/40"
          title="Abrir en WhatsApp Web / app"
        >
          <MessageCircle size={12} /> abrir
        </button>
      </div>

      <div className="text-[10px] text-text-muted leading-relaxed">
        Cuando la persona use este link y envíe el mensaje desde su WhatsApp,
        su cuenta queda activada y el bot puede responderle libremente.
      </div>
    </div>
  );
}
