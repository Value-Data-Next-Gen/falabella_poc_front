import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { Map, NavigationControl, FullscreenControl, GeolocateControl } from 'react-map-gl/maplibre';
import { Crosshair, Home, Maximize2, Minus, Plus, X, Filter, ChevronDown } from 'lucide-react';
import { api, type DriverPosition } from '../api';
import { RegionFilter, Visit } from '../types';
import { useTheme } from '../hooks/useTheme';
import { isLatLonInRegion, routeColorByVehicle } from '../lib/regiones';
import { useOperacionStore } from '../stores/useOperacionStore';

// Centro Santiago. Mantenemos este punto como "home" del mapa y fallback del
// driver_sim cuando no hay CD asignado. Los CDs reales por región vienen del
// endpoint /api/centros-distribucion (CR-002).
const DEPOT: [number, number] = [-70.6483, -33.4569]; // [lon, lat]

// Bounding box de Chile continental + insular para filtrar coords inválidas
// que aparecen sobre el océano. Cualquier visita con (lat,lon) fuera de este
// rango se descarta antes de renderizar.
const CHILE_BBOX = { latMin: -56.5, latMax: -17.5, lonMin: -76.0, lonMax: -66.0 };
function isValidLatLon(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 && lon === 0) return false;
  return (
    lat >= CHILE_BBOX.latMin && lat <= CHILE_BBOX.latMax &&
    lon >= CHILE_BBOX.lonMin && lon <= CHILE_BBOX.lonMax
  );
}

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

// Tiles MapTiler. Si VITE_MAPTILER_KEY no está seteada, caemos a CartoDB
// (sin auth, calidad menor). Default style: bright-v2 (claro) y streets-v2-dark.
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
const MAP_STYLE_DARK = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const MAP_STYLE_LIGHT = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/bright-v2/style.json?key=${MAPTILER_KEY}`
  : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

// Distancia máxima en KM entre dos stops consecutivos para que se permita
// dibujar una línea entre ellos. Si una ruta planificada tiene dos stops a
// más de esta distancia, asumimos que son sub-rutas de regiones distintas
// pegadas erróneamente bajo el mismo vehicle_id, y partimos el path en lugar
// de conectarlos con una línea recta cruzando el país.
// 100 km es agresivo a propósito: Santiago↔Valparaíso son ~120 km y son
// regiones distintas, así que esa diagonal histórica también queda cortada.
const MAX_LEG_KM = 100;

/** Distancia esférica simple Haversine. lat/lon en grados. Devuelve km. */
function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const [lonA, latA] = a;
  const [lonB, latB] = b;
  const R = 6371;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Parte un array de puntos en sub-paths cuando hay un salto > MAX_LEG_KM. */
function splitPathByLongJumps(points: [number, number][]): [number, number][][] {
  if (points.length < 2) return points.length ? [points] : [];
  const out: [number, number][][] = [];
  let current: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const jump = distanceKm(points[i - 1], points[i]);
    if (jump > MAX_LEG_KM) {
      if (current.length >= 2) out.push(current);
      current = [points[i]];
    } else {
      current.push(points[i]);
    }
  }
  if (current.length >= 2) out.push(current);
  return out;
}

function colorByP(p: number): [number, number, number, number] {
  if (p >= 0.5) return [204, 34, 34, 230];
  if (p >= 0.2) return [230, 150, 0, 220];
  return [21, 147, 73, 200];
}

function parseHHMMSS(date: string, hms: string): Date {
  return new Date(`${date}T${hms}`);
}

// Visit extendido para el mapa: preserva el status 'failed' del backend
// (el Visit canónico solo tiene 'pending'|'completed') y agrega flag `vip`
// para los pins. Solo se usa en este componente.
type VisitMap = Omit<Visit, 'status'> & {
  status: 'pending' | 'completed' | 'failed';
  vip: boolean;
};

interface TooltipState {
  visit: VisitMap | null;
  x: number;
  y: number;
}

interface DriverMarker {
  vehicle_id: number;
  vehicle_name: string;
  position: [number, number];
  lastCompleted: VisitMap | null;
  nextPending: VisitMap | null;
  progressPct: number;
  totalStops: number;
  completedStops: number;
}

function computeDriverMarkers(visits: VisitMap[], simClock: Date, today: string): DriverMarker[] {
  const byVehicle: Record<number, VisitMap[]> = {};
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

export function OperationsMap({
  selectedVehicles,
  externalRegion,
  externalEmpresaId,
  externalDriverName,
  externalRutaId,
  externalOnlyVip,
  plannedDate,
}: {
  selectedVehicles: number[];
  /** Filtros propagados desde el contenedor (MapaTab). Si no vienen, el mapa
   * usa state local. Sin esto era imposible que los dropdowns del header del
   * módulo Operación controlaran el mapa. */
  externalRegion?: RegionFilter;
  externalEmpresaId?: number | null;
  externalDriverName?: string;
  externalRutaId?: string;
  externalOnlyVip?: boolean;
  /** Día operativo activo. Si viene, el mapa lee plan-diario REAL para esa
   * fecha (rutas del XLSX cargado por el usuario). Si no viene, cae al
   * snapshot sintético del simulador legacy. */
  plannedDate?: string | null;
}) {
  const [regionLocal, setRegion] = useState<RegionFilter>('all');
  const region = externalRegion ?? regionLocal;
  const [empresaFilterLocal, setEmpresaFilter] = useState<Set<number>>(new Set());
  const empresaFilter = externalEmpresaId != null
    ? new Set([externalEmpresaId])
    : empresaFilterLocal;
  const [plateFilter, setPlateFilter] = useState<Set<string>>(new Set());
  const [rutaFilterLocal, setRutaFilter] = useState<string>('');
  const rutaFilter = externalRutaId ?? rutaFilterLocal;
  const [driverFilterLocal, setDriverFilter] = useState<string>('');
  const driverFilter = externalDriverName ?? driverFilterLocal;
  const [onlyVipLocal, setOnlyVip] = useState<boolean>(false);
  const onlyVip = externalOnlyVip ?? onlyVipLocal;
  const [filterOpen, setFilterOpen] = useState(false);

  // P2: el panel duplicado de filtros que renderizaba este componente confundía
  // al usuario cuando el contenedor (MapaTab) ya pasaba sus propios filtros
  // por props external*. Los selects internos llamaban a setLocal* pero `value`
  // se computa con `external ?? local`, así que el cambio se ignoraba (los
  // dropdowns parecían rotos). Si llega cualquier external*, asumimos que el
  // contenedor ya tiene UI de filtros y ocultamos la flotante del mapa.
  const hasExternalFilters =
    externalRegion !== undefined ||
    externalEmpresaId !== undefined ||
    externalDriverName !== undefined ||
    externalRutaId !== undefined ||
    externalOnlyVip !== undefined;

  const stateQ = useQuery({
    queryKey: ['state-map'],
    queryFn: api.state,
    refetchInterval: 3000,
  });

  // Catálogos para los selects
  const empresasQ = useQuery({
    queryKey: ['empresa-contactos-empresas'],
    queryFn: api.empresaContactos.listEmpresas,
  });
  const fleetQ = useQuery({ queryKey: ['fleet-vehicles-map'], queryFn: api.fleetVehicles });
  // CR-012 Fix V2: queryKey CANÓNICO ['plan-diario', fecha, empresaId, region, onlyVip].
  // El mapa recibe los 4 params del padre vía externalEmpresaId/Region/OnlyVip,
  // así el queryKey coincide exactamente con el de OperacionModuleV2 →
  // 1 sola request hidratada en cache.
  const _planEmpresaId = externalEmpresaId ?? null;
  const _planRegion = externalRegion ?? 'all';
  const _planOnlyVip = externalOnlyVip ?? false;
  const planQ = useQuery({
    queryKey: ['plan-diario', plannedDate, _planEmpresaId, _planRegion, _planOnlyVip],
    queryFn: () => api.planDiario({
      empresa_id: _planEmpresaId ?? undefined,
      region: _planRegion,
      only_vip: _planOnlyVip,
      source: plannedDate ? 'real' : 'synthetic',
      planned_date: plannedDate ?? undefined,
    }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!plannedDate,
  });

  // Posiciones reales de los drivers (Fase 3: shape flat). Devuelve
  // DriverPosition[] con {driver_id, driver_name, vehicle_id, lat, lng, status,
  // next_visit_*, completed_count, pending_count}. Sustituye la interpolación
  // cliente-side (computeDriverMarkers) que dependía de sim_clock +
  // estimated_time_arrival de visits sintéticos.
  // CR-012 Fix V2: queryKey CANÓNICO ['driver-positions', fecha, empresaId]
  // compartido con DriversAvancePanel y MapaFoliosTable. Resultado: 1 fetch
  // cada 10s sirve a los 3 consumidores (antes eran 3 fetches separados).
  const _dpEmpresaId = externalEmpresaId ?? null;
  const driverPositionsQ = useQuery({
    queryKey: ['driver-positions', plannedDate, _dpEmpresaId],
    queryFn: () => plannedDate
      ? api.operacion.driverPositions(plannedDate, _dpEmpresaId)
      : Promise.resolve([] as DriverPosition[]),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!plannedDate,
  });

  // Centros de distribución regionales (donde arrancan las rutas). Sustituyen
  // el DEPOT único hardcodeado en Santiago. Cache largo: rara vez cambian.
  const cdsQ = useQuery({
    queryKey: ['centros-distribucion'],
    queryFn: () => api.centrosDistribucion.list(),
    staleTime: 5 * 60_000,
  });

  const { theme } = useTheme();
  const mapStyle = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;

  const [tooltip, setTooltip] = useState<TooltipState>({ visit: null, x: 0, y: 0 });
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW);
  const [focusedVehicle, setFocusedVehicle] = useState<number | null>(null);
  const [driverPopup, setDriverPopup] = useState<DriverMarker | null>(null);
  const initialFittedRef = useRef(false);

  // [Tarea 5] Sync con sidebar via zustand. hover y selected vienen del store
  // para que el mapa atenúe rutas no relacionadas. Click en pin actualiza
  // selectedDriver y pide scrollIntoView en el sidebar.
  const hoveredDriverId = useOperacionStore(s => s.hoveredDriverId);
  const selectedDriverId = useOperacionStore(s => s.selectedDriverId);
  const setSelectedDriver = useOperacionStore(s => s.setSelectedDriver);
  const setHoveredDriver = useOperacionStore(s => s.setHoveredDriver);
  const setSelectedVisita = useOperacionStore(s => s.setSelectedVisita);
  const setHoveredVisita = useOperacionStore(s => s.setHoveredVisita);
  const requestScrollToDriver = useOperacionStore(s => s.requestScrollToDriver);

  // allVisits: derivado del plan-diario REAL (Sprint 6). Cada PlanVisit hereda
  // vehicle_id/vehicle_name de su PlanRuta, y latitude/longitude del centroide
  // de comuna (jitter determinístico por tracking_id en backend). Antes esto
  // venía de /api/visits (synthetic legacy) con IDs que NO matcheaban el plan
  // real cargado por XLSX, por eso el mapa se veía vacío al filtrar por ruta.
  const allVisits: VisitMap[] = useMemo(() => {
    const out: VisitMap[] = [];
    (planQ.data?.empresas ?? []).forEach(emp => {
      emp.rutas.forEach(r => {
        if (r.vehicle_id == null) return;
        const driverLabel = r.driver_name ?? r.vehicle_name ?? `Vehículo ${r.vehicle_id}`;
        r.visitas?.forEach(v => {
          // status preserva 'failed' (Tarea 2: necesario para color del pin).
          const status: 'pending' | 'completed' | 'failed' =
            v.status === 'failed' ? 'failed' :
            v.status === 'pending' ? 'pending' : 'completed';
          out.push({
            tracking_id: v.tracking_id,
            vehicle_id: r.vehicle_id,
            vehicle_name: driverLabel,
            order: v.order,
            title: v.title,
            address: v.address ?? '',
            latitude: v.latitude ?? 0,
            longitude: v.longitude ?? 0,
            load: 0,
            window_start: v.window_start ?? '',
            window_end: v.window_end ?? '',
            planned_arrival_time: v.planned_arrival_time ?? '',
            estimated_time_arrival: v.estimated_time_arrival ?? '',
            slack_min: v.slack_min ?? 0,
            alert_slack: (v.alert_slack ?? 'GREEN') as 'GREEN' | 'YELLOW' | 'RED',
            p_fallo: v.p_fallo ?? 0,
            alert_valuedata: v.alert_valuedata ?? false,
            status,
            vip: !!v.is_vip,
            horas_hasta_window_end: 0,
          });
        });
      });
    });
    return out;
  }, [planQ.data]);
  const appState = stateQ.data;

  // Mapping vehicle_id -> plate (para filtrar por patente)
  const plateByVid = useMemo(() => {
    const m: Record<number, string> = {};
    fleetQ.data?.forEach(v => { m[v.vehicle_id] = v.plate; });
    return m;
  }, [fleetQ.data]);

  // R7-P4: derivamos del plan-diario el mapping vehicle_id → {empresa_id, ruta_id}
  // y el set de tracking_ids VIP. Y armamos catálogos legibles (con nombres) para
  // los dropdowns: rutas y drivers con etiquetas.
  const {
    empresaByVid, rutaByVid, driverByVid, regionByVid, vipTrackingSet,
    rutaOptions, driverOptions,
  } = useMemo(() => {
    const empresaByVid: Record<number, number> = {};
    const rutaByVid: Record<number, string> = {};
    const driverByVid: Record<number, string> = {};
    const regionByVid: Record<number, string> = {};
    const vipTrackingSet = new Set<string>();
    type RutaOpt = { ruta_id: string; driver_name: string; empresa_nombre: string; total: number };
    const rutasMap: Record<string, RutaOpt> = {};
    const driversSet = new Set<string>();
    (planQ.data?.empresas ?? []).forEach(emp => {
      emp.rutas.forEach(r => {
        if (r.vehicle_id != null) {
          empresaByVid[r.vehicle_id] = emp.empresa_id;
          if (r.ruta_id) rutaByVid[r.vehicle_id] = r.ruta_id;
          if (r.driver_name) driverByVid[r.vehicle_id] = r.driver_name;
          if (r.region) regionByVid[r.vehicle_id] = r.region;
        }
        if (r.ruta_id) {
          rutasMap[r.ruta_id] = {
            ruta_id: r.ruta_id,
            driver_name: r.driver_name ?? '—',
            empresa_nombre: emp.empresa_nombre ?? '—',
            total: r.total_visitas ?? 0,
          };
        }
        if (r.driver_name) driversSet.add(r.driver_name);
        r.visitas?.forEach(v => { if (v.is_vip) vipTrackingSet.add(v.tracking_id); });
      });
    });
    return {
      empresaByVid, rutaByVid, driverByVid, regionByVid, vipTrackingSet,
      rutaOptions: Object.values(rutasMap).sort((a, b) => a.ruta_id.localeCompare(b.ruta_id)),
      driverOptions: Array.from(driversSet).sort(),
    };
  }, [planQ.data]);

  // Filtros del mapa. Aplicación:
  //  1. coordenadas inválidas (fuera del bbox de Chile) → fuera.
  //  2. empresa elegida → solo vehículos de esa empresa.
  //  3. ruta elegida → solo el vehículo de esa ruta.
  //  4. patente elegida → match por placa.
  //  5. onlyVip → solo visitas marcadas VIP en plan-diario.
  const visits = useMemo(() => {
    let out = allVisits.filter(v => isValidLatLon(v.latitude, v.longitude));
    // Filtros que antes hacía el server vía /api/visits — ahora client-side
    // porque allVisits viene del plan-diario completo.
    if (selectedVehicles.length > 0) {
      const allowed = new Set(selectedVehicles);
      out = out.filter(v => allowed.has(v.vehicle_id));
    }
    if (region === 'RM') {
      out = out.filter(v => isLatLonInRegion(v.latitude, v.longitude, 'RM'));
    } else if (region === 'regiones') {
      out = out.filter(v => !isLatLonInRegion(v.latitude, v.longitude, 'RM'));
    } else if (region !== 'all') {
      out = out.filter(v => isLatLonInRegion(v.latitude, v.longitude, region));
    }
    // [CR-001] Sacado el filtro R8 (descartar stops cuya región no matchee la
    // dominante de la ruta). Era contraproducente con el plan REAL: si una
    // ruta legítimamente tenía stops mezclados en RM + Valparaíso, descartaba
    // la mitad. Para los saltos largos confiamos en splitPathByLongJumps que
    // corta el dibujo del path (no oculta los pines).
    if (empresaFilter.size > 0) {
      out = out.filter(v => {
        const eid = empresaByVid[v.vehicle_id];
        return eid != null && empresaFilter.has(eid);
      });
    }
    if (rutaFilter) {
      out = out.filter(v => rutaByVid[v.vehicle_id] === rutaFilter);
    }
    if (driverFilter) {
      out = out.filter(v => driverByVid[v.vehicle_id] === driverFilter);
    }
    if (plateFilter.size > 0) {
      out = out.filter(v => plateByVid[v.vehicle_id] && plateFilter.has(plateByVid[v.vehicle_id]));
    }
    if (onlyVip) {
      out = out.filter(v => vipTrackingSet.has(v.tracking_id));
    }
    return out;
  }, [allVisits, selectedVehicles, region, plateFilter, empresaFilter, rutaFilter, driverFilter, onlyVip, plateByVid, empresaByVid, rutaByVid, driverByVid, regionByVid, vipTrackingSet]);

  const activeFilterCount =
    (region !== 'all' ? 1 : 0) +
    (plateFilter.size > 0 ? 1 : 0) +
    (empresaFilter.size > 0 ? 1 : 0) +
    (rutaFilter ? 1 : 0) +
    (driverFilter ? 1 : 0) +
    (onlyVip ? 1 : 0);

  const fitToVisits = useCallback((pts: VisitMap[], animate = true) => {
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
    // min 3 (cabe el país si las visitas están dispersas en regiones), max 14
    // (no zoomear más allá de barrio).
    const zoom = Math.max(3, Math.min(14, Math.log2(360 / span) - 1.2));
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

  // R7-P4: al elegir una ruta en el dropdown, autofocus al vehículo de esa ruta
  // (aparecen los números de orden + panel lateral con la secuencia). Y
  // encuadramos a esos stops.
  // FIX re-render: usamos un ref con el último rutaFilter para el que ya
  // hicimos fit. Sin esto, cada poll de planQ (10s) recomputa `visits` →
  // dispara el efecto → reencuadra → "el mapa se recarga al filtrar".
  const lastFittedRutaRef = useRef<string | null>(null);
  useEffect(() => {
    if (!rutaFilter) {
      lastFittedRutaRef.current = null;
      return;
    }
    if (lastFittedRutaRef.current === rutaFilter) return;
    const match = Object.entries(rutaByVid).find(([, rid]) => rid === rutaFilter);
    if (!match) return;
    const vid = Number(match[0]);
    setFocusedVehicle(vid);
    const stops = visits.filter(v => v.vehicle_id === vid);
    if (stops.length) {
      fitToVisits(stops, true);
      lastFittedRutaRef.current = rutaFilter;
    }
  }, [rutaFilter, rutaByVid, visits, fitToVisits]);

  // Driver live positions — fuente real (Fase 3 shape flat) cuando hay
  // plannedDate. Cae a la interpolación legacy si no hay data real.
  const driverMarkers = useMemo(() => {
    // Si hay posiciones reales del backend, las usamos directo.
    // Fase 3: el shape es flat (DriverPosition[]) con lat/lng + status +
    // completed_count/pending_count. Coercemos vehicle_id (string) a number
    // para mantener compat con selectedVehicles:number[] y el resto del módulo.
    const realDrivers = driverPositionsQ.data ?? [];
    if (realDrivers.length > 0) {
      const allowed = new Set(selectedVehicles);
      return realDrivers
        .filter((d: DriverPosition) => {
          if (d.lat == null || d.lng == null) return false;
          const vidNum = Number(d.vehicle_id);
          return selectedVehicles.length === 0 || allowed.has(vidNum);
        })
        .map((d: DriverPosition) => {
          const vidNum = Number(d.vehicle_id);
          // Próximo stop pendiente desde las visits del plan para este vehicle.
          const vehVisits = visits
            .filter(v => v.vehicle_id === vidNum)
            .sort((a, b) => a.order - b.order);
          const completed = vehVisits.filter(v => v.status === 'completed');
          const pending = vehVisits.filter(v => v.status === 'pending');
          const total = d.completed_count + d.pending_count;
          return {
            vehicle_id: vidNum,
            vehicle_name: d.driver_name ?? `Vehículo ${d.vehicle_id}`,
            position: [d.lng as number, d.lat as number] as [number, number],
            lastCompleted: completed[completed.length - 1] ?? null,
            nextPending: pending[0] ?? null,
            progressPct: total > 0 ? Math.round((d.completed_count / total) * 100) : 0,
            totalStops: total,
            completedStops: d.completed_count,
          };
        });
    }
    // Fallback: interpolación legacy desde sim_clock (modo sintético)
    if (!appState?.sim_clock || !visits.length) return [];
    const simClock = new Date(appState.sim_clock);
    return computeDriverMarkers(visits, simClock, appState.today);
  }, [driverPositionsQ.data, selectedVehicles, visits, appState?.sim_clock, appState?.today]);

  // Visible vehicles (si hay focus, solo ese)
  const visibleVisits = useMemo(() => {
    if (focusedVehicle == null) return visits;
    return visits.filter(v => v.vehicle_id === focusedVehicle);
  }, [visits, focusedVehicle]);

  const routes = useMemo(() => {
    const byVehicle: Record<number, VisitMap[]> = {};
    visibleVisits.forEach(v => {
      if (!byVehicle[v.vehicle_id]) byVehicle[v.vehicle_id] = [];
      byVehicle[v.vehicle_id].push(v);
    });
    // R7-P4: para cada vehículo, generamos UNA O VARIAS sub-rutas. Cada
    // sub-ruta es una secuencia de stops contiguos (saltos < MAX_LEG_KM
    // entre uno y el siguiente). Si dos stops consecutivos están a >150 km,
    // partimos el path en lugar de conectarlos con una línea cruzando el
    // país (esto pasaba con rutas que tenían un stop "fantasma" en RM por
    // datos sucios y el resto en Antofagasta/Biobío, etc.).
    const routesOut: { vehicle_id: number; path: [number, number][]; isFocused: boolean }[] = [];
    Object.entries(byVehicle).forEach(([vid, vs]) => {
      const sorted = [...vs].sort((a, b) => a.order - b.order);
      const points: [number, number][] = sorted.map(v => [v.longitude, v.latitude]);
      const segments = splitPathByLongJumps(points);
      const focused = focusedVehicle === Number(vid);
      segments.forEach(seg => {
        routesOut.push({ vehicle_id: Number(vid), path: seg, isFocused: focused });
      });
    });
    return routesOut;
  }, [visibleVisits, focusedVehicle]);

  const layers = [
    new PathLayer({
      id: 'routes',
      data: routes,
      getPath: (d: any) => d.path,
      // [Tarea 5] Color/ancho según hover+select+focus. Prioridad:
      //   1. selected: opacidad llena + width 4
      //   2. hovered: opacidad llena + width 5 (un toque más grueso para ver)
      //   3. focus filter activo en otra ruta: atenuar al 25%
      //   4. default: opacidad media
      getColor: (d: any) => {
        const vid = d.vehicle_id;
        const isSel = selectedDriverId === vid || focusedVehicle === vid;
        const isHov = hoveredDriverId === vid;
        const anyDriverActive = selectedDriverId != null || focusedVehicle != null;
        const alpha = isSel ? 240 : isHov ? 230 : anyDriverActive ? 50 : 180;
        return routeColorByVehicle(vid, alpha);
      },
      getWidth: (d: any) => {
        const isSel = selectedDriverId === d.vehicle_id || focusedVehicle === d.vehicle_id;
        const isHov = hoveredDriverId === d.vehicle_id;
        if (isHov) return 5;
        if (isSel) return 4;
        return 2;
      },
      widthMinPixels: 1,
      updateTriggers: {
        getColor: [hoveredDriverId, selectedDriverId, focusedVehicle],
        getWidth: [hoveredDriverId, selectedDriverId, focusedVehicle],
      },
    }),
    // [Tarea 2] Capa 1: Halo P(fallo). Radio + color interpolados por p_fallo
    // según el brief. Es la capa MÁS BAJA — los pins quedan encima nítidos.
    // Pulse animado para p_fallo>=0.5 → TODO(animation): requiere setInterval
    // que dispare re-render; lo dejo plano por ahora para no agregar overhead.
    new ScatterplotLayer({
      id: 'visit-halos',
      data: visibleVisits,
      getPosition: (d: VisitMap) => [d.longitude, d.latitude],
      getRadius: (d: VisitMap) => {
        const p = d.p_fallo;
        if (p <= 0) return 6;
        if (p <= 0.2) return 6 + (p / 0.2) * 4;        // 6→10
        if (p <= 0.5) return 10 + ((p - 0.2) / 0.3) * 6; // 10→16
        return 16 + Math.min(1, (p - 0.5) / 0.5) * 4;    // 16→20
      },
      getFillColor: (d: VisitMap): [number, number, number, number] => {
        const p = d.p_fallo;
        // Stops: 0=verde, 0.2=amber, 0.5=red, 1=dark-red. Alpha 64 (~0.25).
        if (p <= 0.2) {
          const t = p / 0.2;
          return [Math.round(16 + (245 - 16) * t), Math.round(185 + (158 - 185) * t),
                  Math.round(129 + (11 - 129) * t), 64];
        }
        if (p <= 0.5) {
          const t = (p - 0.2) / 0.3;
          return [Math.round(245 + (239 - 245) * t), Math.round(158 + (68 - 158) * t),
                  Math.round(11 + (68 - 11) * t), 64];
        }
        const t = Math.min(1, (p - 0.5) / 0.5);
        return [Math.round(239 + (220 - 239) * t), Math.round(68 + (38 - 68) * t),
                Math.round(68 + (38 - 68) * t), 64];
      },
      radiusUnits: 'pixels',
      stroked: false,
      filled: true,
      pickable: false,
    }),
    // [CR-012 T2] Capa 2a: Borde NARANJO para visitas con alert_valuedata
    // pero NO VIP. Brief: "VIP y alert_valuedata NO se superponen". Las que
    // son ambas se renderizan con el borde violeta (capa 2b) y el badge VD
    // se muestra en el drawer (T8), no en el pin.
    new ScatterplotLayer({
      id: 'visit-vd-ring',
      data: visibleVisits.filter(v => v.alert_valuedata && !v.vip),
      getPosition: (d: VisitMap) => [d.longitude, d.latitude],
      getRadius: 12,
      radiusUnits: 'pixels',
      stroked: true,
      filled: false,
      getLineColor: [251, 146, 60, 255], // naranjo (tw orange-400)
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      pickable: false,
    }),
    // [Tarea 2] Capa 2b: Borde VIP violeta. Si una visita es VIP+alert_valuedata
    // gana violeta (brief). El badge "VD" pequeño se agrega en el slide-over.
    new ScatterplotLayer({
      id: 'visit-vip-ring',
      data: visibleVisits.filter(v => v.vip),
      getPosition: (d: VisitMap) => [d.longitude, d.latitude],
      getRadius: 12,
      radiusUnits: 'pixels',
      stroked: true,
      filled: false,
      getLineColor: [139, 92, 246, 255],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      pickable: false,
    }),
    // [Tarea 2] Capa 3: Pin de la visita, coloreado por ESTADO.
    // pendiente=slate-400 / en_curso=blue-500 / ok=emerald-500 / fallida=red-500.
    // Para 'en_curso' usamos un proxy: la visita es 'pending' y es el next_pending
    // de un driver activo. Como no tenemos esa info acá, marcamos solo
    // pendiente/ok/fallida; el "en_curso" se ve por el camión arriba.
    new ScatterplotLayer({
      id: 'visit-pins',
      data: visibleVisits,
      getPosition: (d: VisitMap) => [d.longitude, d.latitude],
      getFillColor: (d: VisitMap): [number, number, number, number] => {
        if (d.status === 'failed') return [239, 68, 68, 255];        // red-500
        if (d.status === 'completed') return [16, 185, 129, 255];    // emerald-500
        return [148, 163, 184, 255];                                 // slate-400 (pending)
      },
      // [Tarea 5] Radio crece cuando el pin pertenece al driver hovered/selected.
      getRadius: (d: VisitMap) => {
        const isFocusedDriver = focusedVehicle === d.vehicle_id ||
          selectedDriverId === d.vehicle_id || hoveredDriverId === d.vehicle_id;
        return isFocusedDriver ? 10 : 7;
      },
      radiusUnits: 'pixels',
      stroked: true,
      getLineColor: [255, 255, 255, 230],
      getLineWidth: 1.5,
      lineWidthUnits: 'pixels',
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setTooltip({ visit: info.object, x: info.x, y: info.y });
          // Resaltar el driver de esta visita en el sidebar
          if (info.object.vehicle_id) setHoveredDriver(info.object.vehicle_id);
          // CR-012 T7: emite hover de visita para que Gantt resalte la parada
          if (info.object.tracking_id) setHoveredVisita(info.object.tracking_id);
        } else {
          setTooltip({ visit: null, x: 0, y: 0 });
          setHoveredDriver(null);
          setHoveredVisita(null);
        }
      },
      onClick: (info: any) => {
        // [Tarea 5] Click en pin → enfocar ese driver en mapa, fit a sus
        // stops, marcar selected en el store y pedir scrollIntoView en sidebar.
        // CR-012 T7+T8: además abre el slide-over de la visita.
        if (info.object?.vehicle_id) {
          const vid = info.object.vehicle_id as number;
          setFocusedVehicle(vid);
          setSelectedDriver(vid);
          requestScrollToDriver(vid);
          if (info.object.tracking_id) setSelectedVisita(info.object.tracking_id);
          const stops = visits.filter(v => v.vehicle_id === vid);
          if (stops.length) fitToVisits(stops, true);
        }
      },
      updateTriggers: {
        getRadius: [hoveredDriverId, selectedDriverId, focusedVehicle],
      },
    }),
    // [Tarea 2] Capa 4: Número de secuencia SIEMPRE visible (antes solo con
    // foco/filtro). Tamaño chico para no saturar; al hacer focus crece.
    new TextLayer({
      id: 'visit-order-labels',
      data: visibleVisits,
      getPosition: (d: VisitMap) => [d.longitude, d.latitude],
      getText: (d: VisitMap) => String(d.order),
      getColor: [255, 255, 255, 255],
      getSize: (d: VisitMap) => (focusedVehicle === d.vehicle_id ? 11 : 8),
      sizeUnits: 'pixels',
      fontFamily: 'JetBrains Mono, monospace',
      fontWeight: 700,
      background: false,
      pickable: false,
    }),
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
    // Centros de distribución (CDs) por región — origen de las rutas.
    // Cuadrado verde con "CD" en blanco, distinguible del camión circular.
    new IconLayer({
      id: 'centros-distribucion',
      data: cdsQ.data ?? [],
      getPosition: (d: any) => [d.lon, d.lat] as [number, number],
      getIcon: () => 'cd',
      iconAtlas:
        'data:image/svg+xml;base64,' +
        btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
<rect x="10" y="10" width="44" height="44" rx="4" fill="#159349" stroke="#ffffff" stroke-width="3"/>
<text x="32" y="40" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold" fill="#ffffff">CD</text>
</svg>`,
        ),
      iconMapping: { cd: { x: 0, y: 0, width: 64, height: 64, anchorY: 32 } },
      sizeScale: 1,
      getSize: 28,
      pickable: true,
      onHover: (info: any) => {
        // [CR-012 T4] Fix bug "window_end: Santiago". Antes inyectábamos cd.ciudad
        // en window_end para reusar el tooltip de visit — el usuario veía la
        // ciudad del CD en el campo "Window end" del tooltip. Lo dejamos vacío
        // y mostramos la ciudad en `title`. TODO(T8): cuando exista el slide-over
        // de Visita, crear un tooltip separado para CDs y borrar este shim.
        if (info.object) {
          const cd = info.object;
          setTooltip({
            visit: {
              tracking_id: `CD-${cd.cd_id}`,
              vehicle_id: 0,
              vehicle_name: cd.nombre,
              order: 0,
              title: `${cd.nombre} · ${cd.region} · ${cd.ciudad ?? ''}`.trim(),
              address: cd.ciudad ?? '',
              latitude: cd.lat,
              longitude: cd.lon,
              load: 0,
              window_start: '',
              window_end: '',
              planned_arrival_time: '',
              estimated_time_arrival: '',
              slack_min: 0,
              alert_slack: 'GREEN',
              p_fallo: 0,
              alert_valuedata: false,
              status: 'completed',
              vip: false,
              horas_hasta_window_end: 0,
            } as VisitMap,
            x: info.x, y: info.y,
          });
        } else {
          setTooltip({ visit: null, x: 0, y: 0 });
        }
      },
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
        <Map mapStyle={mapStyle} attributionControl={false}>
          <NavigationControl position="top-right" showCompass={false} />
          <FullscreenControl position="top-right" />
          <GeolocateControl position="top-right" trackUserLocation={false} />
        </Map>
      </DeckGL>

      {/* Header de filtros (top-left, sobre el mapa). Solo se muestra cuando
          el componente se usa standalone (sin contenedor que pase external*).
          Cuando MapaTab pasa filtros externos, este header duplicaba la UI y
          sus selects no propagaban cambios al padre. */}
      {!hasExternalFilters && (
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2 z-10 pointer-events-none">
        <div className="pointer-events-auto bg-bg-800/95 border border-line rounded-md shadow-lg p-1.5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`btn flex items-center gap-1 text-[11px] !py-1 !px-2 ${activeFilterCount > 0 ? 'bg-brand/20 text-brand border-brand/40' : ''}`}
            title="Filtros"
          >
            <Filter size={11} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-brand text-white rounded-full px-1.5 text-[9px] font-bold">{activeFilterCount}</span>
            )}
            <ChevronDown size={10} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Tabs región inline */}
          <div className="flex items-center gap-0 border border-line rounded overflow-hidden text-[11px]">
            {(['all', 'RM', 'regiones'] as RegionFilter[]).map(r => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`px-2 py-0.5 ${region === r ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-700/50'}`}
              >
                {r === 'all' ? 'Todos' : r === 'RM' ? 'RM' : 'Regiones'}
              </button>
            ))}
          </div>

          {plateFilter.size > 0 && (
            <span className="text-[11px] text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/40">
              {plateFilter.size} patente{plateFilter.size > 1 ? 's' : ''}
            </span>
          )}
          {empresaFilter.size > 0 && (
            <span className="text-[11px] text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/40">
              {empresaFilter.size} empresa{empresaFilter.size > 1 ? 's' : ''}
            </span>
          )}
          {rutaFilter && (
            <span className="text-[11px] text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/40 font-mono">
              {rutaFilter}
            </span>
          )}
          {driverFilter && (
            <span className="text-[11px] text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/40">
              {driverFilter}
            </span>
          )}
          {onlyVip && (
            <span className="text-[11px] text-cmr bg-cmr/10 px-2 py-0.5 rounded border border-cmr/40 flex items-center gap-1">
              <Crosshair size={9} /> VIP
            </span>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setPlateFilter(new Set()); setEmpresaFilter(new Set());
                setRegion('all'); setRutaFilter(''); setDriverFilter(''); setOnlyVip(false);
              }}
              className="text-[10px] text-text-muted hover:text-accent-red"
              title="Limpiar filtros"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {filterOpen && (
          <div className="pointer-events-auto bg-bg-800/95 border border-line rounded-md shadow-lg p-3 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl text-[11px] mt-1 w-full md:w-auto">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Empresa transportista</div>
              <select
                className="input w-full text-[11px]"
                value={empresaFilter.size === 1 ? Array.from(empresaFilter)[0] : ''}
                onChange={e => {
                  const v = e.target.value;
                  setEmpresaFilter(v === '' ? new Set() : new Set([Number(v)]));
                }}
              >
                <option value="">Todas las empresas</option>
                {empresasQ.data?.map(em => (
                  <option key={em.empresa_id} value={em.empresa_id}>
                    {em.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Driver</div>
              <select
                className="input w-full text-[11px]"
                value={driverFilter}
                onChange={e => setDriverFilter(e.target.value)}
              >
                <option value="">Todos los drivers</option>
                {driverOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Ruta</div>
              <select
                className="input w-full text-[11px]"
                value={rutaFilter}
                onChange={e => setRutaFilter(e.target.value)}
              >
                <option value="">Todas las rutas</option>
                {rutaOptions
                  .filter(r =>
                    empresaFilter.size === 0
                      ? true
                      : empresaFilter.has(
                          empresasQ.data?.find(em => em.nombre === r.empresa_nombre)?.empresa_id ?? -1
                        )
                  )
                  .map(r => (
                    <option key={r.ruta_id} value={r.ruta_id}>
                      {r.ruta_id} · {r.driver_name} · {r.empresa_nombre} ({r.total} stops)
                    </option>
                  ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyVip}
                onChange={e => setOnlyVip(e.target.checked)}
                className="accent-cmr"
              />
              <Crosshair size={11} className="text-cmr" />
              <span>Solo visitas VIP</span>
            </label>
            {plateByVid && Object.keys(plateByVid).length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Patente (avanzado)</div>
                <select
                  className="input w-full text-[11px] font-mono"
                  value={plateFilter.size === 1 ? Array.from(plateFilter)[0] : ''}
                  onChange={e => {
                    const v = e.target.value;
                    setPlateFilter(v === '' ? new Set() : new Set([v]));
                  }}
                >
                  <option value="">Todas</option>
                  {Array.from(new Set(allVisits.map(v => plateByVid[v.vehicle_id]).filter(Boolean))).sort().map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
      )}

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

      {/* Panel de secuencia de entrega del conductor enfocado */}
      {focusedDriver && (
        <div className="absolute top-16 left-3 w-80 bg-bg-800/95 border border-line rounded-md shadow-lg z-10">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">
                Secuencia de entrega
              </div>
              <div className="text-xs font-semibold text-brand truncate flex items-center gap-1.5">
                🚚 {focusedDriver.vehicle_name}
                {rutaByVid[focusedDriver.vehicle_id] && (
                  <span className="font-mono text-[10px] text-text-muted">
                    {rutaByVid[focusedDriver.vehicle_id]}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-text-muted">
                {focusedDriver.completedStops}/{focusedDriver.totalStops} entregas · {focusedDriver.progressPct}% al próximo
              </div>
            </div>
            <button
              onClick={() => { setFocusedVehicle(null); setDriverPopup(null); setRutaFilter(''); setSelectedDriver(null); }}
              className="text-text-muted hover:text-accent-red"
              title="Quitar foco"
            >
              <X size={14} />
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto text-[11px]">
            {focusedSequence.map(v => {
              const isVip = vipTrackingSet.has(v.tracking_id);
              return (
                <div
                  key={v.tracking_id}
                  className={`px-3 py-1.5 border-b border-line/50 flex items-center gap-2 ${
                    v.status === 'completed' ? 'opacity-60' : ''
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-semibold shrink-0 ${
                      v.status === 'completed'
                        ? 'bg-bg-700 text-text-muted'
                        : isVip
                        ? 'bg-cmr/20 text-cmr ring-1 ring-cmr/60'
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
                  {isVip && <Crosshair size={10} className="text-cmr shrink-0" />}
                  <span className="flex-1 truncate" title={v.title}>{v.title}</span>
                  <span className="text-text-muted tabular-nums shrink-0">{v.estimated_time_arrival.slice(0, 5)}</span>
                </div>
              );
            })}
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
            <div className="text-text-muted">Window end</div>
            <div className="text-right">{tooltip.visit.window_end || '—'}</div>
            <div className="text-text-muted">ETA</div>
            <div className="text-right">{tooltip.visit.estimated_time_arrival || '—'}</div>
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
