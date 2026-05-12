import { ReactNode, useState } from 'react';
import { Info } from 'lucide-react';

interface Props {
  text: string;
  children?: ReactNode;
  side?: 'top' | 'bottom';
}

/** Tooltip simple (sin libs externas) que aparece al hover del icono (i). */
export function InfoTooltip({ text, children, side = 'bottom' }: Props) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-text-muted hover:text-text-secondary"
        aria-label="Más información"
      >
        <Info size={11} />
      </button>
      {show && (
        <span
          className={`absolute ${side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 z-50 w-64 rounded border border-line bg-bg-800 px-2.5 py-1.5 text-[11px] text-text-secondary shadow-lg pointer-events-none`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
