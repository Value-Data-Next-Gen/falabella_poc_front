import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function SlidePanel({ open, onClose, title, children }: SlidePanelProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-bg-800 border-l border-line shadow-xl flex flex-col animate-[slideIn_150ms_ease-out]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-bg-700 rounded transition-colors">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  )
}
