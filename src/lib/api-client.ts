import { client } from '@/api/client.gen'
import { toApiError } from '@/lib/api-error'
import { useAuthStore } from '@/lib/auth-store'

client.setConfig({
  baseUrl: '',
  credentials: 'include',
  // Reject on non-2xx so React Query `isError`/`retry`/error boundaries work.
  // Without this the generated client RESOLVES failed requests as
  // `{ data: undefined, error }`, so every query treated a 500/403 as success.
  throwOnError: true,
})

// Global error handling. This interceptor runs for EVERY non-ok response
// (regardless of throwOnError), so it is the single place to:
//   1. Normalize the raw backend body into a real Error carrying `.detail`/
//      `.status` — consistent for all call sites that read any of those.
//   2. Handle session expiry: a 401 while authenticated clears the session and
//      routes to /login instead of leaving the user on blank, silently-failing
//      screens. We skip this when not authenticated (e.g. the login request
//      itself, or the initial getMe probe) to avoid redirect loops.
client.interceptors.error.use((error, response) => {
  const status = response?.status
  if (status === 401 && useAuthStore.getState().user) {
    useAuthStore.setState({ user: null })
    if (!window.location.hash.startsWith('#/login')) {
      window.location.hash = '#/login'
    }
  }
  return toApiError(error, status)
})

export { client }
