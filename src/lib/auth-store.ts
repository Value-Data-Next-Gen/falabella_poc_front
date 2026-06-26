import { create } from 'zustand'
import type { UserOut } from '@/api'
import { getMe, login as apiLogin, logout as apiLogout } from '@/api/sdk.gen'

interface AuthState {
  user: UserOut | null
  loading: boolean
  checkAuth: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  checkAuth: async () => {
    try {
      const { data } = await getMe()
      set({ user: data ?? null, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (email: string, password: string) => {
    // throwOnError is enabled globally, so apiLogin rejects with a normalized
    // ApiError on failure (LoginPage reads `err.message`).
    const { data } = await apiLogin({ body: { email, password } })
    if (data && typeof data === 'object' && 'user' in data) {
      set({ user: (data as { user: UserOut }).user })
    }
  },

  logout: async () => {
    // The session may already be gone (expired/401); clear locally regardless.
    try {
      await apiLogout()
    } catch {
      /* ignore — we clear local state below either way */
    }
    set({ user: null })
  },
}))
