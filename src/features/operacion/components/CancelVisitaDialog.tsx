import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelVisita, listMotivos } from '@/api/sdk.gen'
import type { MotivoOut, VisitaOut } from '@/api'
import { X, Ban } from 'lucide-react'
import { clsx } from 'clsx'

interface CancelVisitaDialogProps {
  visita: VisitaOut | null
  onClose: () => void
  onSuccess?: () => void
}

/**
 * CR-028 Part B — Cancel a single visita using a motivo from the official catalog.
 *
 * Pattern mirrors `CancelPendingDialog` in clientes/ClientesPage.tsx but for a
 * single visita (not bulk). Motivo must be one of `td.motivos` codes; the
 * backend returns 400 otherwise.
 */
export function CancelVisitaDialog({ visita, onClose, onSuccess }: CancelVisitaDialogProps) {
  const qc = useQueryClient()
  const [motivoCodigo, setMotivoCodigo] = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)

  const motivosQ = useQuery({
    queryKey: ['motivos'],
    queryFn: () => listMotivos(),
    enabled: !!visita,
  })
  const motivos = (motivosQ.data?.data ?? []) as MotivoOut[]
  const activeMotivos = motivos.filter((m) => m.activo)

  const cancelMut = useMutation({
    mutationFn: () =>
      cancelVisita({
        path: { visita_id: visita!.visita_id },
        body: {
          motivo_codigo: motivoCodigo,
          comentario: comentario.trim() || null,
        },
      }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error al cancelar la visita.'
        setError(detail)
        return
      }
      if (visita) {
        void qc.invalidateQueries({ queryKey: ['dia-visitas', visita.dia_id] })
        void qc.invalidateQueries({ queryKey: ['dia', visita.dia_id] })
        void qc.invalidateQueries({ queryKey: ['dia-rutas', visita.dia_id] })
      }
      onSuccess?.()
      handleClose()
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Error al cancelar la visita.')
    },
  })

  function handleClose() {
    setMotivoCodigo('')
    setComentario('')
    setError(null)
    onClose()
  }

  function handleConfirm() {
    setError(null)
    if (!motivoCodigo) {
      setError('Debes seleccionar un motivo.')
      return
    }
    if (comentario.length > 500) {
      setError('El comentario no puede superar los 500 caracteres.')
      return
    }
    cancelMut.mutate()
  }

  if (!visita) return null

  const selectedMotivo = activeMotivos.find((m) => m.codigo === motivoCodigo)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-bg-800 border border-line rounded-md shadow-xl p-5 w-full max-w-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[12px] font-semibold text-accent-red uppercase tracking-wider flex items-center gap-1.5">
              <Ban className="w-4 h-4" /> Cancelar visita #{visita.orden}
            </h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Cliente: <span className="text-text-primary">{visita.cliente_nombre}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-bg-700 rounded transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Motivo selector */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Motivo <span className="text-accent-red">*</span>
            </label>
            <select
              value={motivoCodigo}
              onChange={(e) => setMotivoCodigo(e.target.value)}
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-red transition-colors"
              disabled={motivosQ.isLoading}
            >
              <option value="">Seleccionar motivo...</option>
              {activeMotivos.map((m) => (
                <option key={m.motivo_id} value={m.codigo}>
                  {m.codigo}
                </option>
              ))}
            </select>
            {selectedMotivo?.descripcion && (
              <div className="text-[11px] text-text-secondary bg-bg-700/50 rounded p-2 mt-1.5">
                {selectedMotivo.descripcion}
              </div>
            )}
          </div>

          {/* Comentario */}
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Comentario <span className="text-text-muted">(opcional)</span>
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Detalle adicional..."
              rows={3}
              maxLength={500}
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-red transition-colors"
            />
            <div className="text-right text-[10px] text-text-muted tabular-nums mt-0.5">
              {comentario.length}/500
            </div>
          </div>

          {error && (
            <div className="rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleClose}
            disabled={cancelMut.isPending}
            className="flex-1 rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={cancelMut.isPending}
            className={clsx(
              'flex-1 rounded bg-accent-red/15 border border-accent-red/40 px-3 py-2 text-[12px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/25 disabled:opacity-50 transition-colors',
            )}
          >
            {cancelMut.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
          </button>
        </div>
      </div>
    </div>
  )
}
