import { useState } from 'react'
import type { EmpresaContactoOut } from '@/api'
import { SlidePanel } from './SlidePanel'
import { Badge } from './Badge'
import { Copy, Check, MessageCircle } from 'lucide-react'

interface Props {
  contacto: EmpresaContactoOut | null
  onClose: () => void
}

const ROL_LABELS: Record<string, string> = { jefe: 'Jefe', coordinador: 'Coordinador', otro: 'Otro' }

export function ContactoDetailPanel({ contacto, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  if (!contacto) return null

  const waLink = contacto.activation_token
    ? `https://wa.me/56957018982?text=ACTIVAR%20${contacto.activation_token}`
    : null

  function copyLink() {
    if (waLink) {
      void navigator.clipboard.writeText(waLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <SlidePanel open onClose={onClose} title={contacto.nombre}>
      {/* Info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Rol</span>
          <Badge variant={contacto.rol === 'jefe' ? 'blue' : contacto.rol === 'coordinador' ? 'yellow' : 'gray'}>
            {ROL_LABELS[contacto.rol] ?? contacto.rol}
          </Badge>
        </div>
        {contacto.phone_e164 && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Telefono</span>
            <span className="text-[13px] text-text-primary">{contacto.phone_e164}</span>
          </div>
        )}
        {contacto.email && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Email</span>
            <span className="text-[13px] text-text-primary">{contacto.email}</span>
          </div>
        )}
      </div>

      {/* Activation status */}
      <div className="bg-bg-700/50 rounded-md p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">WhatsApp</span>
          <Badge variant={contacto.opted_in_at ? 'green' : 'yellow'}>
            {contacto.opted_in_at ? 'Activado' : 'Pendiente'}
          </Badge>
        </div>

        {!contacto.opted_in_at && waLink && (
          <div className="mt-2">
            <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Link de activacion</div>
            <div className="flex gap-2">
              <input
                readOnly
                value={waLink}
                className="flex-1 rounded border border-line bg-bg-800 px-2 py-1.5 text-[11px] text-text-secondary truncate"
              />
              <button
                onClick={copyLink}
                className="flex items-center gap-1 rounded border border-line px-2 py-1.5 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors"
              >
                {copied ? <><Check className="w-3 h-3 text-accent-green" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
              </button>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-brand-500 hover:text-brand-600 font-semibold uppercase tracking-wider"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Abrir en WhatsApp
            </a>
          </div>
        )}

        {contacto.opted_in_at && (
          <div className="text-[11px] text-text-muted mt-1">
            Activado el {new Date(contacto.opted_in_at).toLocaleDateString('es-CL')}
          </div>
        )}
      </div>
    </SlidePanel>
  )
}
