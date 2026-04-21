import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer, IconLayer } from '@deck.gl/layers';
import { Map } from 'react-map-gl/maplibre';
import { api } from '../api';
import { Visit } from '../types';
import { useTheme } from '../hooks/useTheme';

const DEPOT: [number, number] = [-70.66, -33.45]; // [lon, lat]

const INITIAL_VIEW = {
  longitude: DEPOT[0],
  latitude: DEPOT[1],
  zoom: 9.5,
  pitch: 0,
  bearing: 0,
};

// Carto basemap (no token needed) - theme-aware
const MAP_STYLE_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function colorByP(p: number): [number, number, number, number] {
  if (p >= 0.5) return [239, 68, 68, 230]; // red
  if (p >= 0.2) return [251, 191, 36, 220]; // yellow
  return [231, 236, 243, 200]; // soft white
}

function radiusByP(p: number): number {
  return 100 + 250 * p;
}

interface TooltipState {
  visit: Visit | null;
  x: number;
  y: number;
}

export function OperationsMap({ selectedVehicles }: { selectedVehicles: number[] }) {
  const visitsQ = useQuery({
    queryKey: ['visits-map', selectedVehicles],
    queryFn: () => api.visits({ vehicle_ids: selectedVehicles }),
    refetchInterval: 5000,
  });

  const { theme } = useTheme();
  const mapStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  const [tooltip, setTooltip] = useState<TooltipState>({ visit: null, x: 0, y: 0 });

  const visits = visitsQ.data ?? [];

  // Build route paths per vehicle
  const routes = useMemo(() => {
    const byVehicle: Record<number, Visit[]> = {};
    visits.forEach(v => {
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
      return { vehicle_id: Number(vid), path };
    });
  }, [visits]);

  const layers = [
    new PathLayer({
      id: 'routes',
      data: routes,
      getPath: (d: any) => d.path,
      getColor: [96, 165, 250, 60],
      getWidth: 2,
      widthMinPixels: 1,
    }),
    new ScatterplotLayer({
      id: 'visits',
      data: visits,
      getPosition: (d: Visit) => [d.longitude, d.latitude],
      getFillColor: (d: Visit) => colorByP(d.p_fallo),
      getRadius: (d: Visit) => radiusByP(d.p_fallo),
      stroked: true,
      getLineColor: (d: Visit) => (d.alert_valuedata ? [167, 139, 250, 255] : [40, 40, 40, 200]),
      getLineWidth: (d: Visit) => (d.alert_valuedata ? 4 : 1),
      lineWidthMinPixels: 1,
      lineWidthUnits: 'pixels',
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setTooltip({ visit: info.object, x: info.x, y: info.y });
        } else {
          setTooltip({ visit: null, x: 0, y: 0 });
        }
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
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="20" fill="#60a5fa" stroke="#0a0e14" stroke-width="3"/><text x="32" y="38" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold" fill="#0a0e14">D</text></svg>`,
        ),
      iconMapping: { depot: { x: 0, y: 0, width: 64, height: 64, anchorY: 32 } },
      sizeScale: 1,
      getSize: 28,
    }),
  ];

  return (
    <div className="relative w-full h-full">
      <DeckGL initialViewState={INITIAL_VIEW} controller={true} layers={layers}>
        <Map mapStyle={mapStyle} attributionControl={false} />
      </DeckGL>

      {tooltip.visit && (
        <div
          className="absolute z-10 bg-bg-800 border border-line rounded-md p-2 text-xs pointer-events-none shadow-xl text-text-primary"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 260 }}
        >
          <div className="font-semibold text-text-primary mb-1">{tooltip.visit.title}</div>
          <div className="text-text-muted">FAL-{1000 + tooltip.visit.vehicle_id - 1} · #{tooltip.visit.order}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
            <div className="text-text-muted">Window end</div>
            <div className="text-right">{tooltip.visit.window_end}</div>
            <div className="text-text-muted">ETA</div>
            <div className="text-right">{tooltip.visit.estimated_time_arrival}</div>
            <div className="text-text-muted">Slack</div>
            <div
              className={`text-right ${
                tooltip.visit.slack_min < 0
                  ? 'text-accent-red'
                  : tooltip.visit.slack_min < 20
                  ? 'text-accent-yellow'
                  : 'text-accent-green'
              }`}
            >
              {tooltip.visit.slack_min.toFixed(1)} min
            </div>
            <div className="text-text-muted">P(fallo)</div>
            <div
              className={`text-right font-semibold ${
                tooltip.visit.p_fallo >= 0.5
                  ? 'text-accent-red'
                  : tooltip.visit.p_fallo >= 0.2
                  ? 'text-accent-yellow'
                  : 'text-text-secondary'
              }`}
            >
              {(tooltip.visit.p_fallo * 100).toFixed(1)}%
            </div>
          </div>
          {tooltip.visit.alert_valuedata && (
            <div className="mt-2 text-[10px] uppercase tracking-wider text-accent-violet">
              ⚡ Alerta anticipada VD
            </div>
          )}
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
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#ef4444]" />≥ 50%
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#fbbf24]" />20-50%
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#e7ecf3]" />&lt; 20%
        </span>
        <span className="flex items-center gap-2 mt-1 pt-1 border-t border-line">
          <span className="w-3 h-3 rounded-full border-2 border-accent-violet" />
          alerta VD
        </span>
      </div>
    </div>
  );
}
