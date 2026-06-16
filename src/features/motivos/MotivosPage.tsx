import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listMotivos, createMotivo, updateMotivo, deleteMotivo } from '@/api/sdk.gen'
import type { MotivoOut, MotivoCreate, MotivoUpdate } from '@/api'
import { Badge } from '@/components/Badge'
import { SlidePanel } from '@/components/SlidePanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, Input, Select, SubmitButton } from '@/components/FormField'
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import type { FormEvent } from 'react'

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; motivo: MotivoOut }

const SEV_COLORS: Record<string, 'gray' | 'yellow' | 'red' | 'blue'> = {
  low: 'gray', medium: 'yellow', high: 'red', critical: 'red',
}
const SEV_LABELS: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Critica',
}

export function MotivosPage() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })
  const [delTarget, setDelTarget] = useState<MotivoOut | null>(null)

  const { data } = useQuery({ queryKey: ['motivos'], queryFn: () => listMotivos() })
  const motivos = (data?.data ?? []) as MotivoOut[]

  const createMut = useMutation({
    mutationFn: (body: MotivoCreate) => createMotivo({ body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['motivos'] }); setMode({ kind: 'closed' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: MotivoUpdate }) => updateMotivo({ path: { motivo_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['motivos'] }); setMode({ kind: 'closed' }) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => deleteMotivo({ path: { motivo_id: id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['motivos'] }); setDelTarget(null) },
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const codigo = fd.get('codigo') as string
    const descripcion = fd.get('descripcion') as string
    const desambiguacion = (fd.get('desambiguacion') as string) || undefined
    const severity = fd.get('severity') as string
    const alertable = fd.get('alertable') === 'on'
    const orden = fd.get('orden') ? Number(fd.get('orden')) : 0

    if (mode.kind === 'create') {
      createMut.mutate({ codigo, descripcion, desambiguacion, severity, alertable, orden })
    } else if (mode.kind === 'edit') {
      updateMut.mutate({ id: mode.motivo.motivo_id, body: { codigo, descripcion, desambiguacion, severity, alertable, orden } })
    }
  }

  const editing = mode.kind === 'edit' ? mode.motivo : null
  const activos = motivos.filter((m) => m.activo)
  const inactivos = motivos.filter((m) => !m.activo)

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Motivos de No-Entrega</h1>
          <p className="text-[11px] text-text-muted mt-1">{activos.length} activos, {inactivos.length} inactivos — Catalogo oficial Falabella</p>
        </div>
        <button onClick={() => setMode({ kind: 'create' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Nuevo Motivo
        </button>
      </div>

      <div className="space-y-2">
        {activos.map((m) => (
          <div key={m.motivo_id} className="bg-bg-800 rounded-md border border-line p-4 shadow-sm hover:border-brand-300 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-semibold text-text-primary">{m.codigo}</span>
                  <Badge variant={SEV_COLORS[m.severity] ?? 'gray'}>{SEV_LABELS[m.severity] ?? m.severity}</Badge>
                  {m.alertable && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-accent-yellow">
                      <AlertTriangle className="w-3 h-3" /> Alertable
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-text-secondary mb-1">{m.descripcion}</p>
                {m.desambiguacion && (
                  <p className="text-[11px] text-text-muted italic">Regla: {m.desambiguacion}</p>
                )}
              </div>
              <div className="flex gap-1 ml-3">
                <button onClick={() => setMode({ kind: 'edit', motivo: m })} className="p-1.5 hover:bg-bg-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-text-muted" /></button>
                <button onClick={() => setDelTarget(m)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5 text-accent-red" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {inactivos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Inactivos ({inactivos.length})</h2>
          <div className="space-y-1">
            {inactivos.map((m) => (
              <div key={m.motivo_id} className="bg-bg-800/50 rounded-md border border-line/50 p-3 opacity-60">
                <span className="text-[12px] text-text-muted line-through">{m.codigo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SlidePanel open={mode.kind !== 'closed'} onClose={() => setMode({ kind: 'closed' })} title={mode.kind === 'create' ? 'Nuevo Motivo' : 'Editar Motivo'}>
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-1">
          <FormField label="Codigo"><Input name="codigo" required defaultValue={editing?.codigo ?? ''} placeholder="NOMBRE DEL MOTIVO" /></FormField>
          <FormField label="Descripcion"><Input name="descripcion" required defaultValue={editing?.descripcion ?? ''} placeholder="Descripcion clara para el operador" /></FormField>
          <FormField label="Regla de desambiguacion (para IA)"><Input name="desambiguacion" defaultValue={editing?.desambiguacion ?? ''} placeholder="Cuando NO usar este motivo..." /></FormField>
          <FormField label="Severidad">
            <Select name="severity" required defaultValue={editing?.severity ?? 'low'}>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Critica</option>
            </Select>
          </FormField>
          <FormField label="Orden (prioridad visual)"><Input name="orden" type="number" defaultValue={editing?.orden ?? 0} /></FormField>
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" name="alertable" defaultChecked={editing?.alertable ?? false} className="w-4 h-4 accent-brand-500" />
            <label className="text-[12px] text-text-primary">Genera alerta automatica a supervisores</label>
          </div>
          <SubmitButton loading={createMut.isPending || updateMut.isPending} />
        </form>
      </SlidePanel>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => delTarget && delMut.mutate(delTarget.motivo_id)} title="Desactivar Motivo" message={`Se desactivara "${delTarget?.codigo}". El IA dejara de usarlo para clasificaciones.`} loading={delMut.isPending} />
    </div>
  )
}
