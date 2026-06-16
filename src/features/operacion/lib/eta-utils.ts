import type { VisitaOut } from '@/api'

export type DelayStatus = 'on-time' | 'slight-delay' | 'late' | 'critical' | 'no-eta' | 'completed'

export interface DelayInfo {
  status: DelayStatus
  deltaMinutes: number
  label: string
  color: string  // tailwind color name
}

export function getDelayInfo(visita: VisitaOut, simNow: Date): DelayInfo {
  if (visita.estado === 'entregado' || visita.estado === 'no_entregado' || visita.estado === 'cancelado') {
    return { status: 'completed', deltaMinutes: 0, label: visita.estado, color: 'gray' }
  }
  if (!visita.eta_estimada) {
    return { status: 'no-eta', deltaMinutes: 0, label: 'Sin ETA', color: 'gray' }
  }
  const eta = new Date(visita.eta_estimada).getTime()
  const now = simNow.getTime()
  const deltaMinutes = Math.round((now - eta) / 60000)

  if (deltaMinutes <= -5) return { status: 'on-time', deltaMinutes, label: `${Math.abs(deltaMinutes)}m anticipo`, color: 'green' }
  if (deltaMinutes <= 5) return { status: 'on-time', deltaMinutes, label: 'A tiempo', color: 'green' }
  if (deltaMinutes <= 15) return { status: 'slight-delay', deltaMinutes, label: `+${deltaMinutes}m`, color: 'yellow' }
  if (deltaMinutes <= 30) return { status: 'late', deltaMinutes, label: `+${deltaMinutes}m`, color: 'red' }
  return { status: 'critical', deltaMinutes, label: `+${deltaMinutes}m`, color: 'red' }
}

export function formatEta(eta: string | null | undefined): string {
  if (!eta) return '—'
  return new Date(eta).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}
