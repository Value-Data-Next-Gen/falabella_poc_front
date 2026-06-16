import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSimClock, listAlerts, updateAlert, dispatchAlert } from '@/api/sdk.gen'
import type { VisitaOut, AlertOut } from '@/api'
import { useAuthStore } from '@/lib/auth-store'
import { getDelayInfo } from '../lib/eta-utils'
import {
  AlertTriangle,
  Clock as ClockIcon,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  BellOff,
  Send,
} from 'lucide-react'
import { clsx } from 'clsx'

interface Props {
  /** When provided, alerts are pulled live from the backend `/api/v1/alerts` endpoint. */
  diaId?: number
  /** Legacy fallback: classify visitas client-side when `diaId` is not provided. */
  visitas?: VisitaOut[]
}

type Severity = AlertOut['severity']

const SEVERITY_ORDER: Severity[] = ['critica', 'alta', 'media', 'baja']

const SEVERITY_LABEL: Record<Severity, string> = {
  critica: 'Criticas',
  alta: 'Altas',
  media: 'Medias',
  baja: 'Bajas',
}

const SEVERITY_STYLE: Record<Severity, { container: string; icon: string; chip: string }> = {
  critica: {
    container: 'bg-accent-red/10 border-accent-red/40 text-accent-red',
    icon: 'text-accent-red',
    chip: 'bg-accent-red/15 text-accent-red',
  },
  alta: {
    container: 'bg-accent-red/5 border-accent-red/25 text-accent-red',
    icon: 'text-accent-red',
    chip: 'bg-accent-red/10 text-accent-red',
  },
  media: {
    container: 'bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow',
    icon: 'text-accent-yellow',
    chip: 'bg-accent-yellow/15 text-accent-yellow',
  },
  baja: {
    container: 'bg-accent-green/10 border-accent-green/30 text-accent-green',
    icon: 'text-accent-green',
    chip: 'bg-accent-green/15 text-accent-green',
  },
}

const TIPO_LABEL: Record<AlertOut['tipo'], string> = {
  eta_breach: 'ETA breach',
  eta_preview: 'ETA preview',
  vip_deadline: 'VIP deadline',
  manual: 'Manual',
}

export function DelayAlerts({ diaId, visitas }: Props) {
  if (diaId != null) {
    return <BackendAlerts diaId={diaId} />
  }
  if (visitas) {
    return <LegacyAlerts visitas={visitas} />
  }
  return null
}

/* ── Backend-driven (CR-022) ── */

function BackendAlerts({ diaId }: { diaId: number }) {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'falabella_admin'

  const openQ = useQuery({
    queryKey: ['alerts', diaId, 'abierta'],
    queryFn: () => listAlerts({ query: { dia_id: diaId, estado: 'abierta' } }),
    refetchInterval: 30000,
  })
  const notifiedQ = useQuery({
    queryKey: ['alerts', diaId, 'notificada'],
    queryFn: () => listAlerts({ query: { dia_id: diaId, estado: 'notificada' } }),
    refetchInterval: 30000,
  })

  const resolveMut = useMutation({
    mutationFn: (alert_id: number) =>
      updateAlert({ path: { alert_id }, body: { estado: 'resuelta' } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alerts', diaId] })
    },
  })
  const dispatchMut = useMutation({
    mutationFn: (alert_id: number) => dispatchAlert({ path: { alert_id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['alerts', diaId] })
    },
  })

  const alerts: AlertOut[] = useMemo(() => {
    const open = (openQ.data?.data ?? []) as AlertOut[]
    const notif = (notifiedQ.data?.data ?? []) as AlertOut[]
    return [...open, ...notif]
  }, [openQ.data, notifiedQ.data])

  const grouped = useMemo(() => {
    const acc: Record<Severity, AlertOut[]> = { critica: [], alta: [], media: [], baja: [] }
    for (const a of alerts) acc[a.severity].push(a)
    return acc
  }, [alerts])

  const total = alerts.length

  if (openQ.isLoading || notifiedQ.isLoading) {
    return (
      <div className="text-[11px] text-text-muted uppercase tracking-wider mb-4">
        Cargando alertas...
      </div>
    )
  }

  if (openQ.isError || notifiedQ.isError) {
    return (
      <div className="bg-accent-red/10 border border-accent-red/40 rounded-md p-3 mb-4 text-[12px] text-accent-red">
        Error cargando alertas.
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="bg-accent-green/10 border border-accent-green/30 rounded-md p-3 mb-4 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-accent-green" />
        <span className="text-[12px] text-text-primary">Sin alertas activas</span>
      </div>
    )
  }

  return (
    <div className="space-y-2 mb-4">
      {SEVERITY_ORDER.map((sev) => {
        const items = grouped[sev]
        if (items.length === 0) return null
        return (
          <SeverityBanner
            key={sev}
            severity={sev}
            items={items}
            isAdmin={isAdmin}
            onResolve={(id) => resolveMut.mutate(id)}
            onDispatch={(id) => dispatchMut.mutate(id)}
            resolvingId={resolveMut.isPending ? resolveMut.variables : undefined}
            dispatchingId={dispatchMut.isPending ? dispatchMut.variables : undefined}
          />
        )
      })}
    </div>
  )
}

function SeverityBanner({
  severity,
  items,
  isAdmin,
  onResolve,
  onDispatch,
  resolvingId,
  dispatchingId,
}: {
  severity: Severity
  items: AlertOut[]
  isAdmin: boolean
  onResolve: (alert_id: number) => void
  onDispatch: (alert_id: number) => void
  resolvingId: number | undefined
  dispatchingId: number | undefined
}) {
  const [expanded, setExpanded] = useState(severity === 'critica' || severity === 'alta')
  const style = SEVERITY_STYLE[severity]
  const Icon = severity === 'media' || severity === 'baja' ? ClockIcon : AlertTriangle

  return (
    <div className={clsx('border rounded-md', style.container)}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-black/5 transition-colors"
      >
        <Icon className={clsx('w-4 h-4 shrink-0', style.icon)} />
        <span className="text-[12px] font-semibold">
          {items.length} alerta{items.length !== 1 ? 's' : ''} {SEVERITY_LABEL[severity].toLowerCase()}
        </span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronUp className="w-4 h-4 opacity-60" />
          ) : (
            <ChevronDown className="w-4 h-4 opacity-60" />
          )}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-current/20 divide-y divide-current/10">
          {items.map((a) => (
            <AlertRow
              key={a.alert_id}
              alert={a}
              chipClass={style.chip}
              isAdmin={isAdmin}
              onResolve={onResolve}
              onDispatch={onDispatch}
              resolving={resolvingId === a.alert_id}
              dispatching={dispatchingId === a.alert_id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AlertRow({
  alert,
  chipClass,
  isAdmin,
  onResolve,
  onDispatch,
  resolving,
  dispatching,
}: {
  alert: AlertOut
  chipClass: string
  isAdmin: boolean
  onResolve: (alert_id: number) => void
  onDispatch: (alert_id: number) => void
  resolving: boolean
  dispatching: boolean
}) {
  const noRecipients = alert.notified_recipients_count === 0
  return (
    <div className="flex items-start gap-2 px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx('text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5', chipClass)}>
            {TIPO_LABEL[alert.tipo]}
          </span>
          {noRecipients && isAdmin && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-text-muted"
              title="Sin destinatarios opted-in"
            >
              <BellOff className="w-3 h-3" /> sin destinatarios
            </span>
          )}
          {!noRecipients && (
            <span
              className="text-[10px] text-text-muted"
              title="Destinatarios notificados"
            >
              {alert.notified_recipients_count} destinatario
              {alert.notified_recipients_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="text-[12px] text-text-primary mt-0.5 break-words">
          {alert.descripcion}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {noRecipients && isAdmin && (
          <button
            onClick={() => onDispatch(alert.alert_id)}
            disabled={dispatching}
            className="rounded bg-accent-blue/15 px-2 py-1 text-[10px] font-semibold text-accent-blue uppercase tracking-wider hover:bg-accent-blue/25 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
            title="Re-dispatch"
          >
            <Send className="w-3 h-3" /> {dispatching ? '...' : 'Dispatch'}
          </button>
        )}
        <button
          onClick={() => onResolve(alert.alert_id)}
          disabled={resolving}
          className="rounded bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-500 uppercase tracking-wider hover:bg-brand-500/25 disabled:opacity-50 transition-colors"
        >
          {resolving ? '...' : 'Resolver'}
        </button>
      </div>
    </div>
  )
}

/* ── Legacy fallback (pre-CR-022): classify visitas client-side ── */

function LegacyAlerts({ visitas }: { visitas: VisitaOut[] }) {
  const clockQ = useQuery({ queryKey: ['sim-clock'], queryFn: () => getSimClock() })
  const clock = clockQ.data?.data as { sim_now: string } | undefined
  const simNow = clock ? new Date(clock.sim_now) : new Date()

  const stats = useMemo(() => {
    const onTime: VisitaOut[] = []
    const slight: VisitaOut[] = []
    const late: VisitaOut[] = []
    const critical: VisitaOut[] = []
    for (const v of visitas) {
      const info = getDelayInfo(v, simNow)
      if (info.status === 'on-time') onTime.push(v)
      else if (info.status === 'slight-delay') slight.push(v)
      else if (info.status === 'late') late.push(v)
      else if (info.status === 'critical') critical.push(v)
    }
    return { onTime, slight, late, critical }
  }, [visitas, simNow])

  if (stats.critical.length === 0 && stats.late.length === 0 && stats.slight.length === 0) {
    if (stats.onTime.length === 0) return null
    return (
      <div className="bg-accent-green/10 border border-accent-green/30 rounded-md p-3 mb-4 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-accent-green" />
        <span className="text-[12px] text-text-primary">
          <strong>{stats.onTime.length}</strong> visitas en tiempo
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-2 mb-4">
      {stats.critical.length > 0 && (
        <div className="bg-accent-red/10 border border-accent-red/40 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[12px] font-semibold text-accent-red mb-1">
              {stats.critical.length} visita{stats.critical.length !== 1 ? 's' : ''} con atraso critico (&gt;30 min)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.critical.slice(0, 5).map((v) => {
                const info = getDelayInfo(v, simNow)
                return (
                  <span key={v.visita_id} className="text-[10px] bg-accent-red/15 text-accent-red rounded px-1.5 py-0.5">
                    #{v.orden} {v.cliente_nombre.split(' ')[0]} {info.label}
                  </span>
                )
              })}
              {stats.critical.length > 5 && <span className="text-[10px] text-accent-red">+{stats.critical.length - 5}</span>}
            </div>
          </div>
        </div>
      )}

      {stats.late.length > 0 && (
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-md p-3 flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-accent-red" />
          <span className="text-[12px] text-text-primary">
            <strong className="text-accent-red">{stats.late.length}</strong> visitas atrasadas (15-30 min)
          </span>
        </div>
      )}

      {stats.slight.length > 0 && (
        <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-md p-3 flex items-center gap-2">
          <ClockIcon className="w-4 h-4 text-accent-yellow" />
          <span className="text-[12px] text-text-primary">
            <strong className="text-accent-yellow">{stats.slight.length}</strong> visitas con leve atraso (5-15 min)
          </span>
          {stats.onTime.length > 0 && (
            <span className="text-[11px] text-text-muted ml-auto">{stats.onTime.length} en tiempo</span>
          )}
        </div>
      )}
    </div>
  )
}
