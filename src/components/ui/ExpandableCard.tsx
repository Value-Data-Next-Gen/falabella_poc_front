import { ReactNode, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  titulo: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

export function ExpandableCard({ titulo, meta, defaultOpen = false, children, className }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);
  return (
    <section className={`panel ${className ?? ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-bg-700/30"
      >
        <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {titulo}
        </span>
        {meta && <span className="text-[11px] text-text-muted">{meta}</span>}
      </button>
      {open && <div className="px-4 pb-4 border-t border-line/40">{children}</div>}
    </section>
  );
}
