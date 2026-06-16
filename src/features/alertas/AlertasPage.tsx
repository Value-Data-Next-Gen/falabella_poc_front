import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listAlerts,
  updateAlert,
  createManualAlert,
  dispatchAlert,
  listDias,
  listVisitas,
} from '@/api/sdk.gen'
import type { AlertOut, AlertCreate, DiaOut, VisitaOut } from '@/api'
import { useEmpresas } from '@/lib/use-empresas'
import { useAuthStore } from '@/lib/auth-store'
import { DataTable } from '@/components/DataTable'
import { SlidePanel } from '@/components/SlidePanel'
import { Badge } from '@/components/Badge'
import { FormField, Select, SubmitButton } from '@/components/FormField'
import {
  Bell,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { FormEvent } from 'react'

type Severity = AlertOut['severity']
type Tipo = AlertOut['tipo']
type Estado = AlertOut['estado']

const SEVERITIES: Severity[] = ['critica', 'alta', 'media', 'baja']
const TIPOS: Tipo[] = ['eta_breach', 'eta_preview', 'vip_deadline', 'manual']
const ESTADOS_VISIBLE: Estado[] = ['abierta', 'notificada', 'resuelta', 'descartada']

const SEVERITY_BADGE: Record<Severity, { variant: 'red' | 'yellow' | 'green' | 'gray'; label: string }> = {
  critica: { variant: 'red', label: 'Critica' },
  alta: { variant: 'red', label: 'Alta' },
  media: { variant: 'yellow', label: 'Media' },
  baja: { variant: 'green', label: 'Baja' },
}

const TIPO_BADGE: Record<Tipo, { variant: 'blue' | 'violet' | 'yellow' | 'gray'; label: string }> = {
  eta_breach: { variant: 'blue', label: 'ETA breach' },
  eta_preview: { variant: 'violet', label: 'ETA preview' },
  vip_deadline: { variant: 'yellow', label: 'VIP deadline' },
  manual: { variant: 'gray', label: 'Manual' },
}

const ESTADO_BADGE: Record<Estado, { variant: 'red' | 'yellow' | 'green' | 'gray'; label: string }> = {
  abierta: { variant: 'red', label: 'Abierta' },
  notificada: { variant: 'yellow', label: 'Notificada' },
  resuelta: { variant: 'green', label: 'Resuelta' },
  descartada: { variant: 'gray', label: 'Descartada' },
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Math.floor((Date.now() - then) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

type Panel = { kind: 'closed' } | { kind: 'detail'; alert: AlertOut } | { kind: 'create' }

export function AlertasPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isFalabella = user?.role === 'falabella_admin' || user?.role === 'falabella_ops'
  const isAdmin = user?.role === 'falabella_admin'
  const canCreateManual = isFalabella

  const [empresaFilter, setEmpresaFilter] = useState<string>('')
  const [severityFilter, setSeverityFilter] = useState<Set<Severity>>(new Set())
  const [tipoFilter, setTipoFilter] = useState<Set<Tipo>>(new Set())
  const [estadoMode, setEstadoMode] = useState<'open' | 'all' | Estado>('open')
  const [panel, setPanel] = useState<Panel>({ kind: 'closed' })

  const { data: empresas } = useEmpresas()
  const empresaMap = useMemo(
    () => new Map((empresas ?? []).map((e) => [e.empresa_id, e.nombre])),
    [empresas],
  )

  // The backend takes a single `estado`; for "open" we fetch both `abierta` and `notificada`.
  const queryEstados: Estado[] | null =
    estadoMode === 'open'
      ? ['abierta', 'notificada']
      : estadoMode === 'all'
        ? null
        : [estadoMode]

  const baseQuery = {
    empresa_id: empresaFilter ? Number(empresaFilter) : undefined,
  }

  const openQ = useQuery({
    queryKey: ['alerts-list', 'abierta', baseQuery],
    queryFn: () => listAlerts({ query: { ...baseQuery, estado: 'abierta', limit: 500 } }),
    refetchInterval: 30000,
    enabled: queryEstados?.includes('abierta') ?? false,
  })
  const notifiedQ = useQuery({
    queryKey: ['alerts-list', 'notificada', baseQuery],
    queryFn: () => listAlerts({ query: { ...baseQuery, estado: 'notificada', limit: 500 } }),
    refetchInterval: 30000,
    enabled: queryEstados?.includes('notificada') ?? false,
  })
  const resueltaQ = useQuery({
    queryKey: ['alerts-list', 'resuelta', baseQuery],
    queryFn: () => listAlerts({ query: { ...baseQuery, estado: 'resuelta', limit: 500 } }),
    refetchInterval: 30000,
    enabled: queryEstados?.includes('resuelta') ?? estadoMode === 'all',
  })
  const descartadaQ = useQuery({
    queryKey: ['alerts-list', 'descartada', baseQuery],
    queryFn: () => listAlerts({ query: { ...baseQuery, estado: 'descartada', limit: 500 } }),
    refetchInterval: 30000,
    enabled: queryEstados?.includes('descartada') ?? estadoMode === 'all',
  })

  const allAlerts: AlertOut[] = useMemo(() => {
    const combined: AlertOut[] = []
    if (openQ.data?.data) combined.push(...(openQ.data.data as AlertOut[]))
    if (notifiedQ.data?.data) combined.push(...(notifiedQ.data.data as AlertOut[]))
    if (resueltaQ.data?.data) combined.push(...(resueltaQ.data.data as AlertOut[]))
    if (descartadaQ.data?.data) combined.push(...(descartadaQ.data.data as AlertOut[]))
    // De-dupe by alert_id (shouldn't happen, but defensive).
    const seen = new Set<number>()
    const out: AlertOut[] = []
    for (const a of combined) {
      if (seen.has(a.alert_id)) continue
      seen.add(a.alert_id)
      out.push(a)
    }
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return out
  }, [openQ.data, notifiedQ.data, resueltaQ.data, descartadaQ.data])

  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (severityFilter.size > 0 && !severityFilter.has(a.severity)) return false
      if (tipoFilter.size > 0 && !tipoFilter.has(a.tipo)) return false
      return true
    })
  }, [allAlerts, severityFilter, tipoFilter])

  const isLoading =
    openQ.isLoading || notifiedQ.isLoading || resueltaQ.isLoading || descartadaQ.isLoading
  const isError = openQ.isError || notifiedQ.isError || resueltaQ.isError || descartadaQ.isError

  const invalidateAlerts = () => {
    void qc.invalidateQueries({ queryKey: ['alerts-list'] })
    void qc.invalidateQueries({ queryKey: ['alerts'] })
  }

  const resolveMut = useMutation({
    mutationFn: (alert_id: number) =>
      updateAlert({ path: { alert_id }, body: { estado: 'resuelta' } }),
    onSuccess: () => {
      invalidateAlerts()
      setPanel({ kind: 'closed' })
    },
  })
  const discardMut = useMutation({
    mutationFn: (alert_id: number) =>
      updateAlert({ path: { alert_id }, body: { estado: 'descartada' } }),
    onSuccess: () => {
      invalidateAlerts()
      setPanel({ kind: 'closed' })
    },
  })
  const dispatchMut = useMutation({
    mutationFn: (alert_id: number) => dispatchAlert({ path: { alert_id } }),
    onSuccess: () => {
      invalidateAlerts()
    },
  })
  const createMut = useMutation({
    mutationFn: (body: AlertCreate) => createManualAlert({ body }),
    onSuccess: () => {
      invalidateAlerts()
      setPanel({ kind: 'closed' })
    },
  })

  const toggleInSet = <T,>(set: Set<T>, value: T): Set<T> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-500" />
            <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Alertas
            </h1>
          </div>
          {isFalabella && (
            <select
              value={empresaFilter}
              onChange={(e) => setEmpresaFilter(e.target.value)}
              className="rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider focus:outline-none focus:border-brand-500"
            >
              <option value="">Todas las empresas</option>
              {(empresas ?? []).map((e) => (
                <option key={e.empresa_id} value={e.empresa_id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          )}
          <select
            value={estadoMode}
            onChange={(e) => setEstadoMode(e.target.value as typeof estadoMode)}
            className="rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider focus:outline-none focus:border-brand-500"
          >
            <option value="open">Abiertas + Notificadas</option>
            <option value="all">Todas</option>
            {ESTADOS_VISIBLE.map((s) => (
              <option key={s} value={s}>
                Solo {ESTADO_BADGE[s].label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-text-muted">{filtered.length} registros</span>
        </div>
        {canCreateManual && (
          <button
            onClick={() => setPanel({ kind: 'create' })}
            className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Crear alerta
          </button>
        )}
      </div>

      {/* Chip filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">
            Severity:
          </span>
          {SEVERITIES.map((s) => {
            const active = severityFilter.has(s)
            return (
              <button
                key={s}
                onClick={() => setSeverityFilter((cur) => toggleInSet(cur, s))}
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors',
                  active
                    ? s === 'critica' || s === 'alta'
                      ? 'border-accent-red/40 bg-accent-red/15 text-accent-red'
                      : s === 'media'
                        ? 'border-accent-yellow/40 bg-accent-yellow/15 text-accent-yellow'
                        : 'border-accent-green/40 bg-accent-green/15 text-accent-green'
                    : 'border-line bg-bg-700 text-text-muted hover:text-text-primary',
                )}
              >
                {SEVERITY_BADGE[s].label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">
            Tipo:
          </span>
          {TIPOS.map((t) => {
            const active = tipoFilter.has(t)
            return (
              <button
                key={t}
                onClick={() => setTipoFilter((cur) => toggleInSet(cur, t))}
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors',
                  active
                    ? 'border-brand-500 bg-brand-500/15 text-brand-500'
                    : 'border-line bg-bg-700 text-text-muted hover:text-text-primary',
                )}
              >
                {TIPO_BADGE[t].label}
              </button>
            )
          })}
        </div>
      </div>

      {isError && (
        <div className="mb-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[12px] text-accent-red flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Error cargando alertas.
        </div>
      )}

      {isLoading ? (
        <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
      ) : (
        <DataTable<AlertOut>
          keyFn={(a) => a.alert_id}
          data={filtered}
          emptyMessage="Sin alertas"
          columns={[
            {
              header: 'Severity',
              accessor: (a) => {
                const sb = SEVERITY_BADGE[a.severity]
                return <Badge variant={sb.variant}>{sb.label}</Badge>
              },
              className: 'w-24',
            },
            {
              header: 'Tipo',
              accessor: (a) => {
                const tb = TIPO_BADGE[a.tipo]
                return <Badge variant={tb.variant}>{tb.label}</Badge>
              },
              className: 'w-32',
            },
            {
              header: 'Empresa',
              accessor: (a) => empresaMap.get(a.empresa_id) ?? `Empresa ${a.empresa_id}`,
              className: 'max-w-[160px]',
            },
            {
              header: 'Dia',
              accessor: (a) =>
                a.dia_id ? (
                  <Link
                    to={`/operacion/${a.dia_id}`}
                    className="text-brand-500 hover:text-brand-600 font-mono tabular-nums"
                    onClick={(e) => e.stopPropagation()}
                  >
                    #{a.dia_id}
                  </Link>
                ) : (
                  <span className="text-text-muted">—</span>
                ),
              className: 'w-20',
            },
            {
              header: 'Visita',
              accessor: (a) =>
                a.visita_id ? (
                  <span className="font-mono text-[11px] text-text-secondary tabular-nums">
                    #{a.visita_id}
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                ),
              className: 'w-20',
            },
            {
              header: 'Descripcion',
              accessor: (a) => (
                <button
                  onClick={() => setPanel({ kind: 'detail', alert: a })}
                  className="text-left text-text-primary hover:text-brand-500 line-clamp-2"
                  title={a.descripcion}
                >
                  {a.descripcion}
                </button>
              ),
            },
            {
              header: 'Estado',
              accessor: (a) => {
                const eb = ESTADO_BADGE[a.estado]
                return <Badge variant={eb.variant}>{eb.label}</Badge>
              },
              className: 'w-28',
            },
            {
              header: 'Dest.',
              accessor: (a) => (
                <span
                  className={clsx(
                    'tabular-nums',
                    a.notified_recipients_count === 0 ? 'text-text-muted' : 'text-text-primary',
                  )}
                  title="Destinatarios notificados"
                >
                  {a.notified_recipients_count}
                </span>
              ),
              className: 'text-center w-16',
            },
            {
              header: 'Creada',
              accessor: (a) => (
                <span className="text-text-muted tabular-nums" title={a.created_at}>
                  {timeAgo(a.created_at)}
                </span>
              ),
              className: 'w-20',
            },
            {
              header: '',
              accessor: (a) => (
                <div className="flex gap-1 justify-end">
                  {(a.estado === 'abierta' || a.estado === 'notificada') && (
                    <button
                      onClick={() => resolveMut.mutate(a.alert_id)}
                      disabled={resolveMut.isPending}
                      className="rounded bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-500 uppercase tracking-wider hover:bg-brand-500/25 disabled:opacity-50 transition-colors"
                      title="Resolver"
                    >
                      <CheckCircle className="w-3 h-3" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => dispatchMut.mutate(a.alert_id)}
                      disabled={dispatchMut.isPending}
                      className="rounded bg-accent-blue/15 px-2 py-1 text-[10px] font-semibold text-accent-blue uppercase tracking-wider hover:bg-accent-blue/25 disabled:opacity-50 transition-colors"
                      title="Re-dispatch"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ),
              className: 'w-24',
            },
          ]}
        />
      )}

      {/* Detail panel */}
      {panel.kind === 'detail' && (
        <SlidePanel
          open
          onClose={() => setPanel({ kind: 'closed' })}
          title={`Alerta #${panel.alert.alert_id}`}
        >
          <AlertDetail
            alert={panel.alert}
            empresaName={empresaMap.get(panel.alert.empresa_id) ?? `Empresa ${panel.alert.empresa_id}`}
            isAdmin={isAdmin}
            onResolve={() => resolveMut.mutate(panel.alert.alert_id)}
            onDiscard={() => discardMut.mutate(panel.alert.alert_id)}
            onDispatch={() => dispatchMut.mutate(panel.alert.alert_id)}
            resolveLoading={resolveMut.isPending}
            discardLoading={discardMut.isPending}
            dispatchLoading={dispatchMut.isPending}
            dispatchResult={
              dispatchMut.data?.data &&
              (dispatchMut.data.data as { alert_id: number }).alert_id === panel.alert.alert_id
                ? (dispatchMut.data.data as { recipients: number; sent: number; dry_run: boolean })
                : null
            }
          />
        </SlidePanel>
      )}

      {/* Create manual alert panel */}
      {panel.kind === 'create' && (
        <SlidePanel
          open
          onClose={() => setPanel({ kind: 'closed' })}
          title="Crear alerta manual"
        >
          <CreateAlertForm
            defaultEmpresaId={
              empresaFilter
                ? Number(empresaFilter)
                : user?.empresa_id ?? undefined
            }
            empresas={empresas ?? []}
            isFalabella={isFalabella}
            onSubmit={(body) => createMut.mutate(body)}
            loading={createMut.isPending}
            error={
              createMut.error
                ? typeof createMut.error === 'object' &&
                  createMut.error !== null &&
                  'message' in createMut.error
                  ? String((createMut.error as unknown as Record<string, unknown>).message)
                  : 'No se pudo crear la alerta.'
                : null
            }
          />
        </SlidePanel>
      )}
    </div>
  )
}

/* ── Detail Panel ── */

function AlertDetail({
  alert,
  empresaName,
  isAdmin,
  onResolve,
  onDiscard,
  onDispatch,
  resolveLoading,
  discardLoading,
  dispatchLoading,
  dispatchResult,
}: {
  alert: AlertOut
  empresaName: string
  isAdmin: boolean
  onResolve: () => void
  onDiscard: () => void
  onDispatch: () => void
  resolveLoading: boolean
  discardLoading: boolean
  dispatchLoading: boolean
  dispatchResult: { recipients: number; sent: number; dry_run: boolean } | null
}) {
  const sb = SEVERITY_BADGE[alert.severity]
  const tb = TIPO_BADGE[alert.tipo]
  const eb = ESTADO_BADGE[alert.estado]
  const isOpen = alert.estado === 'abierta' || alert.estado === 'notificada'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={sb.variant}>{sb.label}</Badge>
        <Badge variant={tb.variant}>{tb.label}</Badge>
        <Badge variant={eb.variant}>{eb.label}</Badge>
      </div>

      <div className="bg-bg-700/40 rounded-md p-3">
        <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">
          Descripcion
        </div>
        <div className="text-[13px] text-text-primary whitespace-pre-wrap break-words">
          {alert.descripcion}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-[12px]">
        <Field label="Empresa" value={empresaName} />
        <Field
          label="Dia"
          value={
            alert.dia_id ? (
              <Link to={`/operacion/${alert.dia_id}`} className="text-brand-500 hover:text-brand-600">
                #{alert.dia_id}
              </Link>
            ) : (
              '—'
            )
          }
        />
        <Field label="Ruta" value={alert.ruta_id ? `#${alert.ruta_id}` : '—'} />
        <Field label="Visita" value={alert.visita_id ? `#${alert.visita_id}` : '—'} />
        <Field
          label="Destinatarios"
          value={
            <span
              className={clsx(
                'tabular-nums',
                alert.notified_recipients_count === 0 ? 'text-text-muted' : 'text-text-primary',
              )}
            >
              {alert.notified_recipients_count}
            </span>
          }
        />
        <Field
          label="Creada"
          value={
            <span className="tabular-nums" title={alert.created_at}>
              {new Date(alert.created_at).toLocaleString('es-CL', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          }
        />
        {alert.notified_at && (
          <Field
            label="Notificada"
            value={
              <span className="tabular-nums" title={alert.notified_at}>
                {new Date(alert.notified_at).toLocaleString('es-CL', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            }
          />
        )}
        {alert.resolved_at && (
          <Field
            label="Resuelta"
            value={
              <span className="tabular-nums" title={alert.resolved_at}>
                {new Date(alert.resolved_at).toLocaleString('es-CL', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            }
          />
        )}
        {alert.dedupe_key && (
          <Field
            label="Dedupe key"
            value={
              <code className="text-[10px] text-text-secondary break-all">{alert.dedupe_key}</code>
            }
          />
        )}
      </dl>

      {alert.payload_json && (
        <div>
          <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">
            Payload
          </div>
          <pre className="text-[10px] text-text-secondary bg-bg-700/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {alert.payload_json}
          </pre>
        </div>
      )}

      {dispatchResult && (
        <div className="rounded border border-accent-blue/40 bg-accent-blue/10 px-3 py-2 text-[12px] text-text-primary">
          Dispatch: {dispatchResult.sent}/{dispatchResult.recipients} enviados
          {dispatchResult.dry_run ? ' (dry-run)' : ''}.
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t border-line">
        {isOpen && (
          <>
            <button
              onClick={onResolve}
              disabled={resolveLoading}
              className="flex-1 rounded bg-brand-500 text-white px-3 py-2 text-[12px] font-semibold uppercase tracking-wider hover:bg-brand-600 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {resolveLoading ? 'Resolviendo...' : 'Resolver'}
            </button>
            <button
              onClick={onDiscard}
              disabled={discardLoading}
              className="flex-1 rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              {discardLoading ? 'Descartando...' : 'Descartar'}
            </button>
          </>
        )}
        {isAdmin && (
          <button
            onClick={onDispatch}
            disabled={dispatchLoading}
            className={clsx(
              'rounded bg-accent-blue/15 border border-accent-blue/40 text-accent-blue px-3 py-2 text-[12px] font-semibold uppercase tracking-wider hover:bg-accent-blue/25 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1',
              isOpen ? '' : 'flex-1',
            )}
            title="Re-dispatch"
          >
            <Send className="w-3.5 h-3.5" />
            {dispatchLoading ? 'Enviando...' : 'Dispatch'}
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  )
}

/* ── Create form ── */

function CreateAlertForm({
  defaultEmpresaId,
  empresas,
  isFalabella,
  onSubmit,
  loading,
  error,
}: {
  defaultEmpresaId: number | undefined
  empresas: Array<{ empresa_id: number; nombre: string }>
  isFalabella: boolean
  onSubmit: (body: AlertCreate) => void
  loading: boolean
  error: string | null
}) {
  const [empresaId, setEmpresaId] = useState<number | undefined>(defaultEmpresaId)
  const [severity, setSeverity] = useState<Severity>('media')
  const [diaId, setDiaId] = useState<string>('')
  const [visitaId, setVisitaId] = useState<string>('')
  const [descripcion, setDescripcion] = useState<string>('')
  const [autoDispatch, setAutoDispatch] = useState<boolean>(true)

  // Load días for the selected empresa to populate the optional `dia_id` picker.
  const diasQ = useQuery({
    queryKey: ['dias', empresaId],
    queryFn: () =>
      empresaId
        ? listDias({ query: { empresa_id: empresaId } })
        : listDias({}),
    enabled: empresaId != null,
  })
  const dias = (diasQ.data?.data ?? []) as DiaOut[]

  const visitasQ = useQuery({
    queryKey: ['dia-visitas', diaId ? Number(diaId) : null],
    queryFn: () => listVisitas({ path: { dia_id: Number(diaId) } }),
    enabled: !!diaId,
  })
  const visitas = (visitasQ.data?.data ?? []) as VisitaOut[]

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!empresaId) return
    const desc = descripcion.trim()
    if (!desc) return
    onSubmit({
      empresa_id: empresaId,
      severity,
      dia_id: diaId ? Number(diaId) : null,
      visita_id: visitaId ? Number(visitaId) : null,
      descripcion: desc,
      auto_dispatch: autoDispatch,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      {isFalabella && (
        <FormField label="Empresa">
          <Select
            value={empresaId ?? ''}
            onChange={(e) => {
              const val = e.target.value
              setEmpresaId(val ? Number(val) : undefined)
              setDiaId('')
              setVisitaId('')
            }}
            required
          >
            <option value="">Seleccionar...</option>
            {empresas.map((emp) => (
              <option key={emp.empresa_id} value={emp.empresa_id}>
                {emp.nombre}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Severity">
        <Select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {SEVERITY_BADGE[s].label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Dia (opcional)">
        <Select
          value={diaId}
          onChange={(e) => {
            setDiaId(e.target.value)
            setVisitaId('')
          }}
          disabled={!empresaId}
        >
          <option value="">Sin dia</option>
          {dias.map((d) => (
            <option key={d.dia_id} value={d.dia_id}>
              #{d.dia_id} — {d.fecha} ({d.estado})
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Visita (opcional)">
        <Select value={visitaId} onChange={(e) => setVisitaId(e.target.value)} disabled={!diaId}>
          <option value="">Sin visita</option>
          {visitas.map((v) => (
            <option key={v.visita_id} value={v.visita_id}>
              #{v.visita_id} — {v.cliente_nombre}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Descripcion">
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          required
          rows={3}
          placeholder="Detalle de la alerta..."
          className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
        />
      </FormField>

      <div className="flex items-center gap-2 my-3">
        <input
          type="checkbox"
          id="auto_dispatch"
          checked={autoDispatch}
          onChange={(e) => setAutoDispatch(e.target.checked)}
          className="w-4 h-4 accent-brand-500"
        />
        <label htmlFor="auto_dispatch" className="text-[12px] text-text-primary cursor-pointer">
          Auto-dispatch a WhatsApp inmediatamente
        </label>
      </div>

      <SubmitButton loading={loading} label="Crear" />
      {error && <p className="text-[11px] text-accent-red mt-2">{error}</p>}
    </form>
  )
}
