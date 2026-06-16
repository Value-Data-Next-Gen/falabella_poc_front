import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getDia, getEmpresa, listRutas, listVisitas, listMotivos, createRuta, createVisita,
  updateVisita, transitionDia, listDrivers, listVehicles, getSimClock, updateSimClock,
  reorderVisita, promoteRutaVips, planDiaEtas,
} from '@/api/sdk.gen'
import type {
  DiaOut, RutaOut, VisitaOut, MotivoOut, DriverOut, VehicleOut,
  RutaCreate, VisitaCreate, VisitaUpdate, PlanEtasResult, PlanEtasWarning,
} from '@/api'
import { Badge } from '@/components/Badge'
import { SlidePanel } from '@/components/SlidePanel'
import { DataTable } from '@/components/DataTable'
import { FormField, Input, Select, SubmitButton } from '@/components/FormField'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { getCapabilities, ESTADO_BADGE, VISITA_ESTADO_BADGE } from './lib/dia-state-machine'
import {
  Route, Package, CheckCircle, XCircle, Clock, BarChart3, Plus, Users,
  ChevronDown, ChevronUp, Map as MapIcon, Crown, AlertTriangle, RotateCcw,
  GripVertical, ArrowUp, ArrowDown, X as XIcon, MoreVertical, Calculator,
} from 'lucide-react'
import { MapaTab } from './components/MapaTab'
import { SimClockWidget } from './components/SimClockWidget'
import { DelayAlerts } from './components/DelayAlerts'
import { CancelVisitaDialog } from './components/CancelVisitaDialog'
import { MoveRouteDialog } from './components/MoveRouteDialog'
import { formatEta, getDelayInfo } from './lib/eta-utils'
import { useAuthStore } from '@/lib/auth-store'
import { clsx } from 'clsx'
import type { FormEvent } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Visita estados considered "terminal" (no drag, no reorder, no cancel).
const TERMINAL_ESTADOS = new Set(['entregado', 'no_entregado', 'cancelado'])

// Roles allowed to mutate ops state (cancel, reorder, move, promote VIPs, plan ETAs).
function canManageOperacion(role: string | undefined): boolean {
  if (!role) return false
  return role === 'falabella_admin' || role === 'falabella_ops' || role === 'transport_manager'
}

type Tab = 'rutas' | 'visitas' | 'mapa'
type Panel = { kind: 'closed' } | { kind: 'ruta' } | { kind: 'visita' } | { kind: 'update-visita'; v: VisitaOut }

export function DiaDetailPage() {
  const { diaId } = useParams()
  const id = Number(diaId)
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [tab, setTab] = useState<Tab>('rutas')
  const [panel, setPanel] = useState<Panel>({ kind: 'closed' })
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenedBanner, setReopenedBanner] = useState(false)
  // CR-028 Part B: dialog state for cancel + move-route flows.
  const [cancelTarget, setCancelTarget] = useState<VisitaOut | null>(null)
  const [moveTarget, setMoveTarget] = useState<VisitaOut | null>(null)
  // CR-028 Part B: ref for scrolling to a visita row from the warnings panel.
  const visitaRowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const registerVisitaRow = (visita_id: number, el: HTMLDivElement | null) => {
    if (el) visitaRowRefs.current.set(visita_id, el)
    else visitaRowRefs.current.delete(visita_id)
  }
  const scrollToVisita = (visita_id: number) => {
    const el = visitaRowRefs.current.get(visita_id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-accent-yellow')
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-accent-yellow'), 2000)
    }
  }

  const diaQ = useQuery({ queryKey: ['dia', id], queryFn: () => getDia({ path: { dia_id: id } }) })
  const rutasQ = useQuery({ queryKey: ['dia-rutas', id], queryFn: () => listRutas({ path: { dia_id: id } }) })
  const visitasQ = useQuery({ queryKey: ['dia-visitas', id], queryFn: () => listVisitas({ path: { dia_id: id } }) })
  const motivosQ = useQuery({ queryKey: ['motivos'], queryFn: () => listMotivos() })

  const dia = diaQ.data?.data as DiaOut | undefined
  const rutas = (rutasQ.data?.data ?? []) as RutaOut[]
  const visitas = (visitasQ.data?.data ?? []) as VisitaOut[]
  const motivos = (motivosQ.data?.data ?? []) as MotivoOut[]

  const empresaQ = useQuery({
    queryKey: ['empresa', dia?.empresa_id],
    queryFn: () => getEmpresa({ path: { empresa_id: dia!.empresa_id } }),
    enabled: !!dia,
  })
  const empresaNombre = (empresaQ.data?.data as { nombre: string } | undefined)?.nombre ?? ''

  const driversQ = useQuery({ queryKey: ['drivers'], queryFn: () => listDrivers() })
  const vehiclesQ = useQuery({ queryKey: ['vehicles'], queryFn: () => listVehicles() })
  const allDrivers = (driversQ.data?.data ?? []) as DriverOut[]
  // CR-027: driverMap keyed by driver_id for RutaCard header (WhatsApp opt-in icon).
  // Not filtered by empresa — a ruta references its own driver_id directly.
  const driverMap = new Map(allDrivers.map((d) => [d.driver_id, d]))
  const drivers = allDrivers.filter((d) => d.empresa_id === dia?.empresa_id)
  const vehicles = (vehiclesQ.data?.data ?? []).filter((v: VehicleOut) => v.empresa_id === dia?.empresa_id) as VehicleOut[]

  const transitionMut = useMutation({
    mutationFn: (target: string) => transitionDia({ path: { dia_id: id }, query: { nuevo_estado: target } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['dia', id] }); void qc.invalidateQueries({ queryKey: ['dias'] }) },
  })
  const createRutaMut = useMutation({
    mutationFn: (body: RutaCreate) => createRuta({ path: { dia_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['dia-rutas', id] }); void qc.invalidateQueries({ queryKey: ['dia', id] }); setPanel({ kind: 'closed' }) },
  })
  const createVisitaMut = useMutation({
    mutationFn: (body: VisitaCreate) => createVisita({ path: { dia_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['dia-visitas', id] }); void qc.invalidateQueries({ queryKey: ['dia', id] }); void qc.invalidateQueries({ queryKey: ['dia-rutas', id] }); setPanel({ kind: 'closed' }) },
  })
  const updateVisitaMut = useMutation({
    mutationFn: ({ vid, body }: { vid: number; body: VisitaUpdate }) => updateVisita({ path: { visita_id: vid }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['dia-visitas', id] }); void qc.invalidateQueries({ queryKey: ['dia', id] }); void qc.invalidateQueries({ queryKey: ['dia-rutas', id] }); setPanel({ kind: 'closed' }) },
  })
  const [planWarnings, setPlanWarnings] = useState<PlanEtasWarning[] | null>(null)
  const planEtasMut = useMutation({
    mutationFn: ({ duracion, respetar }: { duracion: number; respetar?: boolean }) =>
      planDiaEtas({
        path: { dia_id: id },
        query: {
          hora_inicio: 9,
          duracion_horas: duracion,
          respetar_reglas_cliente: respetar ?? false,
        },
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['dia-visitas', id] })
      const data = (res as { data?: PlanEtasResult }).data
      if (data?.warnings && data.warnings.length > 0) {
        setPlanWarnings(data.warnings)
      } else {
        setPlanWarnings(null)
      }
    },
  })

  // Sim clock for desync banner (also refetched by SimClockWidget under same key)
  const clockQ = useQuery({
    queryKey: ['sim-clock'],
    queryFn: () => getSimClock(),
    refetchInterval: 5000,
  })
  const clock = clockQ.data?.data as { sim_now: string } | undefined
  const simDate = clock?.sim_now ? new Date(clock.sim_now).toISOString().slice(0, 10) : null
  const diaDate = dia?.fecha ?? null
  const showDesync = !!simDate && !!diaDate && simDate !== diaDate

  const syncClockMut = useMutation({
    mutationFn: () =>
      updateSimClock({
        body: { sim_now: `${diaDate}T09:00:00+00:00`, speed: 1, running: false },
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['sim-clock'] }) },
  })

  const reopenMut = useMutation({
    mutationFn: () => transitionDia({ path: { dia_id: id }, query: { nuevo_estado: 'EN_CURSO' } }),
    onSuccess: () => {
      setReopenOpen(false)
      setReopenedBanner(true)
      void qc.invalidateQueries({ queryKey: ['dia', id] })
      void qc.invalidateQueries({ queryKey: ['dias'] })
    },
  })

  // Auto-dismiss reopened banner after 3s
  useEffect(() => {
    if (!reopenedBanner) return
    const t = window.setTimeout(() => setReopenedBanner(false), 3000)
    return () => window.clearTimeout(t)
  }, [reopenedBanner])

  if (diaQ.isLoading) return <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
  if (!dia) return <div className="text-[11px] text-accent-red">Dia no encontrado</div>

  const caps = getCapabilities(dia.estado)
  const badge = ESTADO_BADGE[dia.estado] ?? ESTADO_BADGE.BORRADOR!
  const total = dia.visitas_count ?? 0
  const entregadas = dia.visitas_entregadas ?? 0
  const noEntregadas = dia.visitas_no_entregadas ?? 0
  const pendientes = total - entregadas - noEntregadas
  const pct = total > 0 ? Math.round(((entregadas + noEntregadas) / total) * 100) : 0

  const tabLabel = tab === 'rutas' ? 'Rutas' : 'Visitas'

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-6">
        <Link to="/operacion" className="text-text-muted hover:text-brand-500 transition-colors">Operacion</Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-secondary">{empresaNombre}</span>
        <span className="text-text-muted">/</span>
        <span className="text-text-secondary">{new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-CL')}</span>
        <span className="text-text-muted">/</span>
        <span className="text-brand-500 font-semibold">{tabLabel}</span>
      </nav>

      {/* Header */}
      <div className="bg-bg-800 rounded-md border border-line p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">{empresaNombre}</h1>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {dia.estado === 'CERRADO' && user?.role === 'falabella_admin' && (
                <button
                  onClick={() => setReopenOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded bg-accent-red/15 border border-accent-red/40 px-2.5 py-1 text-[10px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/25 transition-colors"
                  title="Reabrir el dia"
                >
                  <RotateCcw className="w-3 h-3" /> Reabrir dia
                </button>
              )}
            </div>
            <p className="text-[12px] text-text-secondary">
              {new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {dia.notas && ` — ${dia.notas}`}
            </p>
          </div>
          <div className="flex gap-2">
            {caps.transitions.map((t) => (
              <button
                key={t.target}
                onClick={() => {
                  if (t.confirm && !window.confirm(`${t.confirmMessage} ¿Continuar?`)) return
                  transitionMut.mutate(t.target)
                }}
                disabled={transitionMut.isPending}
                className={clsx(
                  'rounded px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:opacity-50',
                  t.variant === 'green' && 'bg-brand-500 text-white hover:bg-brand-600',
                  t.variant === 'blue' && 'bg-accent-blue text-white hover:bg-accent-blue/80',
                  t.variant === 'red' && 'bg-accent-red/15 text-accent-red border border-accent-red/40 hover:bg-accent-red/25',
                  t.variant === 'gray' && 'border border-line text-text-primary hover:bg-bg-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reopened success banner (auto-dismiss 3s) */}
      {reopenedBanner && (
        <div className="mb-4 rounded border border-accent-green/40 bg-accent-green/15 p-3 text-[12px] text-text-primary">
          Dia reabierto. Ahora esta en EN_CURSO.
        </div>
      )}

      {/* Sim Clock (always visible) + Plan ETAs */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <SimClockWidget diaId={id} diaFecha={dia.fecha} />
        <button
          onClick={() => planEtasMut.mutate({ duracion: 2 })}
          disabled={planEtasMut.isPending}
          className="rounded border border-line px-3 py-2 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors disabled:opacity-50"
          title="Planificar ETAs cada visita (2h shift demo, distribución uniforme)"
        >
          {planEtasMut.isPending ? 'Planificando...' : 'Plan ETAs (2h demo)'}
        </button>
        <button
          onClick={() => planEtasMut.mutate({ duracion: 8 })}
          disabled={planEtasMut.isPending}
          className="rounded border border-line px-3 py-2 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors disabled:opacity-50"
        >
          Plan ETAs (8h real)
        </button>
        <button
          onClick={() => planEtasMut.mutate({ duracion: 8, respetar: true })}
          disabled={planEtasMut.isPending}
          className="inline-flex items-center gap-1.5 rounded border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-[11px] font-semibold text-brand-500 uppercase tracking-wider hover:bg-brand-500/20 transition-colors disabled:opacity-50"
          title="Respeta las ventanas horarias y días de visita del cliente"
        >
          <Calculator className="w-3.5 h-3.5" /> Plan ETAs (reglas cliente)
        </button>
      </div>

      {/* Sim clock desync warning (CR-026) */}
      {showDesync && (
        <div className="mb-4 rounded border border-accent-yellow/40 bg-accent-yellow/15 p-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-accent-yellow shrink-0 mt-0.5" />
          <div className="flex-1 text-[12px] text-text-primary">
            <strong className="font-semibold">Sim clock desincronizado.</strong>{' '}
            Sim clock esta en <span className="font-mono">{simDate}</span> pero este dia es{' '}
            <span className="font-mono">{diaDate}</span>. ETAs y atrasos van a mostrar valores incorrectos.
          </div>
          <button
            onClick={() => syncClockMut.mutate()}
            disabled={syncClockMut.isPending}
            className="rounded bg-accent-yellow/25 border border-accent-yellow/50 px-3 py-1.5 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-accent-yellow/35 transition-colors disabled:opacity-50 shrink-0"
          >
            {syncClockMut.isPending ? 'Sincronizando...' : 'Sincronizar clock a este dia'}
          </button>
        </div>
      )}

      {/* Delay alerts (backend-driven, CR-022) */}
      <DelayAlerts diaId={id} />

      {/* KPI Bar */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { icon: <Package className="w-4 h-4 text-brand-500" />, label: 'Total', value: total },
          { icon: <CheckCircle className="w-4 h-4 text-accent-green" />, label: 'Entregadas', value: entregadas },
          { icon: <XCircle className="w-4 h-4 text-accent-red" />, label: 'No Entregadas', value: noEntregadas },
          { icon: <Clock className="w-4 h-4 text-accent-yellow" />, label: 'Pendientes', value: pendientes },
          { icon: <BarChart3 className="w-4 h-4 text-brand-500" />, label: 'Avance', value: `${pct}%` },
        ].map((s) => (
          <div key={s.label} className="bg-bg-800 rounded-md border border-line p-3 shadow-sm text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">{s.icon}<span className="text-[10px] text-text-muted uppercase tracking-wider">{s.label}</span></div>
            <div className="text-xl font-semibold text-text-primary">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-line mb-6">
        <div className="flex">
          {([
            { key: 'rutas' as Tab, label: 'Rutas', icon: Route, count: rutas.length },
            { key: 'visitas' as Tab, label: 'Visitas', icon: Package, count: visitas.length },
            { key: 'mapa' as Tab, label: 'Mapa', icon: MapIcon, count: visitas.filter((v) => v.lat != null).length },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-[11px] uppercase tracking-wider transition-colors border-b-2 -mb-px',
                tab === t.key ? 'border-brand-500 text-brand-500 font-semibold' : 'border-transparent text-text-muted hover:text-text-primary',
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
              <span className="text-[10px] bg-bg-700 rounded-full px-1.5 py-0.5">{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 pb-2">
          {caps.canCreateRuta && tab === 'rutas' && (
            <button onClick={() => setPanel({ kind: 'ruta' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Ruta
            </button>
          )}
          {caps.canCreateVisita && (
            <button onClick={() => setPanel({ kind: 'visita' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Visita
            </button>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="pb-8">
        {tab === 'rutas' && (
          <RutasView
            rutas={rutas}
            visitas={visitas}
            diaEstado={dia.estado}
            driverMap={driverMap}
            onUpdateVisita={(v) => setPanel({ kind: 'update-visita', v })}
            onCancelVisita={(v) => setCancelTarget(v)}
            onMoveVisita={(v) => setMoveTarget(v)}
            canManage={canManageOperacion(user?.role)}
            registerVisitaRow={registerVisitaRow}
          />
        )}
        {tab === 'visitas' && (
          <VisitasView
            visitas={visitas}
            rutas={rutas}
            diaEstado={dia.estado}
            onUpdateVisita={(v) => setPanel({ kind: 'update-visita', v })}
            onCancelVisita={(v) => setCancelTarget(v)}
          />
        )}
        {tab === 'mapa' && (
          dia.estado === 'CERRADO' ? (
            <div className="bg-bg-800 rounded-md border border-line p-8 text-center">
              <MapIcon className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-[13px] text-text-secondary mb-4">
                Este dia esta cerrado. No hay drivers activos para mostrar.
              </p>
              {user?.role === 'falabella_admin' && (
                <button
                  onClick={() => setReopenOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded bg-accent-red/15 border border-accent-red/40 px-3 py-1.5 text-[11px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/25 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reabrir dia
                </button>
              )}
            </div>
          ) : (
            <MapaTab
              diaId={id}
              fecha={dia.fecha}
              empresaId={dia.empresa_id}
              visitas={visitas}
              rutas={rutas}
              diaEstado={dia.estado}
            />
          )
        )}
      </div>

      {/* Create Ruta Panel */}
      <SlidePanel open={panel.kind === 'ruta'} onClose={() => setPanel({ kind: 'closed' })} title="Nueva Ruta">
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createRutaMut.mutate({ driver_id: fd.get('driver_id') as string, vehicle_id: fd.get('vehicle_id') ? Number(fd.get('vehicle_id')) : undefined }) }} className="space-y-1">
          <FormField label="Conductor">
            <Select name="driver_id" required>
              <option value="">Seleccionar...</option>
              {drivers.map((d) => <option key={d.driver_id} value={d.driver_id}>{d.nombre} ({d.driver_id})</option>)}
            </Select>
          </FormField>
          <FormField label="Vehiculo">
            <Select name="vehicle_id">
              <option value="">Sin vehiculo</option>
              {vehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate} — {v.nombre}</option>)}
            </Select>
          </FormField>
          <SubmitButton loading={createRutaMut.isPending} />
        </form>
      </SlidePanel>

      {/* Create Visita Panel */}
      <SlidePanel open={panel.kind === 'visita'} onClose={() => setPanel({ kind: 'closed' })} title="Nueva Visita">
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createVisitaMut.mutate({ cliente_nombre: fd.get('cliente_nombre') as string, direccion: fd.get('direccion') as string, comuna: (fd.get('comuna') as string) || undefined, cliente_rut: (fd.get('cliente_rut') as string) || undefined, cliente_telefono: (fd.get('cliente_telefono') as string) || undefined, n_bultos: fd.get('n_bultos') ? Number(fd.get('n_bultos')) : 1, referencia: (fd.get('referencia') as string) || undefined, es_vip: fd.get('es_vip') === 'on', ruta_id: fd.get('ruta_id') ? Number(fd.get('ruta_id')) : undefined, notas: (fd.get('notas') as string) || undefined }) }} className="space-y-1">
          <FormField label="Cliente"><Input name="cliente_nombre" required placeholder="Nombre del cliente" /></FormField>
          <FormField label="RUT Cliente"><Input name="cliente_rut" placeholder="12.345.678-9" /></FormField>
          <FormField label="Telefono"><Input name="cliente_telefono" placeholder="+56..." /></FormField>
          <FormField label="Direccion"><Input name="direccion" required placeholder="Av. Providencia 1234" /></FormField>
          <FormField label="Comuna"><Input name="comuna" placeholder="Providencia" /></FormField>
          <FormField label="Bultos"><Input name="n_bultos" type="number" defaultValue="1" /></FormField>
          <FormField label="Referencia"><Input name="referencia" placeholder="OC-2024-001" /></FormField>
          <FormField label="Ruta">
            <Select name="ruta_id">
              <option value="">Sin asignar</option>
              {rutas.map((r) => <option key={r.ruta_id} value={r.ruta_id}>{r.driver_nombre} ({r.vehicle_patente || 'sin vehiculo'})</option>)}
            </Select>
          </FormField>
          <div className="flex items-center gap-2 mb-4">
            <input type="checkbox" name="es_vip" className="w-4 h-4 accent-brand-500" />
            <label className="text-[12px] text-text-primary">VIP (prioridad alta)</label>
          </div>
          <FormField label="Notas"><Input name="notas" /></FormField>
          <SubmitButton loading={createVisitaMut.isPending} />
        </form>
      </SlidePanel>

      {/* Update Visita Panel */}
      {panel.kind === 'update-visita' && (
        <SlidePanel open onClose={() => setPanel({ kind: 'closed' })} title={`Actualizar: ${panel.v.cliente_nombre}`}>
          <UpdateVisitaForm visita={panel.v} motivos={motivos} onSubmit={(body) => updateVisitaMut.mutate({ vid: panel.v.visita_id, body })} loading={updateVisitaMut.isPending} />
        </SlidePanel>
      )}

      {/* Reabrir dia confirm (admin only, only CERRADO) */}
      <ConfirmDialog
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        onConfirm={() => reopenMut.mutate()}
        title="Reabrir dia"
        message={`Reabrir el dia ${dia.fecha}? Las alertas auto-resueltas no se restauran.`}
        loading={reopenMut.isPending}
        confirmLabel="Reabrir dia"
        variant="primary"
      />

      {/* CR-028 Part B — Cancel visita dialog. Keyed by visita_id so state
          resets each time a different visita is targeted. */}
      <CancelVisitaDialog
        key={`cancel-${cancelTarget?.visita_id ?? 'none'}`}
        visita={cancelTarget}
        onClose={() => setCancelTarget(null)}
      />

      {/* CR-028 Part B — Move visita to other ruta dialog */}
      <MoveRouteDialog
        key={`move-${moveTarget?.visita_id ?? 'none'}`}
        visita={moveTarget}
        rutas={rutas}
        onClose={() => setMoveTarget(null)}
      />

      {/* CR-028 Part B — Plan ETAs warnings slide panel */}
      <SlidePanel
        open={!!planWarnings && planWarnings.length > 0}
        onClose={() => setPlanWarnings(null)}
        title={`Conflictos detectados (${planWarnings?.length ?? 0})`}
      >
        <p className="text-[12px] text-text-secondary mb-3">
          Las siguientes visitas no pudieron planificarse según las reglas del cliente.
          Revisá cada una y ajustá manualmente si corresponde.
        </p>
        <div className="space-y-2">
          {planWarnings?.map((w) => {
            const v = visitas.find((vv) => vv.visita_id === w.visita_id)
            return (
              <div
                key={w.visita_id}
                className="rounded border border-accent-yellow/40 bg-accent-yellow/10 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary">
                      Visita #{v?.orden ?? '?'} — {v?.cliente_nombre ?? `ID ${w.visita_id}`}
                    </div>
                    <div className="text-[11px] text-accent-yellow mt-0.5">{w.reason}</div>
                  </div>
                  <button
                    onClick={() => {
                      setPlanWarnings(null)
                      setTab('rutas')
                      window.setTimeout(() => scrollToVisita(w.visita_id), 100)
                    }}
                    className="shrink-0 rounded bg-bg-700 px-2 py-1 text-[10px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-600 transition-colors"
                  >
                    Ver visita
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </SlidePanel>
    </div>
  )
}

/* ── Rutas View ── */

interface RutasViewProps {
  rutas: RutaOut[]
  visitas: VisitaOut[]
  diaEstado: string
  driverMap: Map<string, DriverOut>
  onUpdateVisita: (v: VisitaOut) => void
  onCancelVisita: (v: VisitaOut) => void
  onMoveVisita: (v: VisitaOut) => void
  canManage: boolean
  registerVisitaRow: (visita_id: number, el: HTMLDivElement | null) => void
}

function RutasView({
  rutas,
  visitas,
  diaEstado,
  driverMap,
  onUpdateVisita,
  onCancelVisita,
  onMoveVisita,
  canManage,
  registerVisitaRow,
}: RutasViewProps) {
  const unassigned = visitas.filter((v) => !v.ruta_id)
  const caps = getCapabilities(diaEstado)
  // CR-028 Part B: editing actions (drag/reorder/cancel/move) only when the
  // dia is not CERRADO and the user has the right role.
  const canEdit = canManage && diaEstado !== 'CERRADO'

  return (
    <div className="space-y-4">
      {rutas.map((r) => {
        const rutaVisitas = visitas.filter((v) => v.ruta_id === r.ruta_id)
        return (
          <RutaCard
            key={r.ruta_id}
            ruta={r}
            visitas={rutaVisitas}
            allRutas={rutas}
            driver={driverMap.get(r.driver_id) ?? null}
            canUpdate={caps.canUpdateVisitaStatus}
            canEdit={canEdit}
            onUpdateVisita={onUpdateVisita}
            onCancelVisita={onCancelVisita}
            onMoveVisita={onMoveVisita}
            registerVisitaRow={registerVisitaRow}
          />
        )
      })}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">Sin asignar ({unassigned.length})</h3>
          <VisitasList
            visitas={unassigned}
            allRutas={rutas}
            rutaId={null}
            canUpdate={caps.canUpdateVisitaStatus}
            canEdit={false}
            onUpdateVisita={onUpdateVisita}
            onCancelVisita={onCancelVisita}
            onMoveVisita={onMoveVisita}
            registerVisitaRow={registerVisitaRow}
          />
        </div>
      )}
      {rutas.length === 0 && unassigned.length === 0 && (
        <div className="text-center py-12 text-[11px] text-text-muted uppercase tracking-wider">Sin rutas ni visitas</div>
      )}
    </div>
  )
}

interface RutaCardProps {
  ruta: RutaOut
  visitas: VisitaOut[]
  allRutas: RutaOut[]
  driver: DriverOut | null
  canUpdate: boolean
  canEdit: boolean
  onUpdateVisita: (v: VisitaOut) => void
  onCancelVisita: (v: VisitaOut) => void
  onMoveVisita: (v: VisitaOut) => void
  registerVisitaRow: (visita_id: number, el: HTMLDivElement | null) => void
}

function RutaCard({
  ruta,
  visitas,
  allRutas,
  driver,
  canUpdate,
  canEdit,
  onUpdateVisita,
  onCancelVisita,
  onMoveVisita,
  registerVisitaRow,
}: RutaCardProps) {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(true)
  const total = visitas.length
  const entregadas = visitas.filter((v) => v.estado === 'entregado').length
  const noEntregadas = visitas.filter((v) => v.estado === 'no_entregado').length
  const pendingVips = visitas.filter((v) => v.es_vip && !TERMINAL_ESTADOS.has(v.estado)).length
  const folio = ruta.folio ?? null
  const subfolio = ruta.subfolio ?? null

  const promoteVipsMut = useMutation({
    mutationFn: () => promoteRutaVips({ path: { ruta_id: ruta.ruta_id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dia-visitas', ruta.dia_id] })
      void qc.invalidateQueries({ queryKey: ['dia-rutas', ruta.dia_id] })
    },
  })
  // CR-027 part B: WhatsApp opt-in indicator. Green if driver has opted in
  // (received and accepted the activation link), gray otherwise.
  const optedIn = !!driver?.opted_in_at
  const optInTitle = optedIn ? 'WhatsApp activado: SÍ' : 'WhatsApp activado: NO'
  const optInDot = (
    <span
      title={optInTitle}
      aria-label={optInTitle}
      className={clsx(
        'inline-block w-2 h-2 rounded-full shrink-0',
        optedIn ? 'bg-accent-green' : 'bg-text-muted/60',
      )}
    />
  )

  return (
    <div className="bg-bg-800 rounded-md border border-line shadow-sm overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 hover:bg-bg-700/30 transition-colors">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          aria-expanded={expanded}
        >
          <div className="p-1.5 bg-brand-50 rounded shrink-0"><Users className="w-4 h-4 text-brand-500" /></div>
          <div className="text-left min-w-0">
            {folio ? (
              <>
                <div className="text-[14px] font-semibold font-mono uppercase tabular-nums text-brand-500">
                  [{folio}]{subfolio ? ` · ${subfolio}` : ''}
                </div>
                <div className="text-[11px] text-text-secondary flex items-center gap-1.5 flex-wrap">
                  {optInDot}
                  <span>{ruta.driver_nombre}</span>
                  <span className="text-text-muted">·</span>
                  <span>{ruta.vehicle_patente || 'sin vehiculo'}</span>
                  <span className="text-text-muted">·</span>
                  <span className="tabular-nums">{total} paradas</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-medium text-text-primary flex items-center gap-1.5">
                  {optInDot}
                  <span>{ruta.driver_nombre}</span>
                </div>
                <div className="text-[11px] text-text-muted">{ruta.vehicle_patente ? `${ruta.vehicle_patente}` : 'Sin vehiculo'} — {total} visitas</div>
              </>
            )}
          </div>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          {/* CR-028 Part B — Promote VIPs button (visible only when there are pending VIPs and user can edit). */}
          {canEdit && pendingVips > 0 && (
            <button
              onClick={() => promoteVipsMut.mutate()}
              disabled={promoteVipsMut.isPending}
              className="inline-flex items-center gap-1.5 rounded border border-accent-red/40 bg-accent-red/10 px-2.5 py-1 text-[10px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/20 disabled:opacity-50 transition-colors"
              title="Renumera las visitas pendientes para que los VIPs queden al inicio"
            >
              <Crown className="w-3 h-3" />
              {promoteVipsMut.isPending ? 'Promoviendo...' : `Promover VIPs (${pendingVips})`}
            </button>
          )}
          <div className="flex gap-2 text-[11px]">
            <span className="text-accent-green font-semibold">{entregadas}</span>
            <span className="text-accent-red font-semibold">{noEntregadas}</span>
            <span className="text-text-muted">/ {total}</span>
          </div>
          {total > 0 && (
            <div className="w-20 h-1.5 bg-bg-700 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div className="bg-accent-green h-full" style={{ width: `${(entregadas / total) * 100}%` }} />
                <div className="bg-accent-red h-full" style={{ width: `${(noEntregadas / total) * 100}%` }} />
              </div>
            </div>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-bg-700 rounded"
            aria-label={expanded ? 'Colapsar ruta' : 'Expandir ruta'}
          >
            {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
          </button>
        </div>
      </div>
      {expanded && visitas.length > 0 && (
        <div className="border-t border-line">
          <VisitasList
            visitas={visitas}
            allRutas={allRutas}
            rutaId={ruta.ruta_id}
            canUpdate={canUpdate}
            canEdit={canEdit}
            onUpdateVisita={onUpdateVisita}
            onCancelVisita={onCancelVisita}
            onMoveVisita={onMoveVisita}
            registerVisitaRow={registerVisitaRow}
          />
        </div>
      )}
    </div>
  )
}


interface VisitasListProps {
  visitas: VisitaOut[]
  allRutas: RutaOut[]
  /** null when this list is the "unassigned" bucket (no ruta_id) — reorder disabled. */
  rutaId: number | null
  canUpdate: boolean
  canEdit: boolean
  onUpdateVisita: (v: VisitaOut) => void
  onCancelVisita: (v: VisitaOut) => void
  onMoveVisita: (v: VisitaOut) => void
  registerVisitaRow: (visita_id: number, el: HTMLDivElement | null) => void
}

/**
 * CR-028 Part B — Sortable list of visitas within a ruta.
 *
 * Drag/reorder + arrow buttons are only active when `canEdit && rutaId != null`
 * (the unassigned bucket does NOT support reorder — visitas there have no `orden`
 * within a ruta yet). Terminal visitas (entregado/no_entregado/cancelado) are
 * always rendered read-only — no drag handle, no arrows, no cancel.
 */
function VisitasList({
  visitas,
  allRutas,
  rutaId,
  canUpdate,
  canEdit,
  onUpdateVisita,
  onCancelVisita,
  onMoveVisita,
  registerVisitaRow,
}: VisitasListProps) {
  const qc = useQueryClient()
  // Local optimistic snapshot of orden order. We re-sync on every render so the
  // server is the source of truth; the snapshot is only used during the brief
  // window between drop and refetch to avoid a UI flash.
  const [optimisticOrder, setOptimisticOrder] = useState<number[] | null>(null)

  const reorderMut = useMutation({
    mutationFn: ({ visita_id, nuevo_orden }: { visita_id: number; nuevo_orden: number }) =>
      reorderVisita({ path: { visita_id }, body: { nuevo_orden } }),
    onSettled: (_data, _err, vars) => {
      // Invalidate visitas + rutas of this dia. We don't know dia_id from the
      // mutation vars alone, so we invalidate by partial key match below.
      const target = visitas.find((v) => v.visita_id === vars?.visita_id)
      if (target) {
        void qc.invalidateQueries({ queryKey: ['dia-visitas', target.dia_id] })
        void qc.invalidateQueries({ queryKey: ['dia-rutas', target.dia_id] })
      }
      setOptimisticOrder(null)
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Sort visitas by orden, applying optimistic order if present.
  const sortedVisitas = (() => {
    const sorted = [...visitas].sort((a, b) => a.orden - b.orden)
    if (!optimisticOrder) return sorted
    const map = new Map(sorted.map((v) => [v.visita_id, v]))
    const reordered: VisitaOut[] = []
    optimisticOrder.forEach((vid) => {
      const v = map.get(vid)
      if (v) reordered.push(v)
    })
    return reordered.length === sorted.length ? reordered : sorted
  })()

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (!canEdit || rutaId == null) return

    const activeIdx = sortedVisitas.findIndex((v) => v.visita_id === active.id)
    const overIdx = sortedVisitas.findIndex((v) => v.visita_id === over.id)
    if (activeIdx < 0 || overIdx < 0) return

    const moved = sortedVisitas[activeIdx]
    const target = sortedVisitas[overIdx]
    if (!moved || !target) return
    // Don't allow drag of terminal visitas (defensive — they don't render a handle).
    if (TERMINAL_ESTADOS.has(moved.estado)) return

    // Optimistic snapshot.
    const newOrder = arrayMove(sortedVisitas, activeIdx, overIdx).map((v) => v.visita_id)
    setOptimisticOrder(newOrder)

    reorderMut.mutate({ visita_id: moved.visita_id, nuevo_orden: target.orden })
  }

  function handleArrow(v: VisitaOut, direction: 'up' | 'down') {
    if (!canEdit || rutaId == null) return
    const nuevo_orden = direction === 'up' ? v.orden - 1 : v.orden + 1
    if (nuevo_orden < 1) return
    reorderMut.mutate({ visita_id: v.visita_id, nuevo_orden })
  }

  // Reorder is only allowed when editing AND we have a real rutaId.
  const allowReorder = canEdit && rutaId != null

  if (!allowReorder) {
    // No DndContext — just render the rows.
    return (
      <div className="divide-y divide-line/50">
        {sortedVisitas.map((v) => (
          <VisitaRow
            key={v.visita_id}
            v={v}
            canUpdate={canUpdate}
            canEdit={false}
            allRutas={allRutas}
            onUpdateVisita={onUpdateVisita}
            onCancelVisita={onCancelVisita}
            onMoveVisita={onMoveVisita}
            onArrow={handleArrow}
            sortable={null}
            registerVisitaRow={registerVisitaRow}
          />
        ))}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={sortedVisitas.map((v) => v.visita_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="divide-y divide-line/50">
          {sortedVisitas.map((v) => (
            <SortableVisitaRow
              key={v.visita_id}
              v={v}
              canUpdate={canUpdate}
              canEdit={canEdit}
              allRutas={allRutas}
              onUpdateVisita={onUpdateVisita}
              onCancelVisita={onCancelVisita}
              onMoveVisita={onMoveVisita}
              onArrow={handleArrow}
              registerVisitaRow={registerVisitaRow}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/** Sortable wrapper that hooks up @dnd-kit and passes listeners/transform down. */
function SortableVisitaRow(
  props: Omit<VisitaRowProps, 'sortable'>,
) {
  const { v } = props
  const isTerminal = TERMINAL_ESTADOS.has(v.estado)
  const sortable = useSortable({ id: v.visita_id, disabled: isTerminal })
  return <VisitaRow {...props} sortable={sortable} />
}

interface VisitaRowProps {
  v: VisitaOut
  canUpdate: boolean
  canEdit: boolean
  allRutas: RutaOut[]
  onUpdateVisita: (v: VisitaOut) => void
  onCancelVisita: (v: VisitaOut) => void
  onMoveVisita: (v: VisitaOut) => void
  onArrow: (v: VisitaOut, direction: 'up' | 'down') => void
  /** null when not inside a SortableContext (unassigned bucket). */
  sortable: ReturnType<typeof useSortable> | null
  registerVisitaRow: (visita_id: number, el: HTMLDivElement | null) => void
}

function VisitaRow({
  v,
  canUpdate,
  canEdit,
  allRutas,
  onUpdateVisita,
  onCancelVisita,
  onMoveVisita,
  onArrow,
  sortable,
  registerVisitaRow,
}: VisitaRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const sb = VISITA_ESTADO_BADGE[v.estado] ?? VISITA_ESTADO_BADGE.pendiente!
  const folioCliente = v.folio_cliente ?? null
  const subfolio = v.subfolio_bulto ?? null
  const folioDisplay = folioCliente
    ? subfolio
      ? `${folioCliente}/${subfolio}`
      : folioCliente
    : null
  const clienteId = v.cliente_id ?? null
  const isTerminal = TERMINAL_ESTADOS.has(v.estado)
  const canRowEdit = canEdit && !isTerminal

  // Dnd-kit transform + transition.
  const style = sortable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1,
      }
    : undefined

  // Has at least one other ruta? Move action makes no sense otherwise.
  const hasOtherRutas = allRutas.some((r) => r.ruta_id !== v.ruta_id)

  return (
    <div
      ref={(el) => {
        if (sortable) sortable.setNodeRef(el)
        registerVisitaRow(v.visita_id, el)
      }}
      style={style}
      className={clsx(
        'flex items-center justify-between px-4 py-2.5 transition-colors',
        v.es_vip
          ? 'bg-accent-red/10 hover:bg-accent-red/15 border-l-2 border-accent-red'
          : 'hover:bg-bg-700/30',
        sortable?.isDragging && 'shadow-lg',
      )}
    >
      {/* Drag handle + arrows */}
      {canRowEdit && (
        <div className="flex items-center shrink-0 mr-2 gap-0.5">
          <button
            ref={sortable ? (node) => { if (node && sortable) sortable.setActivatorNodeRef(node) } : undefined}
            {...(sortable?.attributes ?? {})}
            {...(sortable?.listeners ?? {})}
            className="p-1 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary"
            title="Arrastrar para reordenar"
            aria-label="Arrastrar visita"
            type="button"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onArrow(v, 'up')}
            className="p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30"
            title="Subir una posición"
            aria-label="Subir visita"
            type="button"
            disabled={v.orden <= 1}
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onClick={() => onArrow(v, 'down')}
            className="p-0.5 text-text-muted hover:text-text-primary"
            title="Bajar una posición"
            aria-label="Bajar visita"
            type="button"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="tabular-nums text-[11px] text-text-muted">#{v.orden}</span>
          {folioDisplay && (
            <span
              className="font-mono text-[11px] text-text-secondary tabular-nums"
              title="Folio cliente / subfolio bulto"
            >
              {folioDisplay}
            </span>
          )}
          {v.es_vip && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent-red/25 text-accent-red border border-accent-red/40">
              <Crown className="w-3 h-3" /> VIP
            </span>
          )}
          {clienteId != null ? (
            <Link
              to={`/maestro/clientes?focus=${clienteId}`}
              className="text-[13px] font-medium text-brand-500 hover:underline truncate"
              title="Abrir ficha del cliente en el maestro"
            >
              {v.cliente_nombre}
            </Link>
          ) : (
            <span className="text-[13px] font-medium text-text-primary truncate">{v.cliente_nombre}</span>
          )}
        </div>
        <div className="text-[11px] text-text-muted truncate">{v.direccion}{v.comuna ? `, ${v.comuna}` : ''}</div>
        {v.motivo && <div className="text-[10px] text-accent-red mt-0.5">{v.motivo}{v.motivo_comentario ? `: ${v.motivo_comentario}` : ''}</div>}
      </div>

      <div className="flex items-center gap-2 ml-3 shrink-0">
        {v.eta_estimada && (
          <span className="text-[11px] text-text-muted tabular-nums" title="ETA estimada">
            {formatEta(v.eta_estimada)}
          </span>
        )}
        <Badge variant={sb.variant}>{sb.label}</Badge>
        {canUpdate && v.estado === 'pendiente' && (
          <button onClick={() => onUpdateVisita(v)} className="rounded bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-500 uppercase tracking-wider hover:bg-brand-500/25 transition-colors">
            Actualizar
          </button>
        )}
        {canRowEdit && (
          <>
            <button
              onClick={() => onCancelVisita(v)}
              className="p-1 rounded text-accent-red hover:bg-accent-red/15 transition-colors"
              title="Cancelar visita"
              aria-label="Cancelar visita"
              type="button"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded text-text-muted hover:bg-bg-700 hover:text-text-primary transition-colors"
                title="Más acciones"
                aria-label="Más acciones"
                type="button"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md border border-line bg-bg-800 shadow-lg py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      onMoveVisita(v)
                    }}
                    disabled={!hasOtherRutas}
                    className="w-full text-left px-3 py-2 text-[12px] text-text-primary hover:bg-bg-700 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  >
                    Mover a otra ruta
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Visitas Flat View ── */

interface VisitasViewProps {
  visitas: VisitaOut[]
  rutas: RutaOut[]
  diaEstado: string
  onUpdateVisita: (v: VisitaOut) => void
  onCancelVisita: (v: VisitaOut) => void
}

function VisitasView({ visitas, rutas, diaEstado, onUpdateVisita, onCancelVisita }: VisitasViewProps) {
  const [estadoFilter, setEstadoFilter] = useState('')
  const [onlyVips, setOnlyVips] = useState(false)
  const caps = getCapabilities(diaEstado)
  const rutaMap = new Map(rutas.map((r) => [r.ruta_id, r.driver_nombre]))
  const clockQ = useQuery({ queryKey: ['sim-clock'], queryFn: () => getSimClock() })
  const simNow = clockQ.data?.data?.sim_now ? new Date(clockQ.data.data.sim_now as string) : new Date()

  // Default sort: ascending by orden (matches RutaCard expanded view).
  const sortedVisitas = [...visitas].sort((a, b) => a.orden - b.orden)
  const filtered = sortedVisitas.filter((v) => {
    if (estadoFilter && v.estado !== estadoFilter) return false
    if (onlyVips && !v.es_vip) return false
    return true
  })
  const canEdit = diaEstado !== 'CERRADO'

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider">
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="en_camino">En Camino</option>
          <option value="entregado">Entregado</option>
          <option value="no_entregado">No Entregado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        {/* CR-028 Part B — Solo VIPs filter chip. */}
        <button
          type="button"
          onClick={() => setOnlyVips((s) => !s)}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
            onlyVips
              ? 'border-accent-red/50 bg-accent-red/15 text-accent-red'
              : 'border-line bg-bg-700 text-text-muted hover:text-text-primary',
          )}
          aria-pressed={onlyVips}
        >
          <Crown className="w-3 h-3" /> Solo VIPs
        </button>
      </div>
      <DataTable<VisitaOut>
        keyFn={(v) => v.visita_id}
        data={filtered}
        emptyMessage="Sin visitas"
        rowClassName={(v) => (v.es_vip ? 'bg-accent-red/10 hover:bg-accent-red/15' : undefined)}
        columns={[
          {
            header: 'Cliente',
            accessor: (v) => (
              <div className="flex items-center gap-2">
                {v.cliente_id != null ? (
                  <Link
                    to={`/maestro/clientes?focus=${v.cliente_id}`}
                    className="font-medium text-brand-500 hover:underline"
                    title="Abrir ficha del cliente en el maestro"
                  >
                    {v.cliente_nombre}
                  </Link>
                ) : (
                  <span className="font-medium">{v.cliente_nombre}</span>
                )}
                {v.es_vip && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent-red/25 text-accent-red border border-accent-red/40">
                    <Crown className="w-3 h-3" /> VIP
                  </span>
                )}
              </div>
            ),
            className: 'max-w-[200px]',
          },
          { header: 'Folio', accessor: (v) => v.folio_cliente
            ? (
              <span className="font-mono text-[11px] text-text-secondary tabular-nums">
                {v.folio_cliente}{v.subfolio_bulto ? `/${v.subfolio_bulto}` : ''}
              </span>
            )
            : '—', className: 'w-28' },
          { header: 'Direccion', accessor: (v) => <span className="text-text-secondary truncate">{v.direccion}</span> },
          { header: 'Comuna', accessor: (v) => v.comuna ?? '—' },
          { header: 'Ruta', accessor: (v) => v.ruta_id ? rutaMap.get(v.ruta_id) ?? '—' : <span className="text-text-muted">Sin asignar</span> },
          { header: 'Bultos', accessor: (v) => v.n_bultos, className: 'text-center w-16' },
          { header: 'ETA', accessor: (v) => <span className="text-text-secondary tabular-nums">{formatEta(v.eta_estimada)}</span>, className: 'text-center w-20' },
          ...(diaEstado === 'CERRADO' ? [] : [{
            header: 'Atraso' as string,
            accessor: (v: VisitaOut) => {
              const info = getDelayInfo(v, simNow)
              if (info.status === 'no-eta' || info.status === 'completed') return <span className="text-text-muted">—</span>
              const variant = info.color === 'green' ? 'green' as const : info.color === 'yellow' ? 'yellow' as const : 'red' as const
              return <Badge variant={variant}>{info.label}</Badge>
            },
            className: 'text-center w-24' as string,
          }]),
          { header: 'Estado', accessor: (v) => { const sb = VISITA_ESTADO_BADGE[v.estado] ?? VISITA_ESTADO_BADGE.pendiente!; return <Badge variant={sb.variant}>{sb.label}</Badge> } },
          { header: 'Motivo', accessor: (v) => v.motivo ? <span className="text-[11px] text-accent-red">{v.motivo}</span> : '—' },
          ...(caps.canUpdateVisitaStatus ? [{
            header: '' as string,
            accessor: (v: VisitaOut) => v.estado === 'pendiente' ? (
              <button onClick={() => onUpdateVisita(v)} className="rounded bg-brand-500/15 px-2 py-1 text-[10px] font-semibold text-brand-500 uppercase tracking-wider hover:bg-brand-500/25">Actualizar</button>
            ) : null,
            className: 'w-24' as string,
          }] : []),
          // CR-028 Part B — Inline cancel action. Hidden for terminal visitas.
          ...(canEdit ? [{
            header: '' as string,
            accessor: (v: VisitaOut) => TERMINAL_ESTADOS.has(v.estado) ? null : (
              <button
                onClick={() => onCancelVisita(v)}
                className="p-1 rounded text-accent-red hover:bg-accent-red/15 transition-colors"
                title="Cancelar visita"
                aria-label="Cancelar visita"
                type="button"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            ),
            className: 'w-10 text-center' as string,
          }] : []),
        ]}
      />
    </div>
  )
}

/* ── Update Visita Form ── */

function UpdateVisitaForm({ visita, motivos, onSubmit, loading }: { visita: VisitaOut; motivos: MotivoOut[]; onSubmit: (body: VisitaUpdate) => void; loading: boolean }) {
  const [estado, setEstado] = useState(visita.estado)
  const [motivo, setMotivo] = useState(visita.motivo ?? '')
  const [comentario, setComentario] = useState(visita.motivo_comentario ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const body: VisitaUpdate = { estado }
    if (estado === 'no_entregado') {
      body.motivo = motivo
      body.motivo_comentario = comentario || undefined
    }
    onSubmit(body)
  }

  const activeMotivos = motivos.filter((m) => m.activo)

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="bg-bg-700/50 rounded-md p-3 mb-2">
        <div className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Visita</div>
        <div className="text-[13px] font-medium text-text-primary">{visita.cliente_nombre}</div>
        <div className="text-[11px] text-text-secondary">{visita.direccion}</div>
      </div>

      <FormField label="Estado">
        <Select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="pendiente">Pendiente</option>
          <option value="en_camino">En Camino</option>
          <option value="entregado">Entregado</option>
          <option value="no_entregado">No Entregado</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </FormField>

      {estado === 'no_entregado' && (
        <>
          {visita.motivo_ia_sugerido && (
            <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-md p-3">
              <div className="text-[10px] text-accent-blue uppercase tracking-wider mb-1">Sugerencia IA</div>
              <div className="text-[13px] font-medium text-text-primary mb-2">{visita.motivo_ia_sugerido}</div>
              <button type="button" onClick={() => setMotivo(visita.motivo_ia_sugerido!)} className="text-[11px] text-accent-blue font-semibold uppercase tracking-wider hover:underline">
                Usar sugerencia
              </button>
            </div>
          )}

          <FormField label="Motivo">
            <Select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
              <option value="">Seleccionar motivo...</option>
              {activeMotivos.map((m) => (
                <option key={m.motivo_id} value={m.codigo}>{m.codigo}</option>
              ))}
            </Select>
          </FormField>

          {motivo && (
            <div className="text-[11px] text-text-secondary bg-bg-700/50 rounded p-2">
              {activeMotivos.find((m) => m.codigo === motivo)?.descripcion}
            </div>
          )}

          <FormField label="Comentario">
            <Input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Detalle adicional..." />
          </FormField>
        </>
      )}

      <SubmitButton loading={loading} label="Actualizar" />
    </form>
  )
}
