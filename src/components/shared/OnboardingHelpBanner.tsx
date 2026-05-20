import { useState } from 'react';
import { Info, X } from 'lucide-react';

const STORAGE_KEY = 'onboardingBannerDismissed_v1';

/** Banner explicativo (azul-info) que cuenta el flow de activación WhatsApp:
 *  copiar link → compartir → la persona lo envía → bot la activa.
 *
 *  Es persistente vía localStorage; el usuario puede ocultarlo y no vuelve.
 *  Si querés resetearlo manualmente: `localStorage.removeItem('onboardingBannerDismissed_v1')`.
 */
export function OnboardingHelpBanner() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; }
    catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="rounded-md border border-accent-blue/40 bg-accent-blue/10 p-3 text-[12px] leading-relaxed">
      <div className="flex items-start gap-2">
        <Info size={14} className="text-accent-blue mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-accent-blue mb-1">
            Cómo activar usuarios nuevos en WhatsApp
          </div>
          <ol className="list-decimal pl-5 text-text-secondary space-y-0.5">
            <li>Creá el usuario abajo (botón <span className="font-semibold">"Nuevo"</span>).</li>
            <li>Copiá el link de activación de la fila (<span className="font-mono">copiar link</span>).</li>
            <li>Envialo a la persona por email, Slack, WhatsApp personal o papel.</li>
            <li>La persona hace click → se abre su WhatsApp con un mensaje listo.</li>
            <li>
              Cuando lo envía, el bot responde <span className="font-semibold">"Cuenta activada"</span> y
              queda habilitada para conversar y recibir alertas.
            </li>
          </ol>
        </div>
        <button
          onClick={dismiss}
          className="text-text-muted hover:text-text-primary shrink-0 flex items-center gap-1 text-[11px]"
          title="Ocultar esta ayuda"
        >
          <X size={12} /> ocultar
        </button>
      </div>
    </div>
  );
}
