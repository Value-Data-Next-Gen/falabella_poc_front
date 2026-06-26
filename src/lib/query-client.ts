import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry client errors (401/403/404/422) — they won't succeed on
      // retry; only retry transient server/network failures once.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 1
      },
    },
  },
})
