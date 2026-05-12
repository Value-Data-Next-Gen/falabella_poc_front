import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Flame, Map as MapIcon,
  Radio, Star, Truck, XCircle,
} from 'lucide-react';
import { api } from '../../api';
import { RegionFilter } from '../../types';
import { REGIONES_CL } from '../../lib/regiones';
import { useAuth } from '../../hooks/useAuth';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { PlanDiarioPanel } from '../PlanDiarioPanel';
import { WatchlistPanel } from '../WatchlistPanel';
import { OperationsMap } from '../OperationsMap';
import { EventStream } from '../EventStream';
import { MapaFoliosTable } from '../panels/MapaFoliosTable';
import { RutaDetalleDrawer } from '../panels/RutaDetalleDrawer';

// R3: solo Mapa + Alertas. Legacy 'plan' / 'watchlist' redirigen a 'mapa' y
// abren el drawer correspondiente.
const SUBS: Record<string, true> = { mapa: true, alertas: true };
const LEGACY_OP_SUBS: Record<string, 'plan' | 'watchlist'> = {
  plan: 'plan',
  watchlist: 'watchlist',
};

export function OperacionModuleV2({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const { isFalabella } = useAuth();
  const subRaw = sub ?? 'mapa';
  const legacy = LEGACY_OP_SUBS[subRaw];
  const active = SUBS[subRaw] ? subRaw : (legacy ? 'mapa' : 'mapa');
  // Drawer abierto al cargar desde slug legacy
  const [drawer, setDrawer] = useState<'plan' | 'watchlist' | null>(legacy ?? null);

  const [region, setRegion] = useState<RegionFilter>('all');
  const [empresaId, setEmpresaId] = useState<number | 'all'>('all');
  const [onlyVip, setOnlyVip] = useState(false);

  const empresasQ = useQuery({
    queryKey: ['empresas-contactos-empresas-list'],
    queryFn: api.empresaContactos.listEmpresas,
    enabled: isFalabella,
  });

  // Día activo del simulador. Las 4 tabs de Operación deben leer del mismo
  // source (snapshot sintético del simulador), no del XLSX real. Antes este
  // query usaba source='real' por default y devolvía 0 visitas cuando STATE.today
  // no coincidía con un XLSX cargado.
  const appStateQ = useQuery({
    queryKey: ['state'],
    queryFn: api.state,
    refetchInterval: 5_000,
  });
  const activeDate = appStateQ.data?.today ?? null;

  const planQ = useQuery({
    queryKey: ['plan-diario-mod-kpi-v2', empresaId, region, onlyVip, activeDate],
    queryFn: () => api.planDiario({
      empresa_id: empresaId === 'all' ? undefined : empresaId,
      region,
      only_vip: onlyVip,
      // Operación usa el snapshot del simulador (consistente con Mapa+Alertas).
      source: 'synthetic',
      planned_date: activeDate ?? undefined,
    }),
    refetchInterval: 10_000,
    enabled: !!activeDate,
  });

  const totals = (() => {
    const empresas = planQ.data?.empresas ?? [];
    const total = empresas.reduce((s, e) => s + e.total_visitas, 0);
    const completadas = empresas.reduce((s, e) => s + e.completadas, 0);
    const fallidas = empresas.reduce((s, e) => s + e.fallidas, 0);
    const enRiesgo = empresas.reduce((s, e) => s + e.en_riesgo, 0);
    const cumplPct = total ? (completadas / total) * 100 : 0;
    return { total, completadas, fallidas, enRiesgo, cumplPct };
  })();

  // Ronda 3: 2 tabs. Plan en ejecución y Watchlist se accesan como drawer
  // dentro de Mapa (botones en el header). Legacy slugs siguen aceptados.
  const tabs: SubTabDef[] = [
    { key: 'mapa',    label: 'Mapa',            icon: MapIcon },
    { key: 'alertas', label: 'Alertas en vivo', icon: Radio },
  ];

  const filterProps = { region, onlyVip, empresaId, hideLocalFilters: true };

  return (
    <div className="h-full flex flex-col">
      {/* Filtros globales */}
      <div className="border-b border-line/60 bg-bg-800/50">
        <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-text-muted uppercase tracking-wider text-[10px] mr-2">Filtros</span>

          <select
            value={region}
            onChange={e => setRegion(e.target.value as RegionFilter)}
            className="input text-[11px] py-1"
            title="Filtrar por región"
          >
            <option value="all">Todas las regiones</option>
            <option value="RM">Región Metropolitana</option>
            <option value="regiones">Todas excepto RM</option>
            <option disabled>──────────</option>
            {REGIONES_CL.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {isFalabella && (
            <select
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="input text-[11px] py-1"
            >
              <option value="all">Todas las empresas</option>
              {empresasQ.data?.map(e => (
                <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyVip}
              onChange={e => setOnlyVip(e.target.checked)}
              className="accent-cmr"
            />
            <Star size={11} className="text-cmr" />
            <span>Solo VIP</span>
          </label>

          <span className="ml-auto text-text-muted">
            {planQ.data?.planned_date && <>Día <span className="text-text-secondary tabular-nums">{planQ.data.planned_date}</span></>}
          </span>
        </div>

        <div className="px-4 pb-3 flex items-center gap-4 text-[11px]">
          <KpiInline label="Visitas" value={totals.total} icon={Truck} color="text-text-primary" />
          <KpiInline label="OK" value={totals.completadas} icon={CheckCircle2} color="text-brand" />
          <KpiInline label="Fallidas" value={totals.fallidas} icon={XCircle} color="text-accent-red" />
          <KpiInline label="En riesgo" value={totals.enRiesgo} icon={AlertTriangle} color="text-accent-yellow" />
          <KpiInline
            label="% cumpl."
            value={`${totals.cumplPct.toFixed(0)}%`}
            icon={Flame}
            color={totals.cumplPct >= 90 ? 'text-brand' : totals.cumplPct >= 75 ? 'text-accent-yellow' : 'text-accent-red'}
          />
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setDrawer('plan')}
                    className="btn !py-1 !px-2 text-[10px] flex items-center gap-1"
                    title="Ver plan en ejecución (drawer)">
              <CalendarClock size={11} /> Plan
            </button>
            <button onClick={() => setDrawer('watchlist')}
                    className="btn !py-1 !px-2 text-[10px] flex items-center gap-1"
                    title="Ver watchlist de visitas en riesgo (drawer)">
              <Flame size={11} /> Watchlist
            </button>
          </div>
        </div>
      </div>

      <SubTabs tabs={tabs} active={active} onChange={setSub} />

      <div className="flex-1 overflow-auto relative">
        {active === 'mapa' && (
          <MapaTab
            region={region}
            empresaId={empresaId}
            onlyVip={onlyVip}
          />
        )}
        {active === 'alertas' && <div className="h-full"><EventStream /></div>}

        {/* Drawers — Plan en ejecución y Watchlist */}
        {drawer && (
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDrawer(null)}>
            <div className="absolute right-0 top-0 bottom-0 w-full max-w-3xl bg-bg-900 border-l border-line shadow-2xl overflow-auto"
                 onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-bg-800 border-b border-line px-4 py-2 flex items-center justify-between z-10">
                <div className="text-[13px] font-semibold uppercase tracking-wider flex items-center gap-2">
                  {drawer === 'plan' ? <><CalendarClock size={14} /> Plan en ejecución</> : <><Flame size={14} /> Watchlist</>}
                </div>
                <button onClick={() => setDrawer(null)} className="text-text-muted hover:text-text-primary">
                  <span className="sr-only">Cerrar</span>✕
                </button>
              </div>
              <div className="p-2">
                {drawer === 'plan' && <PlanDiarioPanel filters={filterProps} mode="live" />}
                {drawer === 'watchlist' && <WatchlistPanel filters={filterProps} />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiInline({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={12} className={color} />
      <span className="text-text-muted text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function MapaTab({ region, empresaId, onlyVip }: {
  region: RegionFilter;
  empresaId: number | 'all';
  onlyVip: boolean;
}) {
  const [drawerRutaId, setDrawerRutaId] = useState<string | null>(null);
  const stateQ = useQuery({ queryKey: ['state'], queryFn: api.state, refetchInterval: 5_000 });
  const empresasQ = useQuery({
    queryKey: ['empresas-contactos-empresas-list'],
    queryFn: api.empresaContactos.listEmpresas,
  });
  const empresaNombre = empresaId === 'all'
    ? null
    : empresasQ.data?.find(e => e.empresa_id === empresaId)?.nombre ?? null;
  // Plan diario nos da: rutas con driver_name, vehículos (patente/vehicle_id),
  // y vip_visitas — lo usamos para filtrar vehículos por driver / ruta / VIP.
  const planQ = useQuery({
    queryKey: ['plan-diario-map', empresaId, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaId === 'all' ? undefined : empresaId,
      region,
      only_vip: onlyVip,
      source: 'synthetic',  // mismo source que el header + Plan en ejecución
    }),
    refetchInterval: 10_000,
  });

  const [driverFilter, setDriverFilter] = useState<string>('');
  const [rutaFilter, setRutaFilter] = useState<string>('');
  const [trackingQuery, setTrackingQuery] = useState<string>('');

  // Construimos catálogos a partir de plan-diario
  const { driverOptions, rutaOptions, vehicleSet } = useMemo(() => {
    const drivers = new Set<string>();
    const rutas = new Set<string>();
    const vehicles = new Set<number>();
    (planQ.data?.empresas ?? []).forEach(emp => {
      emp.rutas.forEach(r => {
        if (r.driver_name) drivers.add(r.driver_name);
        if (r.ruta_id) rutas.add(r.ruta_id);
        // Inferir vehicle_id desde la primera visita si está
        const vid = r.visitas?.[0] && (r.visitas[0] as any).vehicle_id;
        if (typeof vid === 'number') vehicles.add(vid);
      });
    });
    return {
      driverOptions: Array.from(drivers).sort(),
      rutaOptions: Array.from(rutas).sort(),
      vehicleSet: vehicles,
    };
  }, [planQ.data]);

  // Vehículos a mostrar: si hay filtros, calcular subset; sino todos los del state.
  const selectedVehicles = useMemo<number[]>(() => {
    const all = stateQ.data?.vehicles ?? [];
    const anyFilter = driverFilter || rutaFilter || trackingQuery || onlyVip || empresaId !== 'all';
    if (!anyFilter) return all;
    if (!planQ.data) return all;

    const allowed = new Set<number>();
    planQ.data.empresas.forEach(emp => {
      emp.rutas.forEach(r => {
        if (driverFilter && r.driver_name !== driverFilter) return;
        if (rutaFilter && r.ruta_id !== rutaFilter) return;
        if (trackingQuery) {
          const q = trackingQuery.trim().toLowerCase();
          const match = r.visitas?.some(v =>
            v.tracking_id.toLowerCase().includes(q) ||
            (v.cliente_nombre ?? '').toLowerCase().includes(q)
          );
          if (!match) return;
        }
        const vid = r.visitas?.[0] && (r.visitas[0] as any).vehicle_id;
        if (typeof vid === 'number') allowed.add(vid);
      });
    });
    return all.filter(v => allowed.has(v));
  }, [stateQ.data, planQ.data, driverFilter, rutaFilter, trackingQuery, onlyVip, empresaId]);

  const totalVeh = stateQ.data?.vehicles.length ?? 0;
  const hasFilter = !!(driverFilter || rutaFilter || trackingQuery);

  return (
    <div className="p-3 h-full flex flex-col gap-2">
      {/* Filtros específicos del mapa */}
      <div className="panel p-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-text-muted uppercase tracking-wider text-[10px] mr-1">Filtrar pines</span>

        <input
          list="map-driver-list"
          value={driverFilter}
          onChange={e => setDriverFilter(e.target.value)}
          placeholder="Driver…"
          className="input !py-1 text-[11px] w-[140px]"
        />
        <datalist id="map-driver-list">
          {driverOptions.map(d => <option key={d} value={d} />)}
        </datalist>

        <input
          list="map-ruta-list"
          value={rutaFilter}
          onChange={e => setRutaFilter(e.target.value)}
          placeholder="Ruta_id…"
          className="input !py-1 text-[11px] w-[140px] font-mono"
        />
        <datalist id="map-ruta-list">
          {rutaOptions.map(r => <option key={r} value={r} />)}
        </datalist>

        <input
          value={trackingQuery}
          onChange={e => setTrackingQuery(e.target.value)}
          placeholder="Tracking o cliente…"
          className="input !py-1 text-[11px] w-[180px]"
        />

        {hasFilter && (
          <button
            onClick={() => { setDriverFilter(''); setRutaFilter(''); setTrackingQuery(''); }}
            className="text-text-muted hover:text-accent-red text-[10px]"
            title="Limpiar filtros del mapa"
          >
            limpiar
          </button>
        )}

        <span className="ml-auto text-text-muted">
          Mostrando <span className="text-text-secondary tabular-nums">{selectedVehicles.length}</span> / {totalVeh} vehículos
        </span>
      </div>

      <div className="panel flex flex-col">
        <div className="panel-title">
          <span>Mapa operacional</span>
          <span className="text-text-muted normal-case tracking-normal text-[11px]">
            color = p(fallo) · borde violeta = alerta VD
          </span>
        </div>
        <div className="min-h-[440px] h-[440px]">
          <OperationsMap selectedVehicles={selectedVehicles} />
        </div>
      </div>

      <MapaFoliosTable
        fecha={stateQ.data?.today ?? ''}
        empresaId={empresaId === 'all' ? null : empresaId}
        empresaNombre={empresaNombre}
        onlyVip={onlyVip}
        onOpenRuta={(rid) => setDrawerRutaId(rid)}
      />

      {drawerRutaId && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDrawerRutaId(null)}>
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-bg-900 border-l border-line shadow-2xl overflow-auto"
               onClick={e => e.stopPropagation()}>
            <RutaDetalleDrawer rutaId={drawerRutaId} onClose={() => setDrawerRutaId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
