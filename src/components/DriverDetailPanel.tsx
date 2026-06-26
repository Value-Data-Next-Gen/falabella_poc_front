import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCapacitaciones, createCapacitacion, deleteCapacitacion } from '@/api/sdk.gen'
import type { DriverOut, CapacitacionOut, CapacitacionCreate } from '@/api'
import { SlidePanel } from './SlidePanel'
import { DocumentsTab } from './DocumentsTab'
import { Badge } from './Badge'
import { FormField, Input, SubmitButton } from './FormField'
import { FileText, GraduationCap, Plus, Trash2, Copy, Check, MessageCircle } from 'lucide-react'
import { clsx } from 'clsx'
import type { FormEvent } from 'react'

type SubTab = 'documentos' | 'capacitaciones'

interface Props {
  driver: DriverOut | null
  onClose: () => void
}

export function DriverDetailPanel({ driver, onClose }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('documentos')
  const [copied, setCopied] = useState(false)

  if (!driver) return null

  const waLink = driver.activation_token
    ? `https://wa.me/56957018982?text=ACTIVAR%20${driver.activation_token}`
    : null

  function copyLink() {
    if (waLink) {
      void navigator.clipboard.writeText(waLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <SlidePanel open onClose={onClose} title={`${driver.nombre} (${driver.driver_id})`}>
      {/* Activation status */}
      <div className="bg-bg-700/50 rounded-md p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">WhatsApp</span>
          <Badge variant={driver.opted_in_at ? 'green' : 'yellow'}>
            {driver.opted_in_at ? 'Activado' : 'Pendiente'}
          </Badge>
        </div>
        {driver.phone_e164 && (
          <div className="text-[13px] text-text-primary mb-1">{driver.phone_e164}</div>
        )}
        {!driver.opted_in_at && waLink && (
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
        {driver.opted_in_at && (
          <div className="text-[11px] text-text-muted mt-1">
            Activado el {new Date(driver.opted_in_at).toLocaleDateString('es-CL')}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-line pb-2">
        {([
          { key: 'documentos' as SubTab, label: 'Documentos', icon: FileText },
          { key: 'capacitaciones' as SubTab, label: 'Capacitaciones', icon: GraduationCap },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors',
              subTab === t.key ? 'bg-brand-500/15 text-brand-500 font-semibold' : 'text-text-muted hover:text-text-primary',
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {subTab === 'documentos' && <DocumentsTab entityType="conductor" entityId={driver.driver_id} />}
      {subTab === 'capacitaciones' && <CapacitacionesSection driverId={driver.driver_id} />}
    </SlidePanel>
  )
}

function CapacitacionesSection({ driverId }: { driverId: string }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data } = useQuery({
    queryKey: ['capacitaciones', driverId],
    queryFn: () => listCapacitaciones({ path: { driver_id: driverId } }),
  })
  const caps = (data?.data ?? []) as CapacitacionOut[]

  const createMut = useMutation({
    mutationFn: (body: CapacitacionCreate) => createCapacitacion({ path: { driver_id: driverId }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['capacitaciones', driverId] }); setShowForm(false) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => deleteCapacitacion({ path: { driver_id: driverId, capacitacion_id: id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['capacitaciones', driverId] }),
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createMut.mutate({
      nombre: fd.get('nombre') as string,
      institucion: (fd.get('institucion') as string) || undefined,
      fecha_realizacion: (fd.get('fecha_realizacion') as string) || undefined,
      fecha_vencimiento: (fd.get('fecha_vencimiento') as string) || undefined,
      horas: fd.get('horas') ? Number(fd.get('horas')) : undefined,
      notes: (fd.get('notes') as string) || undefined,
    })
  }

  const today = new Date().toISOString().split('T')[0]!
  const limite30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]!  // "por vencer" threshold

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">{caps.length} registros</span>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nueva
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => handleSubmit(e)} className="bg-bg-700/50 rounded-md p-3 mb-4 space-y-2">
          <FormField label="Nombre capacitacion"><Input name="nombre" required placeholder="Manejo defensivo" /></FormField>
          <FormField label="Institucion"><Input name="institucion" placeholder="ACHS, mutual, etc." /></FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Fecha realizacion"><Input name="fecha_realizacion" type="date" /></FormField>
            <FormField label="Fecha vencimiento"><Input name="fecha_vencimiento" type="date" /></FormField>
          </div>
          <FormField label="Horas"><Input name="horas" type="number" placeholder="8" /></FormField>
          <FormField label="Notas"><Input name="notes" placeholder="Observaciones" /></FormField>
          <SubmitButton loading={createMut.isPending} />
        </form>
      )}

      {caps.length === 0 && !showForm && (
        <div className="text-center py-8 text-[11px] text-text-muted uppercase tracking-wider">Sin capacitaciones registradas</div>
      )}

      <div className="space-y-2">
        {caps.map((c) => {
          const vencido = c.fecha_vencimiento && c.fecha_vencimiento < today
          const porVencer = c.fecha_vencimiento && !vencido && c.fecha_vencimiento < limite30
          return (
            <div key={c.capacitacion_id} className="bg-bg-800 rounded-md border border-line p-3 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-medium text-text-primary">{c.nombre}</div>
                  {c.institucion && <div className="text-[11px] text-text-secondary">{c.institucion}</div>}
                  <div className="flex gap-3 mt-1.5 text-[11px] text-text-muted">
                    {c.fecha_realizacion && <span>Realizada: {c.fecha_realizacion}</span>}
                    {c.horas && <span>{c.horas}h</span>}
                    {c.fecha_vencimiento && <span>Vence: {c.fecha_vencimiento}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={vencido ? 'red' : porVencer ? 'yellow' : 'green'}>
                    {vencido ? 'Vencida' : porVencer ? 'Por vencer' : 'Vigente'}
                  </Badge>
                  <button onClick={() => delMut.mutate(c.capacitacion_id)} className="p-1 hover:bg-accent-red/10 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-accent-red" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
