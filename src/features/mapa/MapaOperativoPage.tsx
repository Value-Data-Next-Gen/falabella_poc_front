import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import DeckGL from '@deck.gl/react'
import { ColumnLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { getMapaHeatmap, getMapaStats, listMapaVisitas, listEmpresas } from '@/api/sdk.gen'
import type {
  EmpresaOut,
  EmpresaStat,
  MapaHeatmapBucket,
  MapaHeatmapResponse,
  MapaStatsResponse,
  MapaVisitaItem,
  TopComuna,
  TopRuta,
} from '@/api'
import { Badge } from '@/components/Badge'
import {
  Map as MapIcon,
  Plus,
  Minus,
  Home,
  Maximize2,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react'
import { clsx } from 'clsx'

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY as string | undefined) || ''
const TILE_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/bright-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4569]
const INITIAL_VIEW = { longitude: SANTIAGO_CENTER[0], latitude: SANTIAGO_CENTER[1], zoom: 10, pitch: 0, bearing: 0 }

const STATUS_COLOR: Record<string, [number, number, number, number]> = {
  pendiente: [148, 163, 184, 200],
  en_camino: [245, 158, 11, 220],
  entregado: [16, 185, 129, 220],
  no_entregado: [239, 68, 68, 230],
  cancelado: [107, 114, 128, 200],
}

function heatmapColor(ratio: number): [number, number, number, number] {
  if (!Number.isFinite(ratio)) return [148, 163, 184, 180]
  if (ratio >= 0.9) return [16, 185, 129, 210]
  if (ratio >= 0.7) return [245, 158, 11, 210]
  return [239, 68, 68, 210]
}

interface Tooltip {
  x: number
  y: number
  content: React.ReactNode
}

// Returns today's date in CL ISO format (YYYY-MM-DD).
function todayIsoCL(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function MapaOperativoPage() {
  const [fecha, setFecha] = useState<string>(todayIsoCL())
  const [selectedEmpresaIds, setSelectedEmpresaIds] = useState<Set<number>>(new Set())
  const [showVisitas, setShowVisitas] = useState(false)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [liveMode, setLiveMode] = useState(false)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const mapRef = useRef<MapRef | null>(null)

  // Empresas available to the current user (scope handled server-side).
  const empresasQ = useQuery({
    queryKey: ['empresas'],
    queryFn: () => listEmpresas(),
  })
  const empresas = (empresasQ.data?.data ?? []) as EmpresaOut[]

  // CSV of selected empresa_ids, empty string = all (omitted from query).
  const empresaIdsCsv = useMemo(() => {
    if (selectedEmpresaIds.size === 0) return undefined
    return Array.from(selectedEmpresaIds).join(',')
  }, [selectedEmpresaIds])

  // CR-029 LIVE polling cadence: heatmap+stats=10s when live, 60s otherwise;
  // visitas=30s when live, no refetch otherwise (heavier list).
  const statsInterval = liveMode ? 10_000 : 60_000
  const visitasInterval = liveMode ? 30_000 : false as const

  const statsQ = useQuery({
    queryKey: ['mapa-operativo-stats', fecha, empresaIdsCsv ?? 'all'],
    queryFn: () =>
      getMapaStats({
        query: { fecha, empresa_ids: empresaIdsCsv ?? null },
      }),
    refetchInterval: statsInterval,
  })
  const stats = statsQ.data?.data as MapaStatsResponse | undefined

  const heatmapQ = useQuery({
    queryKey: ['mapa-operativo-heatmap', fecha, empresaIdsCsv ?? 'all'],
    queryFn: () =>
      getMapaHeatmap({
        query: { fecha, empresa_ids: empresaIdsCsv ?? null },
      }),
    refetchInterval: statsInterval,
    enabled: showHeatmap,
  })
  const heatmap = heatmapQ.data?.data as MapaHeatmapResponse | undefined
  const heatmapBuckets = (heatmap?.buckets ?? []) as MapaHeatmapBucket[]

  const visitasQ = useQuery({
    queryKey: ['mapa-operativo-visitas', fecha, empresaIdsCsv ?? 'all'],
    queryFn: () =>
      listMapaVisitas({
        query: { fecha, empresa_ids: empresaIdsCsv ?? null },
      }),
    refetchInterval: visitasInterval,
    enabled: showVisitas,
  })
  const visitas = (visitasQ.data?.data ?? []) as MapaVisitaItem[]
  const validVisitas = useMemo(
    () => visitas.filter((v) => v.lat != null && v.lon != null),
    [visitas],
  )

  // Auto-fit once we have data.
  const [autoFitDone, setAutoFitDone] = useState(false)
  useEffect(() => {
    if (autoFitDone) return
    const pts: [number, number][] = [
      ...heatmapBuckets.map((b) => [b.lon, b.lat] as [number, number]),
      ...validVisitas.map((v) => [v.lon!, v.lat!] as [number, number]),
    ]
    if (pts.length === 0) return
    const lons = pts.map((p) => p[0])
    const lats = pts.map((p) => p[1])
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const centerLon = (minLon + maxLon) / 2
    const centerLat = (minLat + maxLat) / 2
    const lonSpan = Math.max(0.01, maxLon - minLon)
    const latSpan = Math.max(0.01, maxLat - minLat)
    const zoom = Math.min(14, Math.max(8, 12 - Math.log2(Math.max(lonSpan, latSpan) * 100)))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewState({ longitude: centerLon, latitude: centerLat, zoom, pitch: 0, bearing: 0 })
    setAutoFitDone(true)
  }, [autoFitDone, heatmapBuckets, validVisitas])

  // Reset auto-fit when fecha or empresa filter changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutoFitDone(false)
  }, [fecha, empresaIdsCsv])

  const layers = useMemo(() => {
    const ls: unknown[] = []

    if (showHeatmap && heatmapBuckets.length > 0) {
      ls.push(new ColumnLayer({
        id: 'mapa-op-heatmap',
        data: heatmapBuckets,
        diskResolution: 6,
        radius: 800,
        extruded: false,
        pickable: true,
        getPosition: (b: MapaHeatmapBucket) => [b.lon, b.lat],
        getFillColor: (b: MapaHeatmapBucket) => {
          const ratio = b.total > 0 ? b.entregadas / b.total : 0
          return heatmapColor(ratio)
        },
        getLineColor: [255, 255, 255, 200],
        lineWidthUnits: 'pixels',
        getLineWidth: 1,
        stroked: true,
        filled: true,
        onHover: (info: PickingInfo) => {
          if (info.object) {
            const b = info.object as MapaHeatmapBucket
            const ratio = b.total > 0 ? (b.entregadas / b.total) * 100 : 0
            setTooltip({
              x: info.x, y: info.y,
              content: (
                <div className="text-[12px] space-y-1 min-w-[180px]">
                  <div className="font-semibold">{b.comuna}</div>
                  <div className="text-[11px] text-text-secondary">Total: {b.total}</div>
                  <div className="text-[10px] text-accent-green">Entregadas: {b.entregadas}</div>
                  <div className="text-[10px] text-accent-red">No entregadas: {b.no_entregadas}</div>
                  <div className="text-[10px] text-text-muted">Pendientes: {b.pendientes}</div>
                  {b.atrasadas > 0 && <div className="text-[10px] text-accent-yellow">Atrasadas: {b.atrasadas}</div>}
                  <div className="pt-1 text-[10px] font-semibold">Avance: {ratio.toFixed(0)}%</div>
                </div>
              ),
            })
          } else { setTooltip(null) }
        },
        onClick: (info: PickingInfo) => {
          if (info.object) {
            const b = info.object as MapaHeatmapBucket
            setViewState({ longitude: b.lon, latitude: b.lat, zoom: 13, pitch: 0, bearing: 0 })
          }
        },
      }))
    }

    if (showVisitas && validVisitas.length > 0) {
      ls.push(new ScatterplotLayer({
        id: 'mapa-op-visitas',
        data: validVisitas,
        getPosition: (v: MapaVisitaItem) => [v.lon!, v.lat!],
        getRadius: 6,
        radiusUnits: 'pixels',
        stroked: true,
        filled: true,
        getFillColor: (v: MapaVisitaItem) => STATUS_COLOR[v.estado] ?? STATUS_COLOR.pendiente!,
        getLineColor: [255, 255, 255, 200],
        getLineWidth: 1,
        lineWidthUnits: 'pixels',
        pickable: true,
        onHover: (info: PickingInfo) => {
          if (info.object) {
            const v = info.object as MapaVisitaItem
            setTooltip({
              x: info.x, y: info.y,
              content: (
                <div className="text-[12px] space-y-1 min-w-[200px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {v.cliente_nombre}
                    {v.es_vip && <Badge variant="red">VIP</Badge>}
                  </div>
                  <div className="text-[11px] text-text-secondary">{v.direccion}</div>
                  {v.comuna && <div className="text-[10px] text-text-muted">{v.comuna}</div>}
                  <div className="text-[10px] text-text-muted">{v.empresa_nombre}</div>
                  {v.ruta_folio && <div className="text-[10px] text-text-muted font-mono">Ruta {v.ruta_folio}</div>}
                  <div className="pt-1 text-[10px] uppercase tracking-wider">{v.estado.replace('_', ' ')}</div>
                  {v.atraso_min != null && v.atraso_min > 0 && (
                    <div className="text-[10px] text-accent-yellow">Atraso: {v.atraso_min} min</div>
                  )}
                </div>
              ),
            })
          } else { setTooltip(null) }
        },
      }))
    }

    return ls
  }, [showHeatmap, showVisitas, heatmapBuckets, validVisitas])

  const toggleEmpresa = (empresa_id: number) => {
    setSelectedEmpresaIds((prev) => {
      const next = new Set(prev)
      if (next.has(empresa_id)) next.delete(empresa_id)
      else next.add(empresa_id)
      return next
    })
  }

  const focusEmpresa = (empresa_id: number) => {
    setSelectedEmpresaIds(new Set([empresa_id]))
  }

  const clearEmpresaFilter = () => setSelectedEmpresaIds(new Set())

  const fitToData = () => {
    setAutoFitDone(false)
  }
  const goHome = () => setViewState(INITIAL_VIEW)
  const zoomBy = (delta: number) => {
    setViewState((vs) => ({ ...vs, zoom: Math.min(20, Math.max(4, vs.zoom + delta)) }))
  }

  const isLoading = statsQ.isLoading || empresasQ.isLoading
  const hasError = statsQ.isError || empresasQ.isError

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[15px] uppercase tracking-wider text-text-primary font-semibold flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-brand-500" />
          Mapa operativo
        </h1>

        <div className="flex items-center gap-2">
          <label htmlFor="fecha-input" className="text-[10px] uppercase tracking-wider text-text-muted">
            Fecha
          </label>
          <input
            id="fecha-input"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="bg-bg-800 border border-line rounded px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Empresas:</span>
          <button
            type="button"
            onClick={clearEmpresaFilter}
            className={clsx(
              'px-2 py-0.5 rounded border text-[11px] uppercase tracking-wider transition-colors',
              selectedEmpresaIds.size === 0
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                : 'bg-bg-800 border-line text-text-muted hover:text-text-secondary',
            )}
          >
            Todas
          </button>
          {empresas.map((e) => (
            <button
              key={e.empresa_id}
              type="button"
              onClick={() => toggleEmpresa(e.empresa_id)}
              className={clsx(
                'px-2 py-0.5 rounded border text-[11px] uppercase tracking-wider transition-colors',
                selectedEmpresaIds.has(e.empresa_id)
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                  : 'bg-bg-800 border-line text-text-muted hover:text-text-secondary',
              )}
              title={e.nombre}
            >
              {e.nombre}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHeatmap((s) => !s)}
            className={clsx(
              'px-2 py-1 rounded border text-[11px] uppercase tracking-wider transition-colors',
              showHeatmap ? 'bg-brand-500/15 border-brand-500/40 text-brand-400' : 'bg-bg-800 border-line text-text-muted',
            )}
          >
            Heatmap
          </button>
          <button
            type="button"
            onClick={() => setShowVisitas((s) => !s)}
            className={clsx(
              'px-2 py-1 rounded border text-[11px] uppercase tracking-wider transition-colors',
              showVisitas ? 'bg-brand-500/15 border-brand-500/40 text-brand-400' : 'bg-bg-800 border-line text-text-muted',
            )}
          >
            Visitas
          </button>
          <button
            type="button"
            onClick={() => setLiveMode((l) => !l)}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] uppercase tracking-wider transition-colors',
              liveMode
                ? 'bg-accent-green/15 border-accent-green/40 text-accent-green'
                : 'bg-bg-800 border-line text-text-muted hover:text-text-secondary',
            )}
            aria-pressed={liveMode}
          >
            <Radio className={clsx('w-3 h-3', liveMode && 'animate-pulse')} />
            Live
          </button>
        </div>
      </div>

      {hasError && (
        <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red text-[12px] rounded px-3 py-2">
          Error cargando datos del mapa. Reintenta en unos segundos.
        </div>
      )}

      <div className="flex gap-3" style={{ height: 'calc(100vh - 160px)', minHeight: 560 }}>
        {/* Map */}
        <div className="relative flex-1 rounded-md border border-line overflow-hidden bg-bg-800">
          <DeckGL
            viewState={viewState}
            controller
            onViewStateChange={(e) => setViewState(e.viewState as typeof INITIAL_VIEW)}
            layers={layers as never}
            getCursor={({ isDragging, isHovering }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'}
          >
            <Map
              ref={mapRef}
              reuseMaps
              mapStyle={TILE_STYLE}
              mapLib={maplibregl as unknown as Parameters<typeof Map>[0]['mapLib']}
              attributionControl={false}
            />
          </DeckGL>

          {/* Controls */}
          <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
            <button onClick={() => zoomBy(1)} className="w-8 h-8 rounded bg-white shadow-md hover:bg-gray-50 flex items-center justify-center transition-colors" title="Acercar">
              <Plus className="w-4 h-4 text-text-primary" />
            </button>
            <button onClick={() => zoomBy(-1)} className="w-8 h-8 rounded bg-white shadow-md hover:bg-gray-50 flex items-center justify-center transition-colors" title="Alejar">
              <Minus className="w-4 h-4 text-text-primary" />
            </button>
            <button onClick={fitToData} className="w-8 h-8 rounded bg-white shadow-md hover:bg-gray-50 flex items-center justify-center transition-colors" title="Ajustar a datos">
              <Maximize2 className="w-4 h-4 text-text-primary" />
            </button>
            <button onClick={goHome} className="w-8 h-8 rounded bg-white shadow-md hover:bg-gray-50 flex items-center justify-center transition-colors" title="Inicio">
              <Home className="w-4 h-4 text-text-primary" />
            </button>
          </div>

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute top-3 left-3 z-10 bg-bg-800/95 backdrop-blur border border-line rounded-md px-2 py-1 text-[10px] text-text-muted uppercase tracking-wider">
              Cargando...
            </div>
          )}

          {/* Empty state */}
          {!isLoading && heatmapBuckets.length === 0 && validVisitas.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg-900/60 backdrop-blur-sm pointer-events-none">
              <div className="text-center bg-bg-800 border border-line rounded-md px-6 py-4 pointer-events-auto">
                <MapIcon className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-[13px] text-text-secondary">Sin datos para esta fecha</p>
                <p className="text-[11px] text-text-muted">Probá otra fecha o quitá filtros</p>
              </div>
            </div>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute z-20 pointer-events-none bg-bg-800 border border-line rounded-md shadow-xl px-3 py-2 text-text-primary"
              style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
            >
              {tooltip.content}
            </div>
          )}
        </div>

        {/* Sidebar KPIs */}
        <aside className="w-72 flex-shrink-0 overflow-auto space-y-3">
          <SectionGlobal stats={stats} loading={statsQ.isLoading} />
          <SectionPorEmpresa
            stats={stats}
            selectedIds={selectedEmpresaIds}
            onFocus={focusEmpresa}
            onToggle={toggleEmpresa}
          />
          <SectionTopComunas
            comunas={stats?.top_comunas_fails ?? []}
            heatmapBuckets={heatmapBuckets}
            onFocusComuna={(comuna) => {
              const b = heatmapBuckets.find((h) => h.comuna === comuna)
              if (b) setViewState({ longitude: b.lon, latitude: b.lat, zoom: 13, pitch: 0, bearing: 0 })
            }}
          />
          <SectionTopRutas
            best={stats?.top_rutas_best ?? []}
            worst={stats?.top_rutas_worst ?? []}
          />
        </aside>
      </div>
    </div>
  )
}

// --- KPI sidebar sections ---

function SectionGlobal({ stats, loading }: { stats?: MapaStatsResponse; loading: boolean }) {
  return (
    <div className="bg-bg-800 border border-line rounded-md p-3">
      <h2 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">KPIs globales</h2>
      {loading && <div className="text-[11px] text-text-muted">Cargando...</div>}
      {!loading && !stats && <div className="text-[11px] text-text-muted">Sin datos</div>}
      {stats && (
        <div className="space-y-1.5 text-[12px]">
          <KpiRow label="Total visitas" value={stats.total_visitas} />
          <KpiRow label="Entregadas" value={stats.total_entregadas} color="text-accent-green" icon={<CheckCircle2 className="w-3 h-3" />} />
          <KpiRow label="No entregadas" value={stats.total_no_entregadas} color="text-accent-red" icon={<XCircle className="w-3 h-3" />} />
          <KpiRow label="Atrasadas" value={stats.total_atrasadas} color="text-accent-yellow" icon={<Clock className="w-3 h-3" />} />
          <div className="border-t border-line pt-1.5 mt-1.5 flex items-center justify-between">
            <span className="text-text-secondary">Avance</span>
            <span className="font-mono font-semibold text-brand-400 text-[14px]">{stats.avance_pct.toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiRow({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={clsx('flex items-center gap-1.5', color ?? 'text-text-secondary')}>
        {icon}{label}
      </span>
      <span className={clsx('font-mono font-semibold', color ?? 'text-text-primary')}>{value}</span>
    </div>
  )
}

function SectionPorEmpresa({
  stats,
  selectedIds,
  onFocus,
  onToggle,
}: {
  stats?: MapaStatsResponse
  selectedIds: Set<number>
  onFocus: (id: number) => void
  onToggle: (id: number) => void
}) {
  const items = (stats?.por_empresa ?? []) as EmpresaStat[]
  return (
    <div className="bg-bg-800 border border-line rounded-md p-3">
      <h2 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Por empresa</h2>
      {items.length === 0 && <div className="text-[11px] text-text-muted">Sin datos</div>}
      <div className="space-y-1.5">
        {items.map((e) => {
          const selected = selectedIds.has(e.empresa_id)
          return (
            <div
              key={e.empresa_id}
              className={clsx(
                'flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors border',
                selected
                  ? 'bg-brand-500/10 border-brand-500/40'
                  : 'bg-bg-900 border-line hover:border-line/70',
              )}
              onClick={() => onFocus(e.empresa_id)}
              role="button"
              tabIndex={0}
              onKeyDown={(ev) => { if (ev.key === 'Enter') onFocus(e.empresa_id) }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={(ev) => { ev.stopPropagation(); onToggle(e.empresa_id) }}
                onClick={(ev) => ev.stopPropagation()}
                className="accent-brand-500"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-primary truncate">{e.empresa_nombre}</div>
                <div className="text-[10px] text-text-muted">
                  {e.entregadas}/{e.visitas} · {e.rutas} ruta{e.rutas !== 1 ? 's' : ''}
                </div>
              </div>
              <span
                className={clsx(
                  'font-mono text-[12px] font-semibold',
                  e.avance_pct >= 90 ? 'text-accent-green' : e.avance_pct >= 70 ? 'text-accent-yellow' : 'text-accent-red',
                )}
              >
                {e.avance_pct.toFixed(0)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SectionTopComunas({
  comunas,
  heatmapBuckets,
  onFocusComuna,
}: {
  comunas: TopComuna[]
  heatmapBuckets: MapaHeatmapBucket[]
  onFocusComuna: (comuna: string) => void
}) {
  if (comunas.length === 0) {
    return (
      <div className="bg-bg-800 border border-line rounded-md p-3">
        <h2 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Top comunas con fallos</h2>
        <div className="text-[11px] text-text-muted">Sin no-entregas</div>
      </div>
    )
  }
  return (
    <div className="bg-bg-800 border border-line rounded-md p-3">
      <h2 className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
        <AlertTriangle className="w-3 h-3 text-accent-red" />
        Top comunas con fallos
      </h2>
      <div className="space-y-1">
        {comunas.map((c) => {
          const hasCoord = heatmapBuckets.some((b) => b.comuna === c.comuna)
          return (
            <button
              key={c.comuna}
              type="button"
              onClick={() => hasCoord && onFocusComuna(c.comuna)}
              disabled={!hasCoord}
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] transition-colors',
                hasCoord
                  ? 'bg-bg-900 hover:bg-bg-700 cursor-pointer'
                  : 'bg-bg-900 cursor-default opacity-60',
              )}
            >
              <span className="text-text-secondary truncate">{c.comuna}</span>
              <span className="font-mono font-semibold text-accent-red">{c.no_entregadas}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SectionTopRutas({ best, worst }: { best: TopRuta[]; worst: TopRuta[] }) {
  return (
    <div className="bg-bg-800 border border-line rounded-md p-3 space-y-3">
      <div>
        <h2 className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-accent-green" />
          Mejores rutas
        </h2>
        {best.length === 0 ? (
          <div className="text-[11px] text-text-muted">Sin rutas</div>
        ) : (
          <div className="space-y-1">
            {best.map((r) => (
              <RutaRow key={r.ruta_id} ruta={r} accent="text-accent-green" />
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-accent-red" />
          Peores rutas
        </h2>
        {worst.length === 0 ? (
          <div className="text-[11px] text-text-muted">Sin rutas</div>
        ) : (
          <div className="space-y-1">
            {worst.map((r) => (
              <RutaRow key={r.ruta_id} ruta={r} accent="text-accent-red" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RutaRow({ ruta, accent }: { ruta: TopRuta; accent: string }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-bg-900 px-2 py-1 rounded">
      <div className="min-w-0">
        <div className="text-[11px] text-text-primary font-mono truncate">{ruta.ruta_folio}</div>
        <div className="text-[10px] text-text-muted truncate">{ruta.empresa_nombre} · {ruta.total_visitas} visitas</div>
      </div>
      <span className={clsx('font-mono text-[12px] font-semibold', accent)}>{ruta.avance_pct.toFixed(0)}%</span>
    </div>
  )
}
