import { useState } from 'react';
import {
  CheckCircle2, ClipboardCheck, Clock, Copy, MessageCircle, RefreshCw, Sparkles,
} from 'lucide-react';

interface ActivationCellProps {
  /** Token actual (puede ser null si la fila es pre-CR — no se generó token). */
  token: string | null;
  /** Link wa.me completo. Null si no hay token. */
  link: string | null;
  /** ISO timestamp si ya fue usado. */
  usedAt: string | null;
  /** Llama al endpoint GET .../activation-link → backend genera/refresca uno
   *  nuevo y devuelve `{token, link, used_at, is_used}`. El callsite refresca
   *  la lista en su `onSuccess`. */
  onGenerate?: () => Promise<void> | void;
  /** Nombre de la persona (para diálogos / confirmaciones). */
  name?: string;
  /** Variante compacta (para card de contactos). */
  compact?: boolean;
}

/** Celda reutilizable que muestra el estado de activación WhatsApp de una
 *  persona (user/driver/contacto) + acciones de copiar / abrir / regenerar.
 *
 *  Estados:
 *    - usedAt set         → "Activado" (verde, tooltip con fecha)
 *    - token + !usedAt    → "Pendiente" (naranja) + botones copiar/abrir/regenerar
 *    - !token             → "Sin token" (gris) + botón "Generar link"
 */
export function ActivationCell({
  token, link, usedAt, onGenerate, name, compact,
}: ActivationCellProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const tinyBtn = compact ? 'text-[10px]' : 'text-[11px]';

  const doCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback discreto: no rompemos UI
      window.prompt('Copialo a mano:', link);
    }
  };

  const doOpen = () => {
    if (!link) return;
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const doGenerate = async () => {
    if (!onGenerate) return;
    setBusy(true);
    try { await onGenerate(); } finally { setBusy(false); setConfirmRegen(false); }
  };

  // ── Estado: activado ───────────────────────────────────────────────────────
  if (usedAt) {
    const pretty = usedAt.slice(0, 16).replace('T', ' ');
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="pill pill-green flex items-center gap-1"
          title={`Activado el ${pretty}`}
        >
          <CheckCircle2 size={10} /> Activado
        </span>
        <span className="text-[10px] text-text-muted">{pretty}</span>
        {onGenerate && (
          <>
            {!confirmRegen ? (
              <button
                onClick={() => setConfirmRegen(true)}
                className={`${tinyBtn} text-text-muted hover:text-text-primary flex items-center gap-1`}
                title="Generar un nuevo token (el anterior queda invalidado)"
              >
                <RefreshCw size={10} /> regenerar
              </button>
            ) : (
              <span className="flex items-center gap-1">
                <button
                  onClick={doGenerate}
                  disabled={busy}
                  className={`${tinyBtn} text-accent-yellow hover:underline`}
                >
                  {busy ? '...' : 'confirmar'}
                </button>
                <button
                  onClick={() => setConfirmRegen(false)}
                  className={`${tinyBtn} text-text-muted hover:underline`}
                >
                  cancelar
                </button>
              </span>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Estado: pendiente (con token) ─────────────────────────────────────────
  if (token && link) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="pill flex items-center gap-1 bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/40"
          title="El usuario aún no envió el mensaje ACTIVAR por WhatsApp"
        >
          <Clock size={10} /> Pendiente
        </span>
        <button
          onClick={doCopy}
          className={`${tinyBtn} text-accent-blue hover:underline flex items-center gap-1`}
          title={`Copiar link de activación${name ? ` de ${name}` : ''}`}
        >
          {copied ? <ClipboardCheck size={11} /> : <Copy size={11} />}
          {copied ? 'copiado' : 'copiar link'}
        </button>
        <button
          onClick={doOpen}
          className={`${tinyBtn} text-accent-green hover:underline flex items-center gap-1`}
          title="Abrir el link en WhatsApp para previsualizar / compartir"
        >
          <MessageCircle size={11} /> abrir WhatsApp
        </button>
        {onGenerate && (
          <button
            onClick={doGenerate}
            disabled={busy}
            className={`${tinyBtn} text-text-muted hover:text-text-primary flex items-center gap-1`}
            title="Generar nuevo token (invalida el anterior)"
          >
            <RefreshCw size={10} /> {busy ? '...' : 'regenerar'}
          </button>
        )}
      </div>
    );
  }

  // ── Estado: sin token (fila pre-CR) ───────────────────────────────────────
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className="pill bg-bg-700 text-text-secondary border border-line flex items-center gap-1"
        title="Esta persona se creó antes de tener el flow de activación. Generá un link nuevo."
      >
        Sin token
      </span>
      {onGenerate && (
        <button
          onClick={doGenerate}
          disabled={busy}
          className={`${tinyBtn} text-accent-blue hover:underline flex items-center gap-1`}
        >
          <Sparkles size={11} /> {busy ? 'generando...' : 'generar link'}
        </button>
      )}
    </div>
  );
}
