import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth-store'
import { Radio } from 'lucide-react'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticacion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-900">
      <div className="w-full max-w-xs">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded bg-brand-500 flex items-center justify-center">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Torre de Control
          </h1>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-bg-800 rounded-md shadow-sm border border-line p-5 space-y-4"
        >
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
              placeholder="admin@td.cl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Contrasena
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {error && (
            <div className="text-[12px] text-accent-red bg-accent-red/10 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-500 text-white rounded px-4 py-2 text-[12px] font-semibold uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-[10px] text-text-muted mt-4 uppercase tracking-wider">
          ValueData SpA — Falabella
        </p>
      </div>
    </div>
  )
}
