import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  children: ReactNode
  error?: string
}

export function FormField({ label, children, error }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-[11px] text-accent-red mt-1">{error}</p>}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors ${props.className ?? ''}`}
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors ${props.className ?? ''}`}
    />
  )
}

export function SubmitButton({ loading, label = 'Guardar' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-brand-500 text-white rounded px-4 py-2 text-[12px] font-semibold uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Guardando...' : label}
    </button>
  )
}
