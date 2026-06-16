interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  loading?: boolean
  /** Label for the confirm button. Defaults to "Desactivar" for backwards compat. */
  confirmLabel?: string
  /** Visual style of the confirm button. Defaults to "danger" (red) for backwards compat. */
  variant?: 'danger' | 'primary'
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  confirmLabel = 'Desactivar',
  variant = 'danger',
}: ConfirmDialogProps) {
  if (!open) return null

  const confirmClasses =
    variant === 'primary'
      ? 'flex-1 rounded bg-brand-500 border border-brand-500 px-3 py-2 text-[12px] font-semibold text-white uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors'
      : 'flex-1 rounded bg-accent-red/15 border border-accent-red/40 px-3 py-2 text-[12px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/25 disabled:opacity-50 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-bg-800 border border-line rounded-md shadow-xl p-5 w-full max-w-sm">
        <h3 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider mb-2">{title}</h3>
        <p className="text-[13px] text-text-secondary mb-5">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={confirmClasses}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
