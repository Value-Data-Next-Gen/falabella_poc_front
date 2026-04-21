import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
import { Crosshair, Home, Maximize2, Minus, Plus, X } from 'lucide-react';
import { api } from '../api';
import { Visit, AppState } from '../types';
import { useTheme } from '../hooks/useTheme';

const DEPOT: [number, number] = [-70.66, -33.45]; // [lon, lat]

type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
};

const INITIAL_VIEW: ViewState = {
  longitude: DEPOT[0],
  latitude: DEPOT[1],
  zoom: 11,
  pitch: 0,
  bearing: 0,
};

const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function colorByP(p: number): [number, number, number, number] {
  if (p >= 0.5) return [204, 34, 34, 230];
  if (p >= 0.2) return [230, 150, 0, 220];
  return [21, 147, 73, 200];
}

function parseHHMMSS(date: string, hms: string): Date {
  return new Date(`${date}T${hms}`);
}

interface TooltipState {
  visit: Visit | null;
  x: number;
  y: number;
}

interface DriverMarker {
  vehicle_id: number;
  vehicle_name: string;
  position: [number, number];
  lastCompleted: Visit | null;
  nextPending: Visit | null;
  progressPct: number;
  totalStops: number;
  completedStops: number;
}

function computeDriverMarkers(visits: Visit[], simClock: Date, today: string): DriverMarker[] {
  const byVehicle: Record<number, Visit[]> = {};
  visits.forEach(v => {
    if (!byVehicle[v.vehicle_id]) byVehicle[v.vehicle_id] = [];
    byVehicle[v.vehicle_id].push(v);
  });

  const markers: DriverMarker[] = [];
  for (const [vid, vs] of Object.entries(byVehicle)) {
    const sorted = [...vs].sort((a, b) => a.order - b.order);
    const completed = sorted.filter(v => v.status === 'completed');
    const pending = sorted.filter(v => v.status === 'pending');
    const lastCompleted = completed[completed.length - 1] ?? null;
    const nextPending = pending[0] ?? null;

    let position: [number, number];
    let progress = 0;

    if (!lastCompleted && !nextPending) {
      continue;
    } else if (!lastCompleted && nextPending) {
      // Todavía en el depot, en camino al primer stop
      const eta = parseHHMMSS(today, nextPending.estimated_time_arrival);
      const start = parseHHMMSS(today, '09:00:00');
      const frac = Math.max(0, Math.min(1, (simClock.getTime() - start.getTime()) / Math.max(1, eta.getTime() - start.getTime())));
      position = [
        DEPOT[0] + (nextPending.longitude - DEPOT[0]) * frac,
        DEPOT[1] + (nextPending.latitude - DEPOT[1]) * frac,
      ];
      progress = frac;
    } else if (lastCompleted && !nextPending) {
      // Terminó la ruta, volviendo al depot
      const etaLast = parseHHMMSS(today, lastCompleted.estimated_time_arrival);
      const frac = Math.max(0, Math.min(1, (simClock.getTime() - etaLast.getTime()) / (60 * 60 * 1000)));
      position = [
        lastCompleted.longitude + (DEPOT[0] - lastCompleted.longitude) * frac,
        lastCompleted.latitude + (DEPOT[1] - lastCompleted.latitude) * frac,
      ];
      progress = 1;
    } else {
      // Entre dos stops
      const etaLast = parseHHMMSS(today, lastCompleted!.estimated_time_arrival);
      const etaNext = parseHHMMSS(today, nextPending!.estimated_time_arrival);
      const total = Math.max(1, etaNext.getTime() - etaLast.getTime());
      const frac = Math.max(0, Math.min(1, (simClock.getTime() - etaLast.getTime()) / total));
      position = [
        lastCompleted!.longitude + (nextPending!.longitude - lastCompleted!.longitude) * frac,
        lastCompleted!.latitude + (nextPending!.latitude - lastCompleted!.latitude) * frac,
      ];
      progress = frac;
    }

    markers.push({
      vehicle_id: Number(vid),
      vehicle_name: sorted[0].vehicle_name,
      position,
      lastCompleted,
      nextPending,
      progressPct: Math.round(progress * 100),
      totalStops: sorted.length,
      completedStops: completed.length,
    });
  }
  return markers;
}

export function OperationsMap({ selectedVehicles }: { selectedVehicles: number[] }) {
  const visitsQ = useQuery({
    queryKey: ['visits-map', selectedVehicles],
    queryFn: () => api.visits({ vehicle_ids: selectedVehicles }),
    refetchInterval: 5000,
  });
  const stateQ = useQuery({
    queryKey: ['state-map'],
    queryFn: api.state,
    refetchInterval: 3000,
  });

  const { theme } = useTheme();
  const mapStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  const [tooltip, setTooltip] = useState<TooltipState>({ visit: null, x: 0, y: 0 });
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW);
  const [focusedVehicle, setFocusedVehicle] = useState<number | null>(null);
  const [driverPopup, setDriverPopup] = useState<DriverMarker | null>(null);
  const initialFittedRef = useRef(false);

  const visits = visitsQ.data ?? [];
  const appState = stateQ.data;

  const fitToVisits = useCallback((pts: Visit[], animate = true) => {
    if (!pts.length) return;
    const lons = pts.map(v => v.longitude).concat(DEPOT[0]);
    const lats = pts.map(v => v.latitude).concat(DEPOT[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const latSpan = Math.max(0.01, maxLat - minLat);
    const lonSpan = Math.max(0.01, maxLon - minLon);
    const span = Math.max(latSpan, lonSpan * Math.cos((minLat + maxLat) * Math.PI / 360));
    const zoom = Math.max(10, Math.min(14, Math.log2(360 / span) - 1.2));
    setViewState({
      longitude: (minLon + maxLon) / 2,
      latitude: (minLat + maxLat) / 2,
      zoom,
      pitch: 0,
      bearing: 0,
      ...(animate ? { transitionDuration: 500 } : {}),
    });
  }, []);

  // Fit UNA SOLA VEZ en el primer load. Después el usuario decide con los botones.
  useEffect(() => {
    if (initialFittedRef.current) return;
    if (visits.length === 0) return;
    initialFittedRef.current = true;
    fitToVisits(visits, false);
  }, [visits, fitToVisits]);

  // Driver live positions
  const driverMarkers = useMemo(() => {
    if (!appState?.sim_clock || !visits.length) return [];
    const simClock = new Date(appState.sim_clock);
    return computeDriverMarkers(visits, simClock, appState.today);
  }, [visits, appState?.sim_clock, appState?.today]);

  // Visible vehicles (si hay focus, solo ese)
  const visibleVisits = useMemo(() => {
    if (focusedVehicle == null) return visits;
    return visits.filter(v => v.vehicle_id === focusedVehicle);
  }, [visits, focusedVehicle]);

  const routes = useMemo(() => {
    const byVehicle: Record<number, Visit[]> = {};
    visibleVisits.forEach(v => {
      if (!byVehicle[v.vehicle_id]) byVehicle[v.vehicle_id] = [];
      byVehicle[v.vehicle_id].push(v);
    });
    return Object.entries(byVehicle).map(([vid, vs]) => {
      const sorted = [...vs].sort((a, b) => a.order - b.order);
      const path: [number, number][] = [
        DEPOT,
        ...sorted.map(v => [v.longitude, v.latitude] as [number, number]),
        DEPOT,
      ];
      return {
        vehicle_id: Number(vid),
        path,
        isFocused: focusedVehicle === Number(vid),
      };
    });
  }, [visibleVisits, focusedVehicle]);

  const layers = [
    new PathLayer({
      id: 'routes',
      data: routes,
      getPath: (d: any) => d.path,
      getColor: (d: any) => (d.isFocused ? [21, 147, 73, 200] : [96, 165, 250, focusedVehicle != null ? 30 : 80]),
      getWidth: (d: any) => (d.isFocused ? 4 : 2),
      widthMinPixels: 1,
    }),
    new ScatterplotLayer({
      id: 'visits',
      data: visibleVisits,
      getPosition: (d: Visit) => [d.longitude, d.latitude],
      getFillColor: (d: Visit) => colorByP(d.p_fallo),
      getRadius: (d: Visit) => 4 + d.p_fallo * 8,
      radiusUnits: 'pixels',
      radiusMinPixels: 4,
      radiusMaxPixels: 16,
      stroked: true,
      getLineColor: (d: Visit) => (d.alert_valuedata ? [167, 139, 250, 255] : [40, 40, 40, 160]),
      getLineWidth: (d: Visit) => (d.alert_valuedata ? 3 : 1),
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
      pickable: true,
      onHover: (info: any) => {
        if (info.object) setTooltip({ visit: info.object, x: info.x, y: info.y });
        else setTooltip({ visit: null, x: 0, y: 0 });
      },
    }),
    // Números de orden SOLO cuando hay un vehículo enfocado
    ...(focusedVehicle != null
      ? [
          new TextLayer({
            id: 'order-labels',
            data: visibleVisits,
            getPosition: (d: Visit) => [d.longitude, d.latitude],
            getText: (d: Visit) => String(d.order),
            getColor: (d: Visit) =>
              d.status === 'completed' ? [139, 152, 169, 255] : [21, 147, 73, 255],
            getSize: 11,
            getPixelOffset: [0, -14],
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            background: true,
            backgroundPadding: [2, 1],
            getBackgroundColor: [255, 255, 255, 220],
            getBorderColor: [218, 218, 218, 255],
            getBorderWidth: 1,
          }),
        ]
      : []),
    // Camión en vivo
    new IconLayer({
      id: 'drivers',
      data: driverMarkers,
      getPosition: (d: DriverMarker) => d.position,
      getIcon: () => 'truck',
      iconAtlas:
        'data:image/svg+xml;base64,' +
        btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
<circle cx="32" cy="32" r="22" fill="#ffffff" stroke="#159349" stroke-width="3"/>
<path d="M18 38 L18 28 L36 28 L36 24 L44 24 L48 28 L48 38 Z M18 38 L48 38"
 fill="#159349" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="25" cy="40" r="3" fill="#1d1d1b"/><circle cx="41" cy="40" r="3" fill="#1d1d1b"/>
</svg>`,
        ),
      iconMapping: { truck: { x: 0, y: 0, width: 64, height: 64, anchorY: 32 } },
      sizeScale: 1,
      getSize: (d: DriverMarker) => (focusedVehicle === d.vehicle_id ? 40 : 32),
      pickable: true,
      onClick: (info: any) => {
        if (info.object) {
          setFocusedVehicle(info.object.vehicle_id);
          setDriverPopup(info.object);
        }
      },
      onHover: (info: any) => {
        if (info.object) setDriverPopup(info.object);
      },
    }),
    new IconLayer({
      id: 'depot',
      data: [{ position: DEPOT }],
      getPosition: (d: any) => d.position,
      getIcon: () => 'depot',
      iconAtlas:
        'data:image/svg+xml;base64,' +
        btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="20" fill="#159349" stroke="#ffffff" stroke-width="3"/><text x="32" y="38" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#ffffff">D</text></svg>`,
        ),
      iconMapping: { depot: { x: 0, y: 0, width: 64, height: 64, anchorY: 32 } },
      sizeScale: 1,
      getSize: 30,
    }),
  ];

  const zoomBy = (delta: number) =>
    setViewState(vs => ({ ...vs, zoom: Math.max(4, Math.min(20, vs.zoom + delta)), transitionDuration: 200 }));

  const focusedDriver = focusedVehicle != null
    ? driverMarkers.find(d => d.vehicle_id === focusedVehicle) ?? null
    : null;
  const focusedSequence = useMemo(() => {
    if (focusedVehicle == null) return [];
    return [...visits.filter(v => v.vehicle_id === focusedVehicle)].sort((a, b) => a.order - b.order);
  }, [visits, focusedVehicle]);

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState as any}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        controller={{ dragRotate: false, touchRotate: false } as any}
        layers={layers}
      >
        <Map mapStyle={mapStyle} attributionControl={false} />
      </DeckGL>

      {/* Controles de cámara */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 bg-bg-800/95 border border-line rounded-md shadow-lg overflow-hidden">
        <button className="w-8 h-8 flex items-center justify-center hover:bg-bg-700 text-text-secondary hover:text-brand" onClick={() => zoomBy(1)} title="Zoom +">
          <Plus size={14} />
        </button>
        <div className="h-px bg-line" />
        <button className="w-8 h-8 flex items-center justify-center hover:bg-bg-700 text-text-secondary hover:text-brand" onClick={() => zoomBy(-1)} title="Zoom -">
          <Minus size={14} />
        </button>
        <div className="h-px bg-line" />
        <button
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-700 text-text-secondary hover:text-brand"
          onClick={() => fitToVisits(focusedSequence.length ? focusedSequence : visits, true)}
          disabled={!visits.length}
          title="Encuadrar visitas visibles"
        >
          <Maximize2 size={14} />
        </button>
        <div className="h-px bg-line" />
        <button
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-700 text-text-secondary hover:text-brand"
          onClick={() => setViewState({ ...INITIAL_VIEW, transitionDuration: 400 })}
          title="Volver al depot (Santiago)"
        >
          <Home size={14} />
        </button>
        <div className="h-px bg-line" />
        <button
          className="w-8 h-8 flex items-center justify-center hover:bg-bg-700 text-text-secondary hover:text-brand"
          onClick={() => {
            const focus = visits.filter(v => v.p_fallo >= 0.3 || v.alert_slack === 'RED');
            fitToVisits(focus.length ? focus : visits, true);
          }}
          disabled={!visits.length}
          title="Enfocar zonas en riesgo"
        >
          <Crosshair size={14} />
        </button>
      </div>

      {/* Panel de conductor enfocado */}
      {focusedDriver && (
        <div className="absolute top-3 left-3 w-72 bg-bg-800/95 border border-line rounded-md shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <div>
              <div className="text-xs font-semibold text-brand">🚚 {focusedDriver.vehicle_name}</div>
              <div className="text-[10px] text-text-muted">
                {focusedDriver.completedStops}/{focusedDriver.totalStops} entregas · {focusedDriver.progressPct}% al próximo
              </div>
            </div>
            <button
              onClick={() => { setFocusedVehicle(null); setDriverPopup(null); }}
              className="text-text-muted hover:text-accent-red"
              title="Quitar foco"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto text-[11px]">
            {focusedSequence.map(v => (
              <div
                key={v.tracking_id}
                className={`px-3 py-1.5 border-b border-line/50 flex items-center gap-2 ${
                  v.status === 'completed' ? 'opacity-60' : ''
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-semibold ${
                    v.status === 'completed'
                      ? 'bg-bg-700 text-text-muted'
                      : v.alert_valuedata
                      ? 'bg-accent-violet/20 text-accent-violet'
                      : v.p_fallo >= 0.5
                      ? 'bg-accent-red/20 text-accent-red'
                      : v.p_fallo >= 0.2
                      ? 'bg-accent-yellow/20 text-accent-yellow'
                      : 'bg-brand/20 text-brand'
                  }`}
                >
                  {v.order}
                </span>
                <span className="flex-1 truncate">{v.title}</span>
                <span className="text-text-muted tabular-nums">{v.estimated_time_arrival.slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tooltip visita (scatterplot) */}
      {tooltip.visit && (
        <div
          className="absolute z-10 bg-bg-800 border border-line rounded-md p-2 text-xs pointer-events-none shadow-xl text-text-primary"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 260 }}
        >
          <div className="font-semibold text-text-primary mb-1">{tooltip.visit.title}</div>
          <div className="text-text-muted">{tooltip.visit.vehicle_name} · #{tooltip.visit.order}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
            <div className="text-text-muted">Window end</div><div className="text-right">{tooltip.visit.window_end}</div>
            <div className="text-text-muted">ETA</div><div className="text-right">{tooltip.visit.estimated_time_arrival}</div>
            <div className="text-text-muted">P(fallo)</div>
            <div className={`text-right font-semibold ${
              tooltip.visit.p_fallo >= 0.5 ? 'text-accent-red'
              : tooltip.visit.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'
            }`}>
              {(tooltip.visit.p_fallo * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Tooltip camión */}
      {driverPopup && !focusedDriver && (
        <div className="absolute bottom-3 right-3 bg-bg-800 border border-brand rounded-md p-2 text-xs shadow-xl">
          <div className="font-semibold text-brand">🚚 {driverPopup.vehicle_name}</div>
          <div className="text-text-muted text-[10px]">
            {driverPopup.completedStops}/{driverPopup.totalStops} entregas
          </div>
          {driverPopup.nextPending && (
            <div className="mt-1 text-[10px]">
              Próximo: <span className="text-text-primary">{driverPopup.nextPending.title}</span>
            </div>
          )}
          <div className="text-[9px] text-text-muted mt-1">Click para ver secuencia</div>
        </div>
      )}

      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 bg-bg-800/90 border border-line rounded p-2 text-[11px]">
      <div className="text-text-muted uppercase tracking-wider text-[9px] mb-1">P(fallo)</div>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#cc2222]" />≥ 50%</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#e69600]" />20-50%</span>
        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#159349]" />&lt; 20%</span>
        <span className="flex items-center gap-2 mt-1 pt-1 border-t border-line">
          <span className="w-3 h-3 rounded-full border-2 border-brand bg-white" />camión en vivo
        </span>
      </div>
    </div>
  );
}
