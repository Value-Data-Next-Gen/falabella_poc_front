import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import Map, { type MapRef } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, IconLayer, PathLayer, TextLayer, ColumnLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { listDriverPositions, getMapaHeatmap, getMapaStats, getSimClock } from '@/api/sdk.gen'
import type {
  VisitaOut,
  RutaOut,
  DriverPositionOut,
  MapaHeatmapBucket,
  MapaHeatmapResponse,
  MapaStatsResponse,
} from '@/api'
import { Badge } from '@/components/Badge'
import { VISITA_ESTADO_BADGE } from '../lib/dia-state-machine'
import { MapPin, Plus, Minus, Home, Maximize2, Truck, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { clsx } from 'clsx'

const MAPTILER_KEY = (import.meta.env.VITE_MAPTILER_KEY as string | undefined) || ''
const TILE_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/bright-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

const SANTIAGO_CENTER: [number, number] = [-70.6483, -33.4569]
const CHILE_BBOX = { minLat: -56, maxLat: -17, minLon: -76, maxLon: -66 }
const INITIAL_VIEW = { longitude: SANTIAGO_CENTER[0], latitude: SANTIAGO_CENTER[1], zoom: 11, pitch: 0, bearing: 0 }

// Route colors by vehicle (deterministic hash → tab10 palette)
const ROUTE_PALETTE: [number, number, number][] = [
  [31, 119, 180], [255, 127, 14], [44, 160, 44], [214, 39, 40], [148, 103, 189],
  [227, 119, 194], [188, 189, 34], [23, 190, 207], [255, 187, 120], [152, 223, 138],
]

function vehicleColor(vehicleId: number | null): [number, number, number] {
  if (vehicleId == null) return [148, 163, 184]
  return ROUTE_PALETTE[vehicleId % ROUTE_PALETTE.length]!
}

const STATUS_COLOR: Record<string, [number, number, number, number]> = {
  pendiente: [148, 163, 184, 255],   // slate
  atrasada: [249, 115, 22, 255],     // orange — pendiente con ETA vencida
  en_camino: [245, 158, 11, 255],    // amber
  entregado: [16, 185, 129, 255],    // emerald
  no_entregado: [239, 68, 68, 255],  // red
  cancelado: [107, 114, 128, 255],   // gray
}

// Heatmap color: ratio (entregadas/total) → green (>0.9) / yellow (0.7-0.9) / red (<0.7)
function heatmapColor(ratio: number): [number, number, number, number] {
  if (!Number.isFinite(ratio)) return [148, 163, 184, 180]
  if (ratio >= 0.9) return [16, 185, 129, 200]   // emerald
  if (ratio >= 0.7) return [245, 158, 11, 200]   // amber
  return [239, 68, 68, 200]                       // red
}

function isValidLatLon(lat?: number | null, lon?: number | null): boolean {
  if (lat == null || lon == null) return false
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  return lat >= CHILE_BBOX.minLat && lat <= CHILE_BBOX.maxLat && lon >= CHILE_BBOX.minLon && lon <= CHILE_BBOX.maxLon
}

const TRUCK_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="white" stroke="#0e6830" stroke-width="2"/><path d="M16 38h22v-12h-22zM38 32h6l4 4v6h-10z" fill="#159349"/><circle cx="22" cy="46" r="3" fill="#0e6830"/><circle cx="42" cy="46" r="3" fill="#0e6830"/></svg>`)}`

const ICON_MAPPING = { truck: { x: 0, y: 0, width: 64, height: 64, mask: false, anchorY: 32, anchorX: 32 } }

interface Props {
  diaId: number
  fecha: string
  empresaId: number
  visitas: VisitaOut[]
  rutas: RutaOut[]
  diaEstado: string
}

interface Tooltip {
  x: number
  y: number
  content: React.ReactNode
}

interface LayerToggles {
  rutas: boolean
  visitas: boolean
  heatmap: boolean
  drivers: boolean
  soloVip: boolean
}

const DEFAULT_TOGGLES: LayerToggles = {
  rutas: true,
  visitas: true,
  heatmap: false,
  drivers: true,
  soloVip: false,
}

// Inline checkbox-style chip toggle used in the legend bar.
function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] uppercase tracking-wider transition-colors',
        active
          ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
          : 'bg-bg-800 border-line text-text-muted hover:border-line/70 hover:text-text-secondary',
      )}
      aria-pressed={active}
    >
      <span
        className={clsx(
          'w-3 h-3 rounded-sm border flex items-center justify-center',
          active ? 'bg-brand-500 border-brand-500' : 'border-text-muted',
        )}
      >
        {active && <span className="text-white text-[8px] leading-none">✓</span>}
      </span>
      {label}
    </button>
  )
}

export function MapaTab({ diaId, fecha, empresaId, visitas, rutas, diaEstado }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const mapRef = useRef<MapRef | null>(null)
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [toggles, setToggles] = useState<LayerToggles>(DEFAULT_TOGGLES)
  const [rutaFilter, setRutaFilter] = useState<number | 'all'>('all')

  const isLive = diaEstado === 'EN_CURSO'

  // CR-029: refetch drivers every 5s when live (was 10s).
  const positionsQ = useQuery({
    queryKey: ['driver-positions', diaId],
    queryFn: () => listDriverPositions({ path: { dia_id: diaId } }),
    refetchInterval: isLive ? 5000 : false,
    refetchIntervalInBackground: false,
  })
  const positions = (positionsQ.data?.data ?? []) as DriverPositionOut[]

  // Sim clock (shared cache with the clock widget) → mark pendientes whose ETA
  // has passed as "atrasada" so delays are visible on the map.
  const clockQ = useQuery({
    queryKey: ['sim-clock'],
    queryFn: () => getSimClock(),
    refetchInterval: isLive ? 10000 : false,
  })
  const simNowMs = (() => {
    const raw = (clockQ.data?.data as { sim_now?: string } | undefined)?.sim_now
    return raw ? new Date(raw).getTime() : Date.now()
  })()
  const visitaColor = (v: VisitaOut): [number, number, number, number] => {
    if (v.estado === 'pendiente' && v.eta_estimada && new Date(v.eta_estimada).getTime() < simNowMs) {
      return STATUS_COLOR.atrasada!
    }
    return STATUS_COLOR[v.estado] ?? STATUS_COLOR.pendiente!
  }

  // CR-029: heatmap query, enabled only when toggle on.
  const heatmapQ = useQuery({
    queryKey: ['mapa-heatmap', fecha, empresaId],
    queryFn: () =>
      getMapaHeatmap({
        query: { fecha, empresa_ids: String(empresaId) },
      }),
    enabled: toggles.heatmap,
    refetchInterval: toggles.heatmap && isLive ? 30000 : false,
  })
  const heatmap = heatmapQ.data?.data as MapaHeatmapResponse | undefined
  const heatmapBuckets = (heatmap?.buckets ?? []) as MapaHeatmapBucket[]

  // CR-029: stats KPI overlay.
  const statsQ = useQuery({
    queryKey: ['mapa-stats', fecha, empresaId],
    queryFn: () =>
      getMapaStats({
        query: { fecha, empresa_ids: String(empresaId) },
      }),
    refetchInterval: isLive ? 30000 : false,
  })
  const stats = statsQ.data?.data as MapaStatsResponse | undefined

  // Apply VIP and ruta filters.
  const filteredVisitas = useMemo(() => {
    let vs = visitas.filter((v) => isValidLatLon(v.lat, v.lon))
    if (toggles.soloVip) vs = vs.filter((v) => v.es_vip)
    if (rutaFilter !== 'all') vs = vs.filter((v) => v.ruta_id === rutaFilter)
    return vs
  }, [visitas, toggles.soloVip, rutaFilter])

  // Used by fit-to-data (all visitas with coords, not filtered).
  const validVisitas = useMemo(() => visitas.filter((v) => isValidLatLon(v.lat, v.lon)), [visitas])

  // Auto-fit on first data load
  useEffect(() => {
    if (validVisitas.length === 0 && positions.length === 0) return
    const lons: number[] = [...validVisitas.map((v) => v.lon!), ...positions.map((p) => p.lon)]
    const lats: number[] = [...validVisitas.map((v) => v.lat!), ...positions.map((p) => p.lat)]
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const centerLon = (minLon + maxLon) / 2
    const centerLat = (minLat + maxLat) / 2
    const lonSpan = Math.max(0.01, maxLon - minLon)
    const latSpan = Math.max(0.01, maxLat - minLat)
    const zoom = Math.min(15, Math.max(10, 13 - Math.log2(Math.max(lonSpan, latSpan) * 100)))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewState({ longitude: centerLon, latitude: centerLat, zoom, pitch: 0, bearing: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validVisitas.length, positions.length])

  const layers = useMemo(() => {
    const ls: unknown[] = []

    // Heatmap columns (pre-aggregated server-side from mapa/heatmap endpoint).
    // Uses ColumnLayer with diskResolution=6 for hexagon shape; pre-aggregated
    // data => no need for @deck.gl/aggregation-layers HexagonLayer (extra dep
    // avoided per CR scope).
    if (toggles.heatmap && heatmapBuckets.length > 0) {
      ls.push(new ColumnLayer({
        id: 'heatmap-hex',
        data: heatmapBuckets,
        diskResolution: 6,
        radius: 500,
        extruded: false,
        pickable: true,
        getPosition: (b: MapaHeatmapBucket) => [b.lon, b.lat],
        getFillColor: (b: MapaHeatmapBucket) => {
          const ratio = b.total > 0 ? b.entregadas / b.total : 0
          return heatmapColor(ratio)
        },
        getLineColor: [255, 255, 255, 180],
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
      }))
    }

    // Route paths by vehicle_id
    if (toggles.rutas) {
      const pathData: { vehicle_id: number | null; path: [number, number][] }[] = []
      const ruteSource = rutaFilter === 'all'
        ? rutas
        : rutas.filter((r) => r.ruta_id === rutaFilter)
      for (const r of ruteSource) {
        const ruteVisitas = validVisitas.filter((v) => v.ruta_id === r.ruta_id).sort((a, b) => a.orden - b.orden)
        if (ruteVisitas.length >= 2) {
          pathData.push({ vehicle_id: r.vehicle_id ?? null, path: ruteVisitas.map((v) => [v.lon!, v.lat!] as [number, number]) })
        }
      }
      if (pathData.length > 0) {
        ls.push(new PathLayer({
          id: 'routes', data: pathData,
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: (d: { vehicle_id: number | null }) => vehicleColor(d.vehicle_id),
          getWidth: 3, widthUnits: 'pixels', opacity: 0.7, pickable: false,
        }))
      }
    }

    if (toggles.visitas) {
      // VIP rings
      const vipVisitas = filteredVisitas.filter((v) => v.es_vip)
      if (vipVisitas.length > 0) {
        ls.push(new ScatterplotLayer({
          id: 'visit-vip-rings', data: vipVisitas,
          getPosition: (v: VisitaOut) => [v.lon!, v.lat!],
          getRadius: 14, radiusUnits: 'pixels', stroked: true, filled: false,
          getLineColor: [139, 92, 246, 255], getLineWidth: 2, lineWidthUnits: 'pixels', pickable: false,
        }))
      }

      // Visita pins
      ls.push(new ScatterplotLayer({
        id: 'visit-pins', data: filteredVisitas,
        getPosition: (v: VisitaOut) => [v.lon!, v.lat!],
        getRadius: 9, radiusUnits: 'pixels', stroked: true, filled: true,
        getFillColor: visitaColor,
        updateTriggers: { getFillColor: simNowMs },
        getLineColor: [255, 255, 255, 230], getLineWidth: 2, lineWidthUnits: 'pixels', pickable: true,
        onHover: (info: PickingInfo) => {
          if (info.object) {
            const v = info.object as VisitaOut
            const sb = VISITA_ESTADO_BADGE[v.estado] ?? VISITA_ESTADO_BADGE.pendiente!
            setTooltip({
              x: info.x, y: info.y,
              content: (
                <div className="text-[12px] space-y-1 min-w-[200px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {v.cliente_nombre}
                    {v.es_vip && <Badge variant="red">VIP</Badge>}
                  </div>
                  {v.es_vip && (
                    <div className="text-[10px] font-semibold text-accent-red uppercase tracking-wider">
                      ⚠ Cliente VIP — prioridad alta
                    </div>
                  )}
                  {v.folio_cliente && <div className="text-[10px] text-text-muted font-mono">Folio: {v.folio_cliente}</div>}
                  <div className="text-[11px] text-text-secondary">{v.direccion}</div>
                  {v.comuna && <div className="text-[10px] text-text-muted">{v.comuna}</div>}
                  <div className="pt-1"><Badge variant={sb.variant}>{sb.label}</Badge></div>
                  {v.motivo && <div className="text-[10px] text-accent-red">{v.motivo}</div>}
                </div>
              ),
            })
          } else { setTooltip(null) }
        },
      }))

      // Order labels
      ls.push(new TextLayer({
        id: 'visit-order',
        data: filteredVisitas.map((v, idx) => ({ ...v, idx: idx + 1 })),
        getPosition: (v: VisitaOut) => [v.lon!, v.lat!],
        getText: (v: VisitaOut & { idx: number }) => String(v.idx),
        getSize: 9, getColor: [255, 255, 255, 255],
        fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, pickable: false,
      }))
    }

    // Driver icons
    if (toggles.drivers && positions.length > 0) {
      ls.push(new IconLayer({
        id: 'drivers', data: positions,
        iconAtlas: TRUCK_ICON_URL, iconMapping: ICON_MAPPING,
        getIcon: () => 'truck',
        getPosition: (p: DriverPositionOut) => [p.lon, p.lat],
        getSize: 36,
        getAngle: (p: DriverPositionOut) => p.heading ? -p.heading : 0,
        pickable: true,
        onHover: (info: PickingInfo) => {
          if (info.object) {
            const p = info.object as DriverPositionOut
            setTooltip({
              x: info.x, y: info.y,
              content: (
                <div className="text-[12px] space-y-1 min-w-[180px]">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Truck className="w-3.5 h-3.5 text-brand-500" />
                    {p.driver_nombre}
                  </div>
                  <div className="text-[11px] text-text-secondary">{p.driver_id}</div>
                  {p.speed != null && <div className="text-[10px] text-text-muted">Velocidad: {p.speed.toFixed(0)} km/h</div>}
                  <div className="text-[10px] text-text-muted">Actualizado: {new Date(p.updated_at).toLocaleTimeString('es-CL')}</div>
                </div>
              ),
            })
          } else { setTooltip(null) }
        },
      }))
    }

    return ls
  }, [filteredVisitas, validVisitas, rutas, positions, toggles, heatmapBuckets, rutaFilter, simNowMs])

  const fitToData = useCallback(() => {
    if (validVisitas.length === 0 && positions.length === 0) return
    const lons: number[] = [...validVisitas.map((v) => v.lon!), ...positions.map((p) => p.lon)]
    const lats: number[] = [...validVisitas.map((v) => v.lat!), ...positions.map((p) => p.lat)]
    const minLon = Math.min(...lons), maxLon = Math.max(...lons)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const centerLon = (minLon + maxLon) / 2
    const centerLat = (minLat + maxLat) / 2
    const lonSpan = Math.max(0.01, maxLon - minLon)
    const latSpan = Math.max(0.01, maxLat - minLat)
    const zoom = Math.min(15, Math.max(10, 13 - Math.log2(Math.max(lonSpan, latSpan) * 100)))
    setViewState({ longitude: centerLon, latitude: centerLat, zoom, pitch: 0, bearing: 0 })
  }, [validVisitas, positions])

  const goHome = useCallback(() => setViewState(INITIAL_VIEW), [])
  const zoomBy = useCallback((delta: number) => {
    setViewState((vs) => ({ ...vs, zoom: Math.min(20, Math.max(4, vs.zoom + delta)) }))
  }, [])

  // List of rutas (folios) used for the per-ruta filter chip.
  // Must be declared before any conditional return to satisfy Rules of Hooks.
  const rutaOptions = useMemo(
    () => rutas.filter((r) => !!r.folio).map((r) => ({ ruta_id: r.ruta_id, folio: r.folio as string })),
    [rutas],
  )

  if (validVisitas.length === 0 && positions.length === 0) {
    return (
      <div className="text-center py-16 bg-bg-800 rounded-md border border-line">
        <MapPin className="w-12 h-12 text-text-muted mx-auto mb-3" />
        <p className="text-[13px] text-text-secondary">Sin coordenadas para mostrar</p>
        <p className="text-[11px] text-text-muted">Las visitas necesitan lat/lon. Geocoding automatico vendra pronto.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Top control bar: layer toggles + ruta filter */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">Capas:</span>
        <ToggleChip active={toggles.rutas} onClick={() => setToggles((t) => ({ ...t, rutas: !t.rutas }))} label="Rutas" />
        <ToggleChip active={toggles.visitas} onClick={() => setToggles((t) => ({ ...t, visitas: !t.visitas }))} label="Visitas" />
        <ToggleChip active={toggles.heatmap} onClick={() => setToggles((t) => ({ ...t, heatmap: !t.heatmap }))} label="Heatmap" />
        <ToggleChip active={toggles.drivers} onClick={() => setToggles((t) => ({ ...t, drivers: !t.drivers }))} label="Drivers" />
        <ToggleChip active={toggles.soloVip} onClick={() => setToggles((t) => ({ ...t, soloVip: !t.soloVip }))} label="Solo VIP" />

        {rutaOptions.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Ruta:</span>
            <button
              type="button"
              onClick={() => setRutaFilter('all')}
              className={clsx(
                'px-2 py-0.5 rounded border text-[11px] uppercase tracking-wider transition-colors',
                rutaFilter === 'all'
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                  : 'bg-bg-800 border-line text-text-muted hover:text-text-secondary',
              )}
            >
              Todas
            </button>
            {rutaOptions.map((r) => (
              <button
                key={r.ruta_id}
                type="button"
                onClick={() => setRutaFilter(r.ruta_id)}
                className={clsx(
                  'px-2 py-0.5 rounded border text-[11px] uppercase tracking-wider transition-colors font-mono',
                  rutaFilter === r.ruta_id
                    ? 'bg-brand-500/15 border-brand-500/40 text-brand-400'
                    : 'bg-bg-800 border-line text-text-muted hover:text-text-secondary',
                )}
              >
                {r.folio}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[11px] uppercase tracking-wider flex-wrap">
        <span className="text-text-muted">Estados:</span>
        {Object.entries(STATUS_COLOR).map(([estado, rgba]) => (
          <div key={estado} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `rgb(${rgba[0]},${rgba[1]},${rgba[2]})` }} />
            <span className="text-text-secondary">{estado.replace('_', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: 'rgb(139,92,246)' }} />
          <span className="text-text-secondary">VIP</span>
        </div>
        {isLive && (
          <span className="ml-auto text-accent-green text-[10px] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            Live {positions.length > 0 && `· ${positions.length} conductor${positions.length !== 1 ? 'es' : ''}`}
          </span>
        )}
      </div>

      {/* Map container */}
      <div className="relative rounded-md border border-line overflow-hidden" style={{ height: '600px' }}>
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

        {/* Stats KPI overlay (bottom right) */}
        {stats && (
          <div className="absolute bottom-3 right-3 z-10 bg-bg-800/95 backdrop-blur border border-line rounded-md shadow-xl px-3 py-2 min-w-[170px]">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">Resumen del dia</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-text-secondary">Total</span>
                <span className="font-mono font-semibold text-text-primary">{stats.total_visitas}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-accent-green flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Entregadas</span>
                <span className="font-mono font-semibold text-accent-green">{stats.total_entregadas}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-accent-red flex items-center gap-1"><XCircle className="w-3 h-3" />No entr.</span>
                <span className="font-mono font-semibold text-accent-red">{stats.total_no_entregadas}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-accent-yellow flex items-center gap-1"><Clock className="w-3 h-3" />Atrasadas</span>
                <span className="font-mono font-semibold text-accent-yellow">{stats.total_atrasadas}</span>
              </div>
              <div className="border-t border-line pt-1 mt-1 flex items-center justify-between gap-3">
                <span className="text-text-secondary">Avance</span>
                <span className="font-mono font-semibold text-brand-400">{stats.avance_pct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Heatmap loading indicator */}
        {toggles.heatmap && heatmapQ.isLoading && (
          <div className="absolute top-3 left-3 z-10 bg-bg-800/95 backdrop-blur border border-line rounded-md px-2 py-1 text-[10px] text-text-muted uppercase tracking-wider">
            Cargando heatmap...
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

      {!MAPTILER_KEY && (
        <p className="text-[10px] text-text-muted mt-2">
          Usando CartoDB Positron. Configurar <code>VITE_MAPTILER_KEY</code> en .env.local para tiles MapTiler.
        </p>
      )}
    </div>
  )
}
