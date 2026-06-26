import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import {
  listClientes,
  createCliente,
  updateCliente,
  deleteCliente,
  getCliente,
  getClienteHistorialVisitas,
  getClienteVisitasFuturas,
  cancelClientePendingVisitas,
  updateVisita,
  adminRunGeocoding,
  retenerCliente,
} from '@/api/sdk.gen'
import type {
  ClienteOut,
  ClienteVisitaHistorialItem,
  ClienteVisitaProgramadaItem,
  ClienteCreate,
  ClienteUpdate,
  CancelPendingVisitasRequest,
  CancelPendingVisitasResult,
  GeocodingRunResult,
} from '@/api'
import { DataTable } from '@/components/DataTable'
import { SlidePanel } from '@/components/SlidePanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, Input, SubmitButton } from '@/components/FormField'
import { Badge } from '@/components/Badge'
import { useEmpresas } from '@/lib/use-empresas'
import { useAuthStore } from '@/lib/auth-store'
import {
  Plus,
  Pencil,
  Trash2,
  Star,
  Crown,
  Search,
  MapPin,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Info,
  History,
  ExternalLink,
  SlidersHorizontal,
  Ban,
  X,
} from 'lucide-react'
import type { FormEvent } from 'react'

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000] as const
const DEFAULT_PAGE_SIZE = 200
const HISTORIAL_PAGE_SIZE = 50

type GeoStatus = 'pending' | 'centroide_fallback' | 'nominatim_ok' | 'failed'

function GeoStatusBadge({ status }: { status?: string | null }) {
  const s = (status ?? 'pending') as GeoStatus
  if (s === 'nominatim_ok') {
    return (
      <Badge variant="green">
        <MapPin className="w-3 h-3 mr-1" />
        OK
      </Badge>
    )
  }
  if (s === 'centroide_fallback') {
    return <Badge variant="yellow">Comuna</Badge>
  }
  if (s === 'failed') {
    return (
      <Badge variant="red">
        <AlertCircle className="w-3 h-3 mr-1" />
        Fallo
      </Badge>
    )
  }
  // pending (default)
  return (
    <Badge variant="gray">
      <Clock className="w-3 h-3 mr-1" />
      Pendiente
    </Badge>
  )
}

function formatGeocodedAt(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatEta(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

type Mode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; cliente: ClienteOut }

export function ClientesPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const isFalabella = user?.role === 'falabella_admin' || user?.role === 'falabella_ops'
  const isAdmin = user?.role === 'falabella_admin'

  const [searchParams, setSearchParams] = useSearchParams()
  const focusParam = searchParams.get('focus')
  const focusId = focusParam ? Number(focusParam) : null

  const [empresaFilter, setEmpresaFilter] = useState<string>('')
  const [vipOnly, setVipOnly] = useState(false)
  const [q, setQ] = useState('')
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [offset, setOffset] = useState<number>(0)
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })
  const [delTarget, setDelTarget] = useState<ClienteOut | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [geoResult, setGeoResult] = useState<GeocodingRunResult | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  const { data: empresas } = useEmpresas()
  const empresaMap = new Map((empresas ?? []).map((e) => [e.empresa_id, e.nombre]))

  // Deep-link support: when arriving with `?focus=N` (e.g. clicking a cliente
  // link from a RutaCard expanded visita), auto-fetch the cliente and open the
  // edit panel. We don't depend on the cliente being in the current paginated
  // list — backend GET /clientes/{id} returns ClienteOut directly.
  const focusQ = useQuery({
    queryKey: ['cliente-focus', focusId],
    queryFn: () => getCliente({ path: { cliente_id: focusId as number } }),
    enabled: focusId != null,
  })
  // Derived-state pattern (setState during render), same idiom as the
  // pagination reset below. Avoids the cascading-render warning from
  // react-hooks/set-state-in-effect.
  const focusData = focusQ.data?.data as ClienteOut | undefined
  const [lastFocusedId, setLastFocusedId] = useState<number | null>(null)
  if (focusId != null && focusData && focusData.cliente_id === focusId && lastFocusedId !== focusId) {
    setLastFocusedId(focusId)
    if (mode.kind !== 'edit' || mode.cliente.cliente_id !== focusId) {
      setMode({ kind: 'edit', cliente: focusData })
    }
    // Drop the param so refreshes/back-button don't re-trigger.
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
  }

  // Reset pagination when filters change. Uses the "derived state" pattern
  // (setState during render) instead of useEffect — cheaper and idiomatic.
  const filtersKey = `${empresaFilter}|${vipOnly ? '1' : '0'}|${q.trim()}`
  const [lastFiltersKey, setLastFiltersKey] = useState(filtersKey)
  if (lastFiltersKey !== filtersKey) {
    setLastFiltersKey(filtersKey)
    setOffset(0)
  }

  const queryFilters = {
    empresa_id: empresaFilter ? Number(empresaFilter) : undefined,
    es_vip: vipOnly ? true : undefined,
    q: q.trim() || undefined,
  }

  // CR-023: backend now returns {items, total, limit, offset}. The old hack
  // (second query with limit=10000 for totalCount) is dead — total comes
  // bundled.
  const listQ = useQuery({
    queryKey: ['clientes', { ...queryFilters, limit: pageSize, offset }],
    queryFn: () =>
      listClientes({
        query: { ...queryFilters, limit: pageSize, offset },
      }),
  })
  const listPayload = listQ.data?.data
  const clientes: ClienteOut[] = listPayload?.items ?? []
  const totalCount = listPayload?.total ?? 0
  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1
  const canPrev = offset > 0
  const canNext = offset + pageSize < totalCount

  const createMut = useMutation({
    mutationFn: (body: ClienteCreate) => createCliente({ body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      setMode({ kind: 'closed' })
    },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: ClienteUpdate }) =>
      updateCliente({ path: { cliente_id: id }, body }),
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      void qc.invalidateQueries({ queryKey: ['cliente-detail', vars.id] })
      setMode({ kind: 'closed' })
    },
  })
  const retenerMut = useMutation({
    mutationFn: ({ id, retener, motivo }: { id: number; retener: boolean; motivo?: string }) =>
      retenerCliente({ path: { cliente_id: id }, body: { retener, motivo, avisar_whatsapp: true } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      const d = (res as { data?: { retener?: boolean; avisos_enviados?: number; visitas_afectadas?: number; sin_whatsapp?: number } }).data
      if (d?.retener) {
        const sinWa = d.sin_whatsapp ?? 0
        window.alert(
          `Cliente marcado NO ENTREGAR.\n` +
          `Visitas pendientes afectadas: ${d.visitas_afectadas ?? 0}\n` +
          `Avisos WhatsApp enviados a conductores: ${d.avisos_enviados ?? 0}` +
          (sinWa ? `\n⚠ ${sinWa} conductor(es) sin WhatsApp activo (no se les pudo avisar).` : ''),
        )
      }
    },
  })

  function toggleRetener(c: ClienteOut) {
    if (c.retener) {
      retenerMut.mutate({ id: c.cliente_id, retener: false })
      return
    }
    const motivo = window.prompt('Motivo para NO ENTREGAR (se avisará al conductor por WhatsApp):', c.retener_motivo ?? '')
    if (motivo === null) return
    retenerMut.mutate({ id: c.cliente_id, retener: true, motivo: motivo.trim() || undefined })
  }

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCliente({ path: { cliente_id: id } }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'No se pudo eliminar el cliente (tiene visitas asociadas).'
        setDeleteError(detail)
        return
      }
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      setDelTarget(null)
      setDeleteError(null)
    },
    onError: (err: unknown) => {
      const detail =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : 'Error al eliminar el cliente.'
      setDeleteError(detail)
    },
  })

  const geocodeMut = useMutation({
    mutationFn: () =>
      adminRunGeocoding({
        query: {
          empresa_id: empresaFilter ? Number(empresaFilter) : undefined,
          max: 100,
        },
      }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error al ejecutar geocoding.'
        setGeoError(detail)
        setGeoResult(null)
        return
      }
      const data = (res as { data?: GeocodingRunResult }).data
      if (data) {
        setGeoResult(data)
        setGeoError(null)
        void qc.invalidateQueries({ queryKey: ['clientes'] })
      }
    },
    onError: (err: unknown) => {
      const detail =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : 'Error al ejecutar geocoding.'
      setGeoError(detail)
      setGeoResult(null)
    },
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    // Maestro de clientes = identidad + VIP + notas. La empresa servidora se
    // deriva de las visitas (M2M `cliente_empresas`), no se asigna acá.
    const nombre = (fd.get('nombre') as string).trim()
    const rut = (fd.get('rut') as string).trim() || null
    const telefono = (fd.get('telefono') as string).trim() || null
    const email = (fd.get('email') as string).trim() || null
    const es_vip = fd.get('es_vip') === 'on'
    const vip_razon = (fd.get('vip_razon') as string).trim() || null
    const notas_operativas = (fd.get('notas_operativas') as string).trim() || null
    const direccion_default = (fd.get('direccion_default') as string).trim() || null
    const comuna_default = (fd.get('comuna_default') as string).trim() || null
    const region_default = (fd.get('region_default') as string).trim() || null

    // Client-side validation
    if (!nombre) return

    if (mode.kind === 'create') {
      // Intencionalmente omitimos `empresa_id` del body — el backend acepta
      // ClienteCreate sin empresa (CR-023). La relación cliente↔empresa se
      // crea automáticamente al ingresar visitas.
      createMut.mutate({
        nombre,
        rut,
        telefono,
        email,
        es_vip,
        vip_razon: es_vip ? vip_razon : null,
        notas_operativas,
        direccion_default,
        comuna_default,
        region_default,
      })
    } else if (mode.kind === 'edit') {
      updateMut.mutate({
        id: mode.cliente.cliente_id,
        body: {
          nombre,
          rut,
          telefono,
          email,
          es_vip,
          vip_razon: es_vip ? vip_razon : null,
          notas_operativas,
          direccion_default,
          comuna_default,
          region_default,
        },
      })
    }
  }

  const editing = mode.kind === 'edit' ? mode.cliente : null

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
            Clientes
          </h1>
          {isAdmin && (
            <button
              onClick={() => {
                setGeoResult(null)
                setGeoError(null)
                geocodeMut.mutate()
              }}
              disabled={geocodeMut.isPending}
              title="Resuelve hasta 100 clientes pendientes (1 req/s; puede demorar ~100s)"
              className="flex items-center gap-1 rounded border border-line bg-bg-700 hover:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-text-primary px-2 py-1 text-[11px] uppercase tracking-wider transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {geocodeMut.isPending ? 'Geocodificando...' : 'Geocodificar pendientes'}
            </button>
          )}
          <button
            onClick={() => setVipOnly((v) => !v)}
            className={
              vipOnly
                ? 'flex items-center gap-1 rounded border border-accent-yellow/40 bg-accent-yellow/15 text-accent-yellow px-2 py-1 text-[11px] uppercase tracking-wider'
                : 'flex items-center gap-1 rounded border border-line bg-bg-700 text-text-muted hover:text-text-primary px-2 py-1 text-[11px] uppercase tracking-wider'
            }
          >
            <Star className="w-3 h-3" /> Solo VIP
          </button>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nombre / RUT / email"
              className="rounded border border-line bg-bg-700 pl-7 pr-2 py-1 text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-500 w-56"
            />
          </div>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo Cliente
        </button>
      </div>

      <p className="text-[11px] text-text-muted mb-3">
        Maestro de identidad y anotaciones operativas. La empresa servidora se
        asigna automáticamente al crear visitas.
      </p>

      {/* Empresa chip selector (only for falabella roles) — filtro de vista,
          NO asigna empresa al cliente. Usa el M2M derivado de visitas. */}
      {isFalabella && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">
            Empresa:
          </span>
          <button
            onClick={() => setEmpresaFilter('')}
            className={clsx(
              'rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors',
              empresaFilter === ''
                ? 'border-brand-500 bg-brand-500/15 text-brand-500'
                : 'border-line bg-bg-700 text-text-muted hover:text-text-primary',
            )}
          >
            Todas
          </button>
          {(empresas ?? []).map((e) => {
            const active = empresaFilter === String(e.empresa_id)
            return (
              <button
                key={e.empresa_id}
                onClick={() => setEmpresaFilter(String(e.empresa_id))}
                className={clsx(
                  'rounded-full px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider border transition-colors',
                  active
                    ? 'border-brand-500 bg-brand-500/15 text-brand-500'
                    : 'border-line bg-bg-700 text-text-muted hover:text-text-primary',
                )}
              >
                {e.nombre}
              </button>
            )
          })}
        </div>
      )}

      {/* Count + page size */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="text-[11px] text-text-muted">
          {listQ.isLoading ? (
            <span className="uppercase tracking-wider">Cargando...</span>
          ) : (
            <>
              Mostrando{' '}
              <span className="text-text-primary tabular-nums">{clientes.length}</span>{' '}
              de{' '}
              <span className="text-text-primary tabular-nums">{totalCount}</span>{' '}
              clientes
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor="page-size"
            className="text-[10px] text-text-muted uppercase tracking-wider"
          >
            Por página:
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setOffset(0)
            }}
            className="rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary tabular-nums focus:outline-none focus:border-brand-500"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {geocodeMut.isPending && (
        <div className="mb-3 rounded border border-line bg-bg-700 px-3 py-2 text-[11px] text-text-primary uppercase tracking-wider">
          Geocodificando hasta 100 clientes pendientes. Nominatim limita a 1 req/s, esto puede demorar hasta 100 segundos. No cierre esta vista.
        </div>
      )}
      {geoResult && !geocodeMut.isPending && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded border border-accent-green/40 bg-accent-green/10 px-3 py-2 text-[11px] text-text-primary">
          <span>
            Geocoding terminado: {geoResult.procesados} procesados / {geoResult.ok} OK /{' '}
            {geoResult.fallback} fallback / {geoResult.failed} fallidos en{' '}
            {geoResult.duration_s.toFixed(1)}s.
          </span>
          <button
            onClick={() => setGeoResult(null)}
            className="text-text-muted hover:text-text-primary"
            title="Cerrar"
          >
            ×
          </button>
        </div>
      )}
      {geoError && !geocodeMut.isPending && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red">
          <span>{geoError}</span>
          <button
            onClick={() => setGeoError(null)}
            className="text-text-muted hover:text-text-primary"
            title="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      {listQ.isLoading ? (
        <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
      ) : (
        <DataTable<ClienteOut>
          keyFn={(c) => c.cliente_id}
          data={clientes}
          emptyMessage="Sin clientes"
          columns={[
            {
              header: 'Nombre',
              accessor: (c) => {
                const hasNotes = !!(c.notas_operativas && c.notas_operativas.trim())
                const notesPreview = hasNotes
                  ? c.notas_operativas!.length > 80
                    ? `${c.notas_operativas!.slice(0, 80)}...`
                    : c.notas_operativas!
                  : null
                return (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setMode({ kind: 'edit', cliente: c })}
                      className="text-brand-500 hover:text-brand-600 font-medium text-left"
                    >
                      {c.nombre}
                    </button>
                    {hasNotes && (
                      <span title={notesPreview ?? ''} className="cursor-help">
                        <Info className="w-3 h-3 text-text-muted hover:text-text-secondary" />
                      </span>
                    )}
                    {c.retener && (
                      <span title={c.retener_motivo ?? 'No entregar'}
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent-red text-white cursor-help">
                        <Ban className="w-3 h-3" /> No entregar
                      </span>
                    )}
                  </div>
                )
              },
            },
            { header: 'RUT', accessor: (c) => c.rut ?? '—' },
            { header: 'Telefono', accessor: (c) => c.telefono ?? '—' },
            { header: 'Comuna', accessor: (c) => c.comuna_default ?? '—' },
            {
              header: 'Geo',
              accessor: (c) => <GeoStatusBadge status={c.geocoding_status} />,
              className: 'w-28',
            },
            {
              header: 'Visitas',
              accessor: (c) => (
                <span
                  className="text-text-secondary tabular-nums"
                  title="Histórico total de servicios"
                >
                  {c.visitas_total ?? 0}
                </span>
              ),
              className: 'w-24',
            },
            {
              header: 'VIP',
              accessor: (c) =>
                c.es_vip ? (
                  <span
                    title={c.vip_razon ?? 'Cliente VIP'}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-accent-red/20 text-accent-red border border-accent-red/40 cursor-help"
                  >
                    <Crown className="w-3 h-3" /> VIP
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                ),
              className: 'w-24',
            },
            {
              header: '',
              accessor: (c) => (
                <div className="flex gap-1 justify-end">
                  <button
                    onClick={() => toggleRetener(c)}
                    disabled={retenerMut.isPending}
                    className={clsx('p-1.5 rounded transition-colors disabled:opacity-50',
                      c.retener ? 'bg-accent-red/15 hover:bg-accent-red/25' : 'hover:bg-bg-700')}
                    title={c.retener ? 'Quitar “No entregar”' : 'Marcar “No entregar” (avisa al conductor por WhatsApp)'}
                  >
                    <Ban className={clsx('w-3.5 h-3.5', c.retener ? 'text-accent-red' : 'text-text-muted')} />
                  </button>
                  <button
                    onClick={() => setMode({ kind: 'edit', cliente: c })}
                    className="p-1.5 hover:bg-bg-700 rounded transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                  <button
                    onClick={() => {
                      setDelTarget(c)
                      setDeleteError(null)
                    }}
                    className="p-1.5 hover:bg-accent-red/10 rounded transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-accent-red" />
                  </button>
                </div>
              ),
              className: 'w-20',
            },
          ]}
        />
      )}

      {/* Pagination footer */}
      {!listQ.isLoading && totalCount > 0 && (
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3 border-t border-line/60 pt-3">
          <div className="text-[11px] text-text-muted tabular-nums">
            Página <span className="text-text-primary">{currentPage}</span> de{' '}
            <span className="text-text-primary">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((o) => Math.max(0, o - pageSize))}
              disabled={!canPrev}
              className="flex items-center gap-1 rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Anterior
            </button>
            <button
              onClick={() => setOffset((o) => o + pageSize)}
              disabled={!canNext}
              className="flex items-center gap-1 rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <SlidePanel
        open={mode.kind !== 'closed'}
        onClose={() => setMode({ kind: 'closed' })}
        title={mode.kind === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}
      >
        {mode.kind === 'create' && (
          <ClienteForm
            key="new"
            editing={null}
            onSubmit={handleSubmit}
            loading={createMut.isPending}
            error={createMut.error ? 'Error al guardar (revise RUT)' : null}
          />
        )}
        {mode.kind === 'edit' && editing && (
          <ClienteEditPanel
            key={editing.cliente_id}
            cliente={editing}
            empresaMap={empresaMap}
            onSubmit={handleSubmit}
            loading={updateMut.isPending}
            error={updateMut.error ? 'Error al guardar (revise RUT)' : null}
          />
        )}
      </SlidePanel>

      <ConfirmDialog
        open={!!delTarget}
        onClose={() => {
          setDelTarget(null)
          setDeleteError(null)
        }}
        onConfirm={() => delTarget && deleteMut.mutate(delTarget.cliente_id)}
        title="Eliminar Cliente"
        message={
          deleteError
            ? deleteError
            : `Se eliminara "${delTarget?.nombre}". Esta accion no se puede deshacer.`
        }
        loading={deleteMut.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit panel with tabs (Datos / Reglas / Historial)
//
// CR-027: the "Empresas" tab was removed alongside the M2M cliente↔empresa
// model. The empresas servidas projection is now derived on demand via
// GET /clientes/{id}/empresas-servidas — not part of the master view.
// ---------------------------------------------------------------------------

type DetailTab = 'datos' | 'reglas' | 'historial'

interface ClienteEditPanelProps {
  cliente: ClienteOut
  empresaMap: Map<number, string>
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  loading: boolean
  error: string | null
}

function ClienteEditPanel({
  cliente,
  empresaMap,
  onSubmit,
  loading,
  error,
}: ClienteEditPanelProps) {
  const [tab, setTab] = useState<DetailTab>('datos')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-line pb-2">
        {([
          { key: 'datos' as DetailTab, label: 'Datos', icon: Info },
          { key: 'reglas' as DetailTab, label: 'Reglas', icon: SlidersHorizontal },
          { key: 'historial' as DetailTab, label: 'Historial', icon: History },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider rounded transition-colors',
              tab === t.key
                ? 'bg-brand-500/15 text-brand-500 font-semibold'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <ClienteForm
          editing={cliente}
          onSubmit={onSubmit}
          loading={loading}
          error={error}
        />
      )}

      {tab === 'reglas' && <ReglasTab cliente={cliente} />}

      {tab === 'historial' && (
        <HistorialTab clienteId={cliente.cliente_id} empresaMap={empresaMap} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reglas operativas tab (ventana horaria, dias bloqueados, prioridad, cancel)
// ---------------------------------------------------------------------------

const DIAS_ISO = [
  { code: 'mon', short: 'L', label: 'Lunes' },
  { code: 'tue', short: 'M', label: 'Martes' },
  { code: 'wed', short: 'X', label: 'Miércoles' },
  { code: 'thu', short: 'J', label: 'Jueves' },
  { code: 'fri', short: 'V', label: 'Viernes' },
  { code: 'sat', short: 'S', label: 'Sábado' },
  { code: 'sun', short: 'D', label: 'Domingo' },
] as const

const PRIORIDAD_OPTIONS: Array<{
  value: number | null
  label: string
  color: string
}> = [
  { value: 1, label: '1 — Crítica', color: 'bg-accent-red/20 text-accent-red border-accent-red/40' },
  { value: 2, label: '2 — Alta', color: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40' },
  { value: 3, label: '3 — Media', color: 'bg-accent-blue/20 text-accent-blue border-accent-blue/40' },
  { value: 4, label: '4 — Baja', color: 'bg-bg-700 text-text-secondary border-line' },
  { value: 5, label: '5 — Mínima', color: 'bg-bg-700 text-text-muted border-line' },
  { value: null, label: 'Sin prioridad', color: 'bg-bg-700 text-text-muted border-line' },
]

/** Strip ":SS" so <input type="time"> accepts the value. */
function trimTimeToHHMM(value: string | null | undefined): string {
  if (!value) return ''
  // backend: "HH:MM:SS" → "HH:MM"
  const m = /^(\d{2}:\d{2})/.exec(value)
  return m ? m[1]! : value
}

function ReglasTab({ cliente }: { cliente: ClienteOut }) {
  const qc = useQueryClient()
  const [inicio, setInicio] = useState<string>(trimTimeToHHMM(cliente.ventana_horaria_inicio))
  const [fin, setFin] = useState<string>(trimTimeToHHMM(cliente.ventana_horaria_fin))
  const [diasBloqueados, setDiasBloqueados] = useState<string[]>(cliente.dias_no_disponible ?? [])
  const [prioridad, setPrioridad] = useState<number | null>(cliente.prioridad ?? null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [savedToast, setSavedToast] = useState<{ syncCount: number } | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const updateReglasMut = useMutation({
    mutationFn: () =>
      updateCliente({
        path: { cliente_id: cliente.cliente_id },
        body: {
          ventana_horaria_inicio: inicio ? `${inicio}:00` : null,
          ventana_horaria_fin: fin ? `${fin}:00` : null,
          dias_no_disponible: diasBloqueados.length > 0 ? diasBloqueados : null,
          prioridad,
        },
      }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error al guardar reglas.'
        setSaveError(detail)
        setSavedToast(null)
        return
      }
      const data = (res as { data?: ClienteOut }).data
      const syncCount = data?.sync_visitas_count ?? 0
      setSavedToast({ syncCount })
      setSaveError(null)
      void qc.invalidateQueries({ queryKey: ['clientes'] })
      void qc.invalidateQueries({ queryKey: ['cliente-detail', cliente.cliente_id] })
      void qc.invalidateQueries({ queryKey: ['cliente-historial', cliente.cliente_id] })
      void qc.invalidateQueries({ queryKey: ['cliente-visitas-futuras', cliente.cliente_id] })
    },
    onError: (err: unknown) => {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar reglas.')
    },
  })

  function toggleDia(code: string) {
    setDiasBloqueados((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaveError(null)
    setSavedToast(null)
    // Client-side validation: si hay inicio o fin, ambos requeridos y fin > inicio.
    if ((inicio && !fin) || (fin && !inicio)) {
      setSaveError('Debes definir ambos extremos de la ventana horaria, o limpiar ambos.')
      return
    }
    if (inicio && fin && fin <= inicio) {
      setSaveError('El fin de la ventana debe ser posterior al inicio.')
      return
    }
    updateReglasMut.mutate()
  }

  function clearVentana() {
    setInicio('')
    setFin('')
  }

  return (
    <div className="space-y-5">
      {savedToast && (
        <div className="flex items-start justify-between gap-3 rounded border border-accent-green/40 bg-accent-green/10 px-3 py-2 text-[11px] text-text-primary">
          <span>
            {savedToast.syncCount > 0
              ? `Reglas guardadas. VIP / prioridad sincronizado a ${savedToast.syncCount} visitas activas.`
              : 'Reglas guardadas.'}
          </span>
          <button
            onClick={() => setSavedToast(null)}
            className="text-text-muted hover:text-text-primary"
            title="Cerrar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {saveError && (
        <div className="flex items-start justify-between gap-3 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red">
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="text-text-muted hover:text-text-primary"
            title="Cerrar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Ventana horaria */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Ventana horaria
            </label>
            {(inicio || fin) && (
              <button
                type="button"
                onClick={clearVentana}
                className="text-[10px] text-text-muted hover:text-accent-red uppercase tracking-wider"
              >
                Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-text-muted uppercase mb-1">Desde</div>
              <input
                type="time"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary tabular-nums focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <div className="text-[10px] text-text-muted uppercase mb-1">Hasta</div>
              <input
                type="time"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary tabular-nums focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>
          {inicio && fin && (
            <div className="mt-1.5 text-[11px] text-text-secondary tabular-nums">
              Disponible entre <span className="text-text-primary">{inicio}</span> y{' '}
              <span className="text-text-primary">{fin}</span>.
            </div>
          )}
          {!inicio && !fin && (
            <div className="mt-1.5 text-[11px] text-text-muted">
              Sin ventana horaria. El cliente acepta entregas en cualquier horario operativo.
            </div>
          )}
        </section>

        {/* Días no disponibles */}
        <section>
          <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            Días no disponibles
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {DIAS_ISO.map((d) => {
              const active = diasBloqueados.includes(d.code)
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => toggleDia(d.code)}
                  title={d.label}
                  className={clsx(
                    'w-9 h-9 rounded-md border text-[12px] font-bold uppercase tracking-wider transition-colors',
                    active
                      ? 'bg-accent-red/20 text-accent-red border-accent-red/40'
                      : 'bg-bg-700 text-text-muted border-line hover:text-text-primary hover:border-line/80',
                  )}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
          <div className="mt-1.5 text-[11px] text-text-secondary">
            {diasBloqueados.length === 0 ? (
              <span className="text-text-muted">Sin días bloqueados.</span>
            ) : (
              <>
                <span className="text-accent-red font-semibold tabular-nums">
                  {diasBloqueados.length}
                </span>{' '}
                {diasBloqueados.length === 1 ? 'día bloqueado' : 'días bloqueados'}.
              </>
            )}
          </div>
        </section>

        {/* Prioridad */}
        <section>
          <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
            Prioridad
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {PRIORIDAD_OPTIONS.map((opt) => {
              const active = prioridad === opt.value
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setPrioridad(opt.value)}
                  className={clsx(
                    'rounded border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors text-left',
                    active
                      ? opt.color + ' ring-1 ring-inset ring-current'
                      : 'bg-bg-700 text-text-muted border-line hover:text-text-primary',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <div className="mt-1.5 text-[11px] text-text-muted">
            1 = más alta, 5 = más baja. Afecta el orden sugerido por el planificador.
          </div>
        </section>

        <SubmitButton loading={updateReglasMut.isPending} label="Guardar reglas" />
      </form>

      <div className="border-t border-line/60 pt-4">
        <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          Acciones destructivas
        </div>
        <button
          type="button"
          onClick={() => setCancelOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[12px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/20 transition-colors"
        >
          <Ban className="w-3.5 h-3.5" />
          Cancelar próximas entregas
        </button>
        <p className="mt-1.5 text-[10px] text-text-muted">
          Marca como canceladas las visitas pendientes futuras (no toca visitas entregadas o ya cerradas).
        </p>
      </div>

      <CancelPendingDialog
        open={cancelOpen}
        clienteId={cliente.cliente_id}
        clienteNombre={cliente.nombre}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cancel pending visitas dialog (richer than ConfirmDialog — scope + motivo)
// ---------------------------------------------------------------------------

type CancelScope = CancelPendingVisitasRequest['scope']

function CancelPendingDialog({
  open,
  clienteId,
  clienteNombre,
  onClose,
}: {
  open: boolean
  clienteId: number
  clienteNombre: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [scope, setScope] = useState<CancelScope>('today')
  const [dias, setDias] = useState<number>(7)
  const [motivo, setMotivo] = useState('')
  const [result, setResult] = useState<CancelPendingVisitasResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cancelMut = useMutation({
    mutationFn: () => {
      const body: CancelPendingVisitasRequest = {
        motivo: motivo.trim(),
        scope: scope ?? 'all',
        ...(scope === 'next_n_days' ? { dias } : {}),
      }
      return cancelClientePendingVisitas({ path: { cliente_id: clienteId }, body })
    },
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error al cancelar entregas.'
        setError(detail)
        setResult(null)
        return
      }
      const data = (res as { data?: CancelPendingVisitasResult }).data
      if (data) {
        setResult(data)
        setError(null)
        void qc.invalidateQueries({ queryKey: ['clientes'] })
        void qc.invalidateQueries({ queryKey: ['cliente-historial', clienteId] })
        void qc.invalidateQueries({ queryKey: ['cliente-visitas-futuras', clienteId] })
        // Also bust day-level caches the user may have open in another tab.
        data.dia_ids.forEach((d) => {
          void qc.invalidateQueries({ queryKey: ['dia-visitas', d] })
          void qc.invalidateQueries({ queryKey: ['dia', d] })
        })
      }
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Error al cancelar entregas.')
    },
  })

  function handleClose() {
    setResult(null)
    setError(null)
    setMotivo('')
    setScope('today')
    setDias(7)
    onClose()
  }

  function handleConfirm() {
    setError(null)
    if (motivo.trim().length === 0) {
      setError('El motivo es obligatorio.')
      return
    }
    if (motivo.length > 500) {
      setError('El motivo no puede superar los 500 caracteres.')
      return
    }
    if (scope === 'next_n_days' && (dias < 1 || dias > 30)) {
      setError('El rango de días debe estar entre 1 y 30.')
      return
    }
    cancelMut.mutate()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div className="relative bg-bg-800 border border-line rounded-md shadow-xl p-5 w-full max-w-md">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-[12px] font-semibold text-accent-red uppercase tracking-wider flex items-center gap-1.5">
              <Ban className="w-4 h-4" /> Cancelar próximas entregas
            </h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              Cliente: <span className="text-text-primary">{clienteNombre}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-bg-700 rounded transition-colors"
            title="Cerrar"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="rounded border border-accent-green/40 bg-accent-green/10 px-3 py-3">
              <div className="text-[12px] font-semibold text-accent-green uppercase tracking-wider mb-1">
                Cancelación completada
              </div>
              <div className="text-[12px] text-text-primary">
                Se cancelaron{' '}
                <span className="font-bold tabular-nums">{result.cancelled_count}</span>{' '}
                {result.cancelled_count === 1 ? 'visita' : 'visitas'} en{' '}
                <span className="font-bold tabular-nums">{result.dia_ids.length}</span>{' '}
                {result.dia_ids.length === 1 ? 'día' : 'días'}.
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {/* Scope selector */}
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Alcance
                </label>
                <div className="space-y-1.5">
                  {([
                    { value: 'today' as const, label: 'Solo hoy' },
                    { value: 'next_n_days' as const, label: 'Próximos N días' },
                    { value: 'all' as const, label: 'Todas las pendientes' },
                  ]).map((opt) => (
                    <label
                      key={opt.value}
                      className={clsx(
                        'flex items-center gap-2 rounded border px-3 py-2 text-[12px] cursor-pointer transition-colors',
                        scope === opt.value
                          ? 'border-accent-red/40 bg-accent-red/10 text-accent-red'
                          : 'border-line bg-bg-700 text-text-primary hover:border-line/80',
                      )}
                    >
                      <input
                        type="radio"
                        name="cancel-scope"
                        value={opt.value}
                        checked={scope === opt.value}
                        onChange={() => setScope(opt.value)}
                        className="accent-accent-red"
                      />
                      <span className="flex-1">{opt.label}</span>
                      {opt.value === 'next_n_days' && scope === 'next_n_days' && (
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={dias}
                          onChange={(e) => setDias(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                          className="w-16 rounded border border-line bg-bg-800 px-2 py-1 text-[12px] text-text-primary tabular-nums focus:outline-none focus:border-accent-red"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Motivo */}
              <div>
                <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Motivo <span className="text-accent-red">*</span>
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Cliente reportó vacaciones del 1 al 15 de junio"
                  rows={3}
                  maxLength={500}
                  className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-red transition-colors"
                />
                <div className="text-right text-[10px] text-text-muted tabular-nums mt-0.5">
                  {motivo.length}/500
                </div>
              </div>

              {error && (
                <div className="rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleClose}
                disabled={cancelMut.isPending}
                className="flex-1 rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={cancelMut.isPending}
                className="flex-1 rounded bg-accent-red/15 border border-accent-red/40 px-3 py-2 text-[12px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/25 disabled:opacity-50 transition-colors"
              >
                {cancelMut.isPending ? 'Cancelando...' : 'Confirmar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Historial tab
// ---------------------------------------------------------------------------

function visitaEstadoVariant(estado: string): 'green' | 'red' | 'yellow' | 'gray' | 'blue' {
  const e = estado.toLowerCase()
  if (e === 'entregada' || e === 'completada' || e === 'ok') return 'green'
  if (e === 'fallida' || e === 'no_entregada' || e === 'rechazada') return 'red'
  if (e === 'pendiente' || e === 'planificada') return 'gray'
  if (e === 'en_curso' || e === 'en_ruta') return 'blue'
  return 'yellow'
}

type HistorialView = 'pasadas' | 'futuras_7' | 'futuras_30'

function HistorialTab({
  clienteId,
  empresaMap,
}: {
  clienteId: number
  empresaMap: Map<number, string>
}) {
  const [view, setView] = useState<HistorialView>('pasadas')

  if (view === 'pasadas') {
    return (
      <div>
        <HistorialSwitcher view={view} onChange={setView} />
        <HistorialPasadasList clienteId={clienteId} empresaMap={empresaMap} />
      </div>
    )
  }
  const days = view === 'futuras_7' ? 7 : 30
  return (
    <div>
      <HistorialSwitcher view={view} onChange={setView} />
      <HistorialFuturasList clienteId={clienteId} empresaMap={empresaMap} days={days} />
    </div>
  )
}

function HistorialSwitcher({
  view,
  onChange,
}: {
  view: HistorialView
  onChange: (v: HistorialView) => void
}) {
  const opts: Array<{ key: HistorialView; label: string }> = [
    { key: 'pasadas', label: 'Históricas' },
    { key: 'futuras_7', label: 'Próximas (7d)' },
    { key: 'futuras_30', label: 'Próximas (30d)' },
  ]
  return (
    <div className="flex items-center gap-1 mb-3 rounded border border-line bg-bg-700 p-0.5">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={clsx(
            'flex-1 rounded px-2 py-1 text-[11px] uppercase tracking-wider transition-colors',
            view === o.key
              ? 'bg-brand-500/15 text-brand-500 font-semibold'
              : 'text-text-muted hover:text-text-primary',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function HistorialPasadasList({
  clienteId,
  empresaMap,
}: {
  clienteId: number
  empresaMap: Map<number, string>
}) {
  const [limit, setLimit] = useState(HISTORIAL_PAGE_SIZE)

  const histQ = useQuery({
    queryKey: ['cliente-historial', clienteId, limit],
    queryFn: () =>
      getClienteHistorialVisitas({
        path: { cliente_id: clienteId },
        query: { limit, offset: 0 },
      }),
  })

  if (histQ.isLoading) {
    return (
      <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
    )
  }
  const payload = histQ.data?.data
  const items: ClienteVisitaHistorialItem[] = payload?.items ?? []
  const total = payload?.total ?? 0
  const hasMore = items.length < total

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] text-text-muted uppercase tracking-wider">
        Sin historial de visitas
      </div>
    )
  }

  return (
    <div>
      <div className="text-[11px] text-text-muted mb-2 tabular-nums">
        Mostrando <span className="text-text-primary">{items.length}</span> de{' '}
        <span className="text-text-primary">{total}</span> visitas
      </div>
      <div className="space-y-2">
        {items.map((v) => (
          <div
            key={v.visita_id}
            className="rounded-md border border-line bg-bg-800 p-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-medium text-text-primary tabular-nums">
                  {formatDate(v.fecha)}
                </span>
                <Badge variant={visitaEstadoVariant(v.estado)}>{v.estado}</Badge>
                {v.ruta_folio && (
                  <span className="text-[11px] text-text-muted">Ruta {v.ruta_folio}</span>
                )}
              </div>
              <a
                href={`/operacion/${v.dia_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-bg-700 rounded text-text-muted hover:text-brand-500 transition-colors"
                title="Abrir día operativo"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="text-[11px] text-text-secondary mb-1">
              {empresaMap.get(v.empresa_id) ?? v.empresa_nombre ?? `Empresa ${v.empresa_id}`}
            </div>
            <div className="text-[11px] text-text-muted">{v.direccion}</div>
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-muted tabular-nums">
              {v.eta_estimada && <span>ETA {formatEta(v.eta_estimada)}</span>}
              {v.motivo && (
                <span className="text-accent-red">Motivo: {v.motivo}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setLimit((l) => l + HISTORIAL_PAGE_SIZE)}
          disabled={histQ.isFetching}
          className="mt-3 w-full rounded border border-line bg-bg-700 px-3 py-1.5 text-[11px] text-text-primary uppercase tracking-wider hover:border-brand-500 disabled:opacity-50 transition-colors"
        >
          {histQ.isFetching ? 'Cargando...' : `Ver más (${total - items.length} restantes)`}
        </button>
      )}
    </div>
  )
}

function HistorialFuturasList({
  clienteId,
  empresaMap,
  days,
}: {
  clienteId: number
  empresaMap: Map<number, string>
  days: number
}) {
  const qc = useQueryClient()
  const [cancelTarget, setCancelTarget] = useState<ClienteVisitaProgramadaItem | null>(null)
  const [cancelMotivo, setCancelMotivo] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  const futQ = useQuery({
    queryKey: ['cliente-visitas-futuras', clienteId, days],
    queryFn: () =>
      getClienteVisitasFuturas({
        path: { cliente_id: clienteId },
        query: { days },
      }),
  })

  // Cancel one specific visita via PATCH /visitas/{id} (the bulk endpoint
  // doesn't accept visita_id). Estado = 'cancelado' + motivo libre.
  const cancelOneMut = useMutation({
    mutationFn: ({ vid, motivo }: { vid: number; motivo: string }) =>
      updateVisita({
        path: { visita_id: vid },
        body: { estado: 'cancelado', motivo_comentario: motivo },
      }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error al cancelar la visita.'
        setCancelError(detail)
        return
      }
      // Refresh: futuras list + relevant dia cache + historial (visita cancelada
      // se mueve a histórico).
      void qc.invalidateQueries({ queryKey: ['cliente-visitas-futuras', clienteId] })
      void qc.invalidateQueries({ queryKey: ['cliente-historial', clienteId] })
      if (cancelTarget) {
        void qc.invalidateQueries({ queryKey: ['dia-visitas', cancelTarget.dia_id] })
        void qc.invalidateQueries({ queryKey: ['dia', cancelTarget.dia_id] })
      }
      setCancelTarget(null)
      setCancelMotivo('')
      setCancelError(null)
    },
    onError: (err: unknown) => {
      setCancelError(err instanceof Error ? err.message : 'Error al cancelar la visita.')
    },
  })

  if (futQ.isLoading) {
    return (
      <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
    )
  }
  const payload = futQ.data?.data
  const items: ClienteVisitaProgramadaItem[] = payload?.items ?? []
  const total = payload?.total ?? 0

  return (
    <div>
      <div className="text-[11px] text-text-muted mb-2 tabular-nums">
        <span className="text-text-primary">{total}</span>{' '}
        {total === 1 ? 'visita programada' : 'visitas programadas'} en los próximos{' '}
        <span className="text-text-primary">{days}</span> días.
      </div>
      {items.length === 0 ? (
        <div className="text-center py-8 text-[11px] text-text-muted uppercase tracking-wider">
          Sin visitas programadas
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((v) => (
            <div
              key={v.visita_id}
              className="rounded-md border border-line bg-bg-800 p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium text-text-primary tabular-nums">
                    {formatDate(v.fecha)}
                  </span>
                  <Badge variant={visitaEstadoVariant(v.estado)}>{v.estado}</Badge>
                  {v.ruta_folio && (
                    <span className="text-[11px] text-text-muted">Ruta {v.ruta_folio}</span>
                  )}
                  <span
                    className="text-[10px] text-text-muted uppercase tracking-wider"
                    title="Estado del día operativo"
                  >
                    Día {v.dia_estado}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={`/operacion/${v.dia_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-bg-700 rounded text-text-muted hover:text-brand-500 transition-colors"
                    title="Abrir día operativo"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      setCancelTarget(v)
                      setCancelMotivo('')
                      setCancelError(null)
                    }}
                    className="p-1 hover:bg-accent-red/10 rounded text-text-muted hover:text-accent-red transition-colors"
                    title="Cancelar esta visita"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="text-[11px] text-text-secondary mb-1">
                {empresaMap.get(v.empresa_id) ?? v.empresa_nombre ?? `Empresa ${v.empresa_id}`}
              </div>
              <div className="text-[11px] text-text-muted">
                {v.direccion}
                {v.comuna ? `, ${v.comuna}` : ''}
              </div>
              {v.eta_estimada && (
                <div className="mt-1.5 text-[11px] text-text-muted tabular-nums">
                  ETA {formatEta(v.eta_estimada)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-visita cancel dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!cancelOneMut.isPending) {
                setCancelTarget(null)
                setCancelError(null)
              }
            }}
          />
          <div className="relative bg-bg-800 border border-line rounded-md shadow-xl p-5 w-full max-w-sm">
            <h3 className="text-[12px] font-semibold text-accent-red uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Ban className="w-4 h-4" /> Cancelar visita
            </h3>
            <p className="text-[12px] text-text-secondary mb-3">
              Visita del{' '}
              <span className="text-text-primary tabular-nums">{formatDate(cancelTarget.fecha)}</span>{' '}
              en{' '}
              <span className="text-text-primary">
                {cancelTarget.direccion}
                {cancelTarget.comuna ? `, ${cancelTarget.comuna}` : ''}
              </span>
              .
            </p>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
              Motivo <span className="text-accent-red">*</span>
            </label>
            <textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder="Cliente no estará disponible..."
              rows={3}
              maxLength={500}
              className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-red transition-colors"
            />
            <div className="text-right text-[10px] text-text-muted tabular-nums">
              {cancelMotivo.length}/500
            </div>
            {cancelError && (
              <div className="mt-2 rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red">
                {cancelError}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setCancelTarget(null)
                  setCancelError(null)
                }}
                disabled={cancelOneMut.isPending}
                className="flex-1 rounded border border-line px-3 py-2 text-[12px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700 disabled:opacity-50 transition-colors"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setCancelError(null)
                  if (cancelMotivo.trim().length === 0) {
                    setCancelError('El motivo es obligatorio.')
                    return
                  }
                  cancelOneMut.mutate({
                    vid: cancelTarget.visita_id,
                    motivo: cancelMotivo.trim(),
                  })
                }}
                disabled={cancelOneMut.isPending}
                className="flex-1 rounded bg-accent-red/15 border border-accent-red/40 px-3 py-2 text-[12px] font-semibold text-accent-red uppercase tracking-wider hover:bg-accent-red/25 disabled:opacity-50 transition-colors"
              >
                {cancelOneMut.isPending ? 'Cancelando...' : 'Cancelar visita'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form (create + edit datos tab)
// ---------------------------------------------------------------------------

function ClienteForm({
  editing,
  onSubmit,
  loading,
  error,
}: {
  editing: ClienteOut | null
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  loading: boolean
  error: string | null
}) {
  const [esVip, setEsVip] = useState<boolean>(editing?.es_vip ?? false)

  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <FormField label="Nombre">
        <Input name="nombre" required defaultValue={editing?.nombre ?? ''} />
      </FormField>
      <FormField label="RUT">
        <Input name="rut" defaultValue={editing?.rut ?? ''} placeholder="12.345.678-9" />
      </FormField>
      <FormField label="Telefono">
        <Input name="telefono" defaultValue={editing?.telefono ?? ''} placeholder="+56..." />
      </FormField>
      <FormField label="Email">
        <Input
          name="email"
          type="email"
          defaultValue={editing?.email ?? ''}
          placeholder="contacto@empresa.cl"
        />
      </FormField>

      <div className="my-4 border-t border-line/60" />

      <FormField label="Direccion default">
        <Input name="direccion_default" defaultValue={editing?.direccion_default ?? ''} />
      </FormField>
      <FormField label="Comuna default">
        <Input name="comuna_default" defaultValue={editing?.comuna_default ?? ''} />
      </FormField>
      <FormField label="Region default">
        <Input name="region_default" defaultValue={editing?.region_default ?? ''} />
      </FormField>

      {editing && (
        <div className="mt-3 rounded border border-line bg-bg-700/40 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted uppercase tracking-wider">
              Geocoding
            </span>
            <GeoStatusBadge status={editing.geocoding_status} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
            <span>Intentos</span>
            <span className="text-text-primary tabular-nums">
              {editing.geocoding_attempts ?? 0}/3
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
            <span>Ultimo intento</span>
            <span className="text-text-primary tabular-nums">
              {formatGeocodedAt(editing.geocoded_at)}
            </span>
          </div>
          {(editing.lat_default != null || editing.lon_default != null) && (
            <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
              <span>Coords</span>
              <span className="text-text-primary tabular-nums">
                {editing.lat_default?.toFixed(5) ?? '—'},{' '}
                {editing.lon_default?.toFixed(5) ?? '—'}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="my-4 border-t border-line/60" />

      <div className="flex items-center gap-2 mb-2">
        <input
          type="checkbox"
          name="es_vip"
          id="es_vip"
          checked={esVip}
          onChange={(e) => setEsVip(e.target.checked)}
          className="w-4 h-4 accent-brand-500"
        />
        <label
          htmlFor="es_vip"
          className="text-[12px] text-text-primary flex items-center gap-1 cursor-pointer"
        >
          <Star className="w-3.5 h-3.5 text-accent-yellow" /> Cliente VIP (prioridad alta)
        </label>
      </div>

      {esVip && (
        <FormField label="Razon VIP">
          <textarea
            name="vip_razon"
            defaultValue={editing?.vip_razon ?? ''}
            placeholder="Motivo por el cual es VIP (ej: cliente top, contrato corporativo)"
            rows={2}
            className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
          />
        </FormField>
      )}

      <FormField label="Notas operativas">
        <textarea
          name="notas_operativas"
          defaultValue={editing?.notas_operativas ?? ''}
          placeholder="Instrucciones especiales para el conductor (acceso, horarios, etc)"
          rows={3}
          className="w-full rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500 transition-colors"
        />
      </FormField>

      <SubmitButton loading={loading} />
      {error && <p className="text-[11px] text-accent-red mt-2">{error}</p>}
    </form>
  )
}
