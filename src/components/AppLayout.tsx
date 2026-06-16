import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth-store'
import { Sidebar } from './Sidebar'
import { ChatPanel } from '@/features/chat/ChatPanel'

export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg-900">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-bg-900">
      <Sidebar />
      <main className="flex-1 p-5 overflow-auto">
        <Outlet />
      </main>
      <ChatPanel />
    </div>
  )
}
