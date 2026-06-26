import { useEffect, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/lib/auth-store'
import '@/lib/api-client'

import { AppLayout } from '@/components/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { EmpresasPage } from '@/features/empresas/EmpresasPage'
import { EmpresaDetailPage } from '@/features/empresas/EmpresaDetailPage'
import { UsersPage } from '@/features/users/UsersPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { MotivosPage } from '@/features/motivos/MotivosPage'
import { DiasListPage } from '@/features/operacion/DiasListPage'
import { ClientesPage } from '@/features/clientes/ClientesPage'
import { AlertasPage } from '@/features/alertas/AlertasPage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { CentroControlPage } from '@/features/operacion/CentroControlPage'

// Code-split the map-heavy routes (deck.gl + maplibre ≈ most of the bundle) so
// they load on demand instead of bloating the initial download.
const MapaOperativoPage = lazy(() =>
  import('@/features/mapa/MapaOperativoPage').then((m) => ({ default: m.MapaOperativoPage })),
)
const DiaDetailPage = lazy(() =>
  import('@/features/operacion/DiaDetailPage').then((m) => ({ default: m.DiaDetailPage })),
)

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}

function AuthInit({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((s) => s.checkAuth)

  useEffect(() => {
    void checkAuth()
  }, [checkAuth])

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInit>
        <HashRouter>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/centro-control" element={<CentroControlPage />} />
              <Route path="/operacion" element={<DiasListPage />} />
              <Route path="/operacion/:diaId" element={<DiaDetailPage />} />
              <Route path="/mapa-operativo" element={<MapaOperativoPage />} />
              <Route path="/alertas" element={<AlertasPage />} />
              <Route path="/reportes" element={<ReportsPage />} />
              <Route path="/empresas" element={<EmpresasPage />} />
              <Route path="/empresas/:empresaId" element={<EmpresaDetailPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />
              <Route path="/maestro/clientes" element={<ClientesPage />} />
              <Route path="/usuarios" element={<UsersPage />} />
              <Route path="/motivos" element={<MotivosPage />} />
              <Route path="/configuracion" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
        </HashRouter>
      </AuthInit>
    </QueryClientProvider>
  )
}
