import { useQuery } from '@tanstack/react-query'
import { listEmpresas, listDrivers, listVehicles } from '@/api/sdk.gen'
import { Building2, Truck, Users, Contact } from 'lucide-react'
import type { ReactNode } from 'react'

function StatCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-bg-800 rounded-md border border-line p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="p-1.5 bg-brand-50 rounded">{icon}</div>
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="text-[11px] text-text-muted mt-1">{sub}</div>}
    </div>
  )
}

export function DashboardPage() {
  const empresas = useQuery({
    queryKey: ['empresas'],
    queryFn: () => listEmpresas(),
  })
  const drivers = useQuery({
    queryKey: ['drivers'],
    queryFn: () => listDrivers(),
  })
  const vehicles = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => listVehicles(),
  })

  const empresaCount = empresas.data?.data?.length ?? 0
  const driverList = drivers.data?.data ?? []
  const driverCount = driverList.length
  const driversOptedIn = driverList.filter((d) => d.opted_in_at).length
  const vehicleCount = vehicles.data?.data?.length ?? 0

  return (
    <div>
      <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Building2 className="w-4 h-4 text-brand-500" />}
          label="Empresas"
          value={empresaCount}
          sub="transportistas activos"
        />
        <StatCard
          icon={<Truck className="w-4 h-4 text-brand-500" />}
          label="Vehiculos"
          value={vehicleCount}
        />
        <StatCard
          icon={<Users className="w-4 h-4 text-brand-500" />}
          label="Conductores"
          value={driverCount}
          sub={`${driversOptedIn} con WhatsApp activo`}
        />
        <StatCard
          icon={<Contact className="w-4 h-4 text-brand-500" />}
          label="Opt-in Rate"
          value={driverCount ? `${Math.round((driversOptedIn / driverCount) * 100)}%` : '—'}
          sub="conductores activados"
        />
      </div>

      {empresas.isLoading && (
        <div className="text-[11px] text-text-muted mt-8 uppercase tracking-wider">Cargando datos...</div>
      )}
    </div>
  )
}
