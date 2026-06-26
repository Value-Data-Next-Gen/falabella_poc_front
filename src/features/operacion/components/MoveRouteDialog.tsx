import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { moveVisitaRoute } from '@/api/sdk.gen'
import type { RutaOut, VisitaOut } from '@/api'
import { X, ArrowRightLeft } from 'lucide-react'
import { clsx } from 'clsx'

interface MoveRouteDialogProps {
  visita: VisitaOut | null
  /** All rutas of the same dia — the current ruta is filtered out from the selector. */
  rutas: RutaOut[]
  onClose: () => void
  onSuccess?: () => void
}

/**
 * CR-028 Part B — Move a visita from its current ruta to another in the same dia.
 *
 * `nuevo_orden` is optional (server appends to tail when omitted). The selector
 * excludes the current ruta to avoid no-ops.
 */
export function MoveRouteDialog({ visita, rutas, onClose, onSuccess }: MoveRouteDialogProps) {
  const qc = useQueryClient()
  const [nuevaRutaId, setNuevaRutaId] = useState<string>('')
  const [nuevoOrden, setNuevoOrden] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const moveMut = useMutation({
    mutationFn: () =>
      moveVisitaRoute({
        path: { visita_id: visita!.visita_id },
        body: {
          nueva_ruta_id: Number(nuevaRutaId),
          nuevo_orden: nuevoOrden ? Number(nuevoOrden) : null,
        },
      }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error al mover la visita.'
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
      setError(err instanceof Error ? err.message : 'Error al mover la visita.')
    },
  })

  function handleClose() {
    setNuevaRutaId('')
    setNuevoOrden('')
    setError(null)
    onClose()
  }

  function handleConfirm() {
    setError(null)
    if (!nuevaRutaId) {
      setError('Debes seleccionar una ruta destino.')
      return
    }
    if (nuevoOrden && (Number(nuevoOrden) < 1 || Number.isNaN(Number(nuevoOrden)))) {
      setError('La posición debe ser un número mayor o igual a 1.')
      return
    }
    moveMut.mutate()
  }

  if (!visita) return null

  // Exclude the current ruta from destinations.
  const targetRutas = rutas.filter((r) => r.ruta_id !== visita.ruta_id)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-bg-800 border border-line rounded-md shadow-xl p-5 w-full max-w-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-brand-500" /> Mover visita #{visita.orden}
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
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Ruta destino <span className="text-accent-red">*</span>
            </label>
            <select
              value={nuevaRutaId}
              onChange={(e) => setNuevaRutaId(e.target.value)}
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
            >
              <option value="">Seleccionar ruta...</option>
              {targetRutas.map((r) => {
                const label = r.folio
                  ? `[${r.folio}${r.subfolio ? ` · ${r.subfolio}` : ''}] ${r.driver_nombre}`
                  : `${r.driver_nombre}${r.vehicle_patente ? ` (${r.vehicle_patente})` : ''}`
                return (
                  <option key={r.ruta_id} value={r.ruta_id}>
                    {label}
                  </option>
                )
              })}
            </select>
            {targetRutas.length === 0 && (
              <div className="text-[11px] text-text-muted mt-1">
                No hay otras rutas en este día.
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Posición en la nueva ruta <span className="text-text-muted">(opcional)</span>
            </label>
            <input
              type="number"
              min={1}
              value={nuevoOrden}
              onChange={(e) => setNuevoOrden(e.target.value)}
              placeholder="Al final"
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary tabular-nums focus:outline-none focus:border-brand-500 transition-colors"
            />
            <div className="text-[10px] text-text-muted mt-0.5">
              Si lo dejás vacío, se agrega al final.
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
            disabled={moveMut.isPending}
            className="flex-1 rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={moveMut.isPending || targetRutas.length === 0}
            className={clsx(
              'flex-1 rounded bg-brand-500 border border-brand-500 px-3 py-2 text-[12px] font-semibold text-white uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors',
            )}
          >
            {moveMut.isPending ? 'Moviendo...' : 'Mover visita'}
          </button>
        </div>
      </div>
    </div>
  )
}
