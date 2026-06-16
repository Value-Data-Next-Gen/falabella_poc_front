/**
 * Normalized API error.
 *
 * The generated client throws/returns the raw backend body on failure (usually
 * `{ detail: string }`). We normalize every failure into a real `Error` whose
 * `message` is that detail, while preserving `detail` and `status` — so call
 * sites can read `.message`, `.detail`, or just truthiness and all keep working.
 */
export interface ApiError extends Error {
  detail: string
  status?: number
}

/** Best-effort human-readable message from any thrown/returned API error value. */
export function getApiErrorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  if (!err) return fallback
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    if (typeof o.detail === 'string') return o.detail
    if (typeof o.message === 'string') return o.message
  }
  return fallback
}

/** Wrap a raw error value into a consistent `ApiError`. */
export function toApiError(raw: unknown, status?: number): ApiError {
  const detail = getApiErrorMessage(raw, 'Request failed')
  const e = new Error(detail) as ApiError
  e.detail = detail
  e.status = status
  return e
}
