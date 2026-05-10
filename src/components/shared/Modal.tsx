import { ReactNode, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTH: Record<NonNullable<ModalProps['width']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

/** Modal genérico. Click backdrop cierra; trackeo mousedown+mouseup para evitar
 *  que cierre cuando el clic origina sobre el trigger fuera y mouseup cae sobre
 *  el backdrop recién montado (bug clásico React 18). */
export function Modal({ title, onClose, children, width = 'md' }: ModalProps) {
  const downOnBackdrop = useRef(false);
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onMouseUp={e => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div className={`bg-bg-800 border border-line rounded-md w-full ${WIDTH[width]} max-h-[90vh] overflow-auto`}>
        <div className="px-4 py-3 border-b border-line flex items-center justify-between sticky top-0 bg-bg-800 z-10">
          <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
