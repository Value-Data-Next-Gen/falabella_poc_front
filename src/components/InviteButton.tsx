import { useState } from 'react'
import { MessageCircle, Copy, Check, ExternalLink, X } from 'lucide-react'

interface Props {
  name: string
  phone?: string | null
  activationToken?: string | null
  optedIn?: boolean
}

export function InviteButton({ name, phone, activationToken, optedIn }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (optedIn) {
    return <span className="text-[10px] text-accent-green">✓</span>
  }

  if (!activationToken) return null

  const waLink = `https://wa.me/56957018982?text=ACTIVAR%20${activationToken}`

  function handleCopy() {
    void navigator.clipboard.writeText(waLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-500 uppercase tracking-wider hover:bg-brand-500/25 transition-colors"
        title={`Invitar a ${name}`}
      >
        <MessageCircle className="w-3 h-3" /> Invitar
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 bg-bg-800 border border-line rounded-md shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-text-primary uppercase tracking-wider">Invitar a {name.split(' ')[0]}</span>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:bg-bg-700 rounded"><X className="w-3 h-3 text-text-muted" /></button>
          </div>

          {!phone && (
            <p className="text-[11px] text-accent-yellow mb-2">Sin telefono registrado. Edite el registro para agregar un numero.</p>
          )}

          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Link de activacion</div>
          <div className="flex gap-1.5 mb-2">
            <input readOnly value={waLink} className="flex-1 rounded border border-line bg-bg-700 px-2 py-1 text-[10px] text-text-secondary truncate" />
            <button onClick={handleCopy} className="rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-bg-700">
              {copied ? <Check className="w-3 h-3 text-accent-green" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full rounded bg-brand-500 text-white py-1.5 text-[10px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Abrir en WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}
