/**
 * PilotoMap — mapa simplificado del módulo Piloto (Fase 3).
 *
 * Renderiza únicamente los drivers del piloto activo como un ScatterplotLayer
 * coloreado por status, con un TextLayer arriba mostrando el primer nombre del
 * driver. Independiente del MapaOperacional (no comparte filtros ni capas) para
 * mantener el módulo Piloto desacoplado.
 *
 * Tile provider: si VITE_MAPTILER_KEY está seteada usa MapTiler streets-v2;
 * fallback a CartoDB positron (sin auth). Mismo patrón que OperationsMap.tsx
 * para mantener la UX visual consistente.
 */
import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { Map, NavigationControl } from 'react-map-gl/maplibre';
import type { DriverPosition } from '../../api';

// Centro Santiago — fallback si no hay drivers con coords.
const DEPOT: [number, number] = [-70.6483, -33.4569];

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
const MAP_STYLE = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

type Color = [number, number, number, number];

function colorByStatus(status: DriverPosition['status']): Color {
  switch (status) {
    case 'finalizado': return [34, 197, 94, 220];   // verde
    case 'en_ruta':    return [59, 130, 246, 230];  // azul
    case 'detenido':   return [234, 179, 8, 230];   // ámbar
    case 'sin_inicio':
    default:           return [148, 163, 184, 180]; // gris
  }
}

export interface PilotoMapProps {
  positions: DriverPosition[];
}

export function PilotoMap({ positions }: PilotoMapProps) {
  // Filtramos drivers sin coords — no podemos renderizar lat/lng null.
  const drawable = useMemo(
    () => positions.filter(
      d => typeof d.lat === 'number' && typeof d.lng === 'number'
        && Number.isFinite(d.lat) && Number.isFinite(d.lng),
    ),
    [positions],
  );

  // View inicial: centramos en el centroide de los drivers; si no hay, depot.
  const initialView = useMemo(() => {
    if (drawable.length === 0) {
      return { longitude: DEPOT[0], latitude: DEPOT[1], zoom: 10, pitch: 0, bearing: 0 };
    }
    const sumLng = drawable.reduce((s, d) => s + (d.lng as number), 0);
    const sumLat = drawable.reduce((s, d) => s + (d.lat as number), 0);
    return {
      longitude: sumLng / drawable.length,
      latitude: sumLat / drawable.length,
      zoom: 10,
      pitch: 0,
      bearing: 0,
    };
  }, [drawable]);

  const layers = useMemo(() => [
    new ScatterplotLayer<DriverPosition>({
      id: 'pilot-drivers',
      data: drawable,
      getPosition: (d) => [d.lng as number, d.lat as number],
      getRadius: 80,
      getFillColor: (d) => colorByStatus(d.status),
      radiusMinPixels: 8,
      radiusMaxPixels: 24,
      pickable: true,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: [255, 255, 255, 200],
    }),
    new TextLayer<DriverPosition>({
      id: 'pilot-drivers-labels',
      data: drawable,
      getPosition: (d) => [d.lng as number, d.lat as number],
      getText: (d) => (d.driver_name?.split(' ')[0] ?? '').slice(0, 12),
      getSize: 11,
      getColor: [255, 255, 255, 230],
      getPixelOffset: [0, -22],
      fontFamily: 'Inter, system-ui, sans-serif',
      pickable: false,
    }),
  ], [drawable]);

  return (
    <div className="relative h-[420px] w-full rounded-md overflow-hidden border border-line/60">
      <DeckGL
        initialViewState={initialView as any}
        controller={{ dragRotate: false, touchRotate: false } as any}
        layers={layers}
        getTooltip={({ object }: { object?: DriverPosition }) => {
          if (!object) return null;
          return {
            text:
              `${object.driver_name ?? object.driver_id}\n` +
              `Status: ${object.status}\n` +
              `Pending: ${object.pending_count} · Done: ${object.completed_count}` +
              (object.next_visit_title ? `\nNext: ${object.next_visit_title}` : ''),
            style: {
              backgroundColor: '#1f2937',
              color: '#fff',
              fontSize: '11px',
              borderRadius: '4px',
              padding: '6px 8px',
            },
          };
        }}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={false}>
          <NavigationControl position="top-right" showCompass={false} />
        </Map>
      </DeckGL>

      {drawable.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-bg-800/85 border border-line rounded-md px-3 py-2 text-[11px] text-text-muted">
            Sin drivers en posición para esta fecha.
          </div>
        </div>
      )}
    </div>
  );
}
