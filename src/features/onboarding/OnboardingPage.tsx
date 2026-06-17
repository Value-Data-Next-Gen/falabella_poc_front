import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { getOnboarding, updateDriver, updateEmpresaContacto, updateUser } from '@/api/sdk.gen'
import type { OnboardingItem, OnboardingSummary } from '@/api'
import { Badge } from '@/components/Badge'
import { ActivationStatus } from '@/components/ActivationStatus'
import { UserPlus, Copy, Check, ExternalLink, QrCode, Search, X, MessageCircle, Pencil } from 'lucide-react'
import { clsx } from 'clsx'

/** Route a phone update to the right endpoint based on the onboarding item type.
 * Returns void and throws on error so react-query's mutation error state works
 * (the fetch client resolves with {error} instead of rejecting). */
async function savePhone(item: OnboardingItem, phone: string): Promise<void> {
  const body = { phone_e164: phone }
  const res =
    item.tipo === 'conductor'
      ? await updateDriver({ path: { driver_id: item.id }, body })
      : item.tipo === 'contacto'
        ? await updateEmpresaContacto({ path: { empresa_id: item.empresa_id as number, contact_id: Number(item.id) }, body })
        : await updateUser({ path: { user_id: Number(item.id) }, body })
  if (res.error) throw new Error('update failed')
}

const WA_NUMBER = '56957018982'
const waLink = (token: string) => `https://wa.me/${WA_NUMBER}?text=ACTIVAR%20${token}`

const TIPO_LABEL: Record<string, string> = { conductor: 'Conductor', contacto: 'Contacto', usuario: 'Usuario' }

export function OnboardingPage() {
  const [search, setSearch] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [tipo, setTipo] = useState('')
  const [soloPend, setSoloPend] = useState(true)
  const [qrItem, setQrItem] = useState<OnboardingItem | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['onboarding', soloPend],
    queryFn: () => getOnboarding({ query: { solo_pendientes: soloPend } }),
    select: (r) => r.data as OnboardingSummary,
  })

  const empresas = useMemo(
    () => [...new Set((data?.items ?? []).map((i) => i.empresa_nombre).filter(Boolean) as string[])].sort(),
    [data],
  )

  const items = useMemo(() => {
    let xs = data?.items ?? []
    if (empresa) xs = xs.filter((i) => i.empresa_nombre === empresa)
    if (tipo) xs = xs.filter((i) => i.tipo === tipo)
    if (search.trim()) {
      const q = search.toLowerCase()
      xs = xs.filter((i) =>
        (i.nombre ?? '').toLowerCase().includes(q) ||
        (i.phone_e164 ?? '').toLowerCase().includes(q) ||
        (i.empresa_nombre ?? '').toLowerCase().includes(q),
      )
    }
    return xs
  }, [data, empresa, tipo, search])

  const total = data?.total ?? 0
  const activados = data?.activados ?? 0
  const pct = total ? Math.round((activados / total) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <UserPlus className="w-5 h-5 text-brand-400" />
        <h1 className="text-base font-semibold text-text-primary uppercase tracking-wider">Onboarding · Conexión WhatsApp</h1>
      </div>

      {/* How it works */}
      <div className="rounded-md border border-line bg-bg-800 p-3 text-[12px] text-text-secondary">
        <span className="font-semibold text-text-primary">¿Cómo conectar a una persona?</span>{' '}
        Comparte su enlace de invitación (Copiar, Abrir en WhatsApp o el código QR). La persona
        <strong> envía</strong> el mensaje que se abre y queda <strong>activada</strong> al instante.
        Así es ella quien inicia la conversación (requisito de WhatsApp).
      </div>

      {/* Progress */}
      <div className="rounded-md border border-line bg-bg-800 p-4">
        <div className="flex items-center justify-between mb-2 text-[12px]">
          <span className="text-text-muted uppercase tracking-wider">Progreso de activación</span>
          <span className="font-semibold text-text-primary">{activados} de {total} activados ({pct}%)</span>
        </div>
        <div className="h-2.5 rounded-full bg-bg-700 overflow-hidden">
          <div className="h-full bg-accent-green transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] text-text-muted mt-1.5">{data?.pendientes ?? 0} pendientes por conectar</div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nombre, teléfono, empresa…"
            className="w-full rounded border border-line bg-bg-700 pl-8 pr-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500"
          />
        </div>
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)}
          className="rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500">
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}
          className="rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500">
          <option value="">Todos</option>
          <option value="conductor">Conductores</option>
          <option value="contacto">Contactos</option>
          <option value="usuario">Usuarios</option>
        </select>
        <button
          onClick={() => setSoloPend((v) => !v)}
          className={clsx('rounded border px-3 py-2 text-[12px] font-semibold uppercase tracking-wider transition-colors',
            soloPend ? 'bg-brand-500 text-white border-brand-500' : 'bg-bg-700 text-text-muted border-line hover:text-text-primary')}
        >
          Solo pendientes
        </button>
      </div>

      {isLoading && <div className="text-text-muted text-xs uppercase tracking-wider py-12 text-center">Cargando…</div>}
      {isError && <div className="text-accent-red text-[13px] bg-accent-red/10 rounded px-3 py-2">No se pudo cargar el onboarding.</div>}

      {data && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.length === 0 && (
            <div className="col-span-full text-text-muted text-xs uppercase tracking-wider py-12 text-center">
              {soloPend ? '🎉 No hay personas pendientes' : 'Sin resultados'}
            </div>
          )}
          {items.map((it) => (
            <OnboardingCard key={`${it.tipo}-${it.id}`} item={it} onShowQr={() => setQrItem(it)} />
          ))}
        </div>
      )}

      {qrItem && <QrModal item={qrItem} onClose={() => setQrItem(null)} />}
    </div>
  )
}

function OnboardingCard({ item, onShowQr }: { item: OnboardingItem; onShowQr: () => void }) {
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [phone, setPhone] = useState(item.phone_e164 ?? '')
  const link = item.activation_token ? waLink(item.activation_token) : null

  const phoneMut = useMutation({
    mutationFn: (p: string) => savePhone(item, p),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['onboarding'] }); setEditing(false) },
  })

  function copy() {
    if (!link) return
    void navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-md border border-line bg-bg-800 p-3 shadow-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-text-primary truncate">{item.nombre}</div>
          <div className="text-[11px] text-text-muted truncate">
            {TIPO_LABEL[item.tipo] ?? item.tipo}{item.empresa_nombre ? ` · ${item.empresa_nombre}` : ''}
          </div>
        </div>
        <Badge variant={item.tipo === 'conductor' ? 'blue' : item.tipo === 'contacto' ? 'yellow' : 'gray'}>
          {TIPO_LABEL[item.tipo] ?? item.tipo}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-2">
        <ActivationStatus phone={item.phone_e164} activationToken={item.activation_token}
          optedInAt={item.activado ? '1' : null} />
        {!editing && (
          <button onClick={() => { setPhone(item.phone_e164 ?? ''); setEditing(true) }}
            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-muted hover:text-text-primary hover:bg-bg-700"
            title="Editar teléfono">
            <Pencil className="w-3 h-3" /> {item.phone_e164 ? 'Teléfono' : 'Agregar tel.'}
          </button>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-1.5 rounded bg-bg-700/50 p-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+56912345678"
            className="w-full rounded border border-line bg-bg-800 px-2 py-1.5 text-[12px] text-text-primary focus:outline-none focus:border-brand-500"
          />
          {phoneMut.isError && (
            <span className="text-[10px] text-accent-red">No se pudo guardar (¿formato +56…? ¿número duplicado?).</span>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => phoneMut.mutate(phone.trim())}
              disabled={phoneMut.isPending || !phone.trim().startsWith('+')}
              className="flex items-center gap-1 rounded bg-brand-500 text-white px-2 py-1 text-[10px] font-semibold hover:bg-brand-600 disabled:opacity-50">
              <Check className="w-3 h-3" /> {phoneMut.isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-muted hover:text-text-primary">
              <X className="w-3 h-3" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {!item.activado && link && (
        <div className="flex items-center gap-1.5 mt-1">
          <button onClick={copy} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-bg-700">
            {copied ? <><Check className="w-3 h-3 text-accent-green" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
          </button>
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 rounded bg-brand-500 text-white px-2 py-1 text-[10px] font-semibold hover:bg-brand-600">
            <ExternalLink className="w-3 h-3" /> WhatsApp
          </a>
          <button onClick={onShowQr} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-bg-700">
            <QrCode className="w-3 h-3" /> QR
          </button>
        </div>
      )}
      {!item.activado && !link && (
        <div className="text-[10px] text-accent-yellow mt-1">Sin invitación. Edita el registro y agrega teléfono.</div>
      )}
    </div>
  )
}

function QrModal({ item, onClose }: { item: OnboardingItem; onClose: () => void }) {
  const link = item.activation_token ? waLink(item.activation_token) : ''
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-bg-800 border border-line rounded-lg p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-text-primary flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-brand-400" /> Invitar a {item.nombre.split(' ')[0]}
          </span>
          <button onClick={onClose} className="p-1 hover:bg-bg-700 rounded"><X className="w-4 h-4 text-text-muted" /></button>
        </div>
        <p className="text-[12px] text-text-secondary mb-3">
          La persona escanea este código con la cámara de su teléfono; se abre WhatsApp con el mensaje
          de activación listo para enviar.
        </p>
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-md">
            <QRCodeSVG value={link} size={200} level="M" />
          </div>
        </div>
        <div className="text-[10px] text-text-muted text-center mt-3 break-all">{link}</div>
      </div>
    </div>
  )
}
