import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, Metric, Text } from '@tremor/react';
import { useOperacionStore } from '../../stores/useOperacionStore';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, Flame, Map as MapIcon,
  Radio, Star, Truck, XCircle,
} from 'lucide-react';
import { api } from '../../api';
import { RegionFilter } from '../../types';
import { REGIONES_CL } from '../../lib/regiones';
import { useAuth } from '../../hooks/useAuth';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { PlanDiarioPanel } from '../PlanDiarioPanel';
import { WatchlistPanel } from '../WatchlistPanel';
import { VisitaDetailDrawer } from '../panels/VisitaDetailDrawer';
import { GanttPorParada } from '../panels/GanttPorParada';
import { OperationsMap } from '../OperationsMap';
import { EventStream } from '../EventStream';
import { MapaFoliosTable } from '../panels/MapaFoliosTable';
import { RutaDetalleDrawer } from '../panels/RutaDetalleDrawer';
import { RouteOpsPanel } from '../RouteOpsPanel';
import { CopilotoPanel } from '../panels/CopilotoPanel';
import { useDiaActivo } from '../../hooks/useDiaActivo';
import {
  computeUrgencyAggregates,
  urgencyScore as urgencyScoreFn,
  isSinRespuesta,
} from '../../lib/operacionUrgency';

// R7: 3 tabs. Copiloto operativo viene de Auditoría IA (era vista operacional,
// no de auditoría). Legacy 'plan' / 'watchlist' redirigen a 'mapa'.
const SUBS: Record<string, true> = { mapa: true, alertas: true, copiloto: true };
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

  // R7-P4: la fecha activa la administra el DiaActivoPicker del topbar
  // (useDiaActivo). Antes leíamos appStateQ.today (fecha del simulador
  // legacy), lo que producía desincronización entre el selector global y
  // el plan-diario consultado.
  const { fecha: activeDate } = useDiaActivo();
  const appStateQ = useQuery({
    queryKey: ['state'],
    queryFn: api.state,
    refetchInterval: 5_000,
  });

  // CR-012 Fix V2: queryKey UNIFICADO con MapaTab/DriversAvancePanel/etc.
  // Normalizamos 'all' → null para que el queryKey sea estable entre
  // consumidores (algunos reciben empresaId: number|null, otros number|'all').
  // Convención canónica: ['plan-diario', fecha, empresaIdOrNull, region, onlyVip].
  const empresaIdKey = empresaId === 'all' ? null : empresaId;
  const planQ = useQuery({
    queryKey: ['plan-diario', activeDate, empresaIdKey, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaIdKey ?? undefined,
      region,
      only_vip: onlyVip,
      // R7: leemos del XLSX real importado en fpoc.simpli_visits.
      source: 'real',
      planned_date: activeDate ?? undefined,
    }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!activeDate,
  });

  const totals = (() => {
    const empresas = planQ.data?.empresas ?? [];
    const total = empresas.reduce((s, e) => s + e.total_visitas, 0);
    const completadas = empresas.reduce((s, e) => s + e.completadas, 0);
    const fallidas = empresas.reduce((s, e) => s + e.fallidas, 0);
    // CR-012 T5: "En riesgo" = count(alert_slack === "RED"), NO mixto con
    // p_fallo>=0.5. Backend ya pre-computa esto en empresa.red_visitas.
    const enRiesgo = empresas.reduce((s, e) => s + (e.red_visitas ?? 0), 0);
    // Banner crítico: existe al menos una visita VIP con alert_slack RED, o
    // un driver "sin respuesta" (last_alert_acknowledged_at >10min). Solo
    // chequeamos VIP+RED acá (sin_respuesta requiere T7+ con alert_history).
    let vipEnRiesgo = 0;
    empresas.forEach(e => e.rutas?.forEach(r =>
      r.visitas?.forEach(v => {
        if (v.is_vip && v.alert_slack === 'RED') vipEnRiesgo += 1;
      })
    ));
    const cumplPct = total ? (completadas / total) * 100 : 0;
    return { total, completadas, fallidas, enRiesgo, cumplPct, vipEnRiesgo };
  })();

  // Ronda 3: 2 tabs. Plan en ejecución y Watchlist se accesan como drawer
  // dentro de Mapa (botones en el header). Legacy slugs siguen aceptados.
  const tabs: SubTabDef[] = [
    { key: 'mapa',     label: 'Mapa',             icon: MapIcon },
    { key: 'copiloto', label: 'Copiloto operativo', icon: Truck },
    { key: 'alertas',  label: 'Alertas en vivo',  icon: Radio },
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

          <DayStatusInline activeDate={activeDate} />

          <span className="ml-auto text-text-muted">
            {planQ.data?.planned_date && <>Día <span className="text-text-secondary tabular-nums">{planQ.data.planned_date}</span></>}
          </span>
        </div>

        {/* CR-012 T5: Banner crítico — visible si hay VIPs en riesgo (slack RED).
            Reemplaza toasts y modales. Persistente, no parpadea. */}
        {totals.vipEnRiesgo > 0 && (
          <div className="mx-4 mb-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 flex items-center gap-2 text-[12px]">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <span className="text-text-primary">
              <strong className="font-semibold text-red-500">{totals.vipEnRiesgo}</strong>
              {' '}{totals.vipEnRiesgo === 1 ? 'alerta crítica' : 'alertas críticas'}
              <span className="text-text-muted"> · {totals.vipEnRiesgo === 1 ? 'Cliente VIP con ventana de entrega vencida' : 'Clientes VIP con ventana de entrega vencida'}</span>
            </span>
            <button
              onClick={() => setDrawer('watchlist')}
              className="ml-auto text-[11px] text-red-500 hover:text-red-400 underline underline-offset-2"
            >
              Ver detalle →
            </button>
          </div>
        )}

        <div className="px-4 pb-3">
          {/* [Tarea 4] KPI strip Tremor — En riesgo destaca con border-l-4 naranjo cuando >0 */}
          <KpiStrip totals={totals} onDrawerPlan={() => setDrawer('plan')} onDrawerWatchlist={() => setDrawer('watchlist')} />
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
        {active === 'copiloto' && <CopilotoLayout />}
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

// [Tarea 4] KPI strip con Tremor Card + Metric. Reemplaza el bloque de 5
// KpiInline planos del header. "En Riesgo" tiene border-l-4 naranjo cuando >0
// (urgencia visual). Los 2 botones Plan / Watchlist quedan a la derecha.
function KpiStrip({ totals, onDrawerPlan, onDrawerWatchlist }: {
  totals: {
    total: number;
    completadas: number;
    fallidas: number;
    enRiesgo: number;
    cumplPct: number;
  };
  onDrawerPlan: () => void;
  onDrawerWatchlist: () => void;
}) {
  const cumplColor =
    totals.cumplPct >= 90 ? 'text-emerald-600' :
    totals.cumplPct >= 75 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex items-stretch gap-2">
      <KpiCard
        icon={Truck} label="Visitas"
        value={totals.total.toLocaleString('es-CL')}
        tone="neutral"
      />
      <KpiCard
        icon={CheckCircle2} label="OK"
        value={totals.completadas.toLocaleString('es-CL')}
        tone="success"
      />
      <KpiCard
        icon={XCircle} label="Fallidas"
        value={totals.fallidas.toLocaleString('es-CL')}
        tone={totals.fallidas > 0 ? 'danger' : 'neutral'}
      />
      <KpiCard
        icon={AlertTriangle} label="En Riesgo"
        value={totals.enRiesgo.toLocaleString('es-CL')}
        tone={totals.enRiesgo > 0 ? 'warning-urgent' : 'neutral'}
      />
      <KpiCard
        icon={Flame} label="% Cumplim."
        value={`${totals.cumplPct.toFixed(0)}%`}
        tone="neutral"
        valueClassName={cumplColor}
      />
      <div className="ml-auto flex items-center gap-2 self-center">
        <button onClick={onDrawerPlan}
                className="btn !py-1 !px-2 text-[10px] flex items-center gap-1"
                title="Ver plan en ejecución (drawer)">
          <CalendarClock size={11} /> Plan
        </button>
        <button onClick={onDrawerWatchlist}
                className="btn !py-1 !px-2 text-[10px] flex items-center gap-1"
                title="Ver watchlist de visitas en riesgo (drawer)">
          <Flame size={11} /> Watchlist
        </button>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, valueClassName }: {
  icon: any;
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'danger' | 'warning-urgent';
  valueClassName?: string;
}) {
  const borderCls =
    tone === 'warning-urgent' ? 'border-l-4 border-l-amber-500' :
    tone === 'danger' ? 'border-l-4 border-l-red-500' :
    tone === 'success' ? 'border-l-4 border-l-emerald-500' : '';
  const iconColor =
    tone === 'warning-urgent' ? 'text-amber-500' :
    tone === 'danger' ? 'text-red-500' :
    tone === 'success' ? 'text-emerald-500' : 'text-text-muted';
  return (
    <Card className={`!p-3 !rounded-md !shadow-none !bg-bg-800/40 !border-line ${borderCls} flex-1 min-w-[120px]`}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-muted mb-1">
        <Icon size={11} className={iconColor} />
        {label}
      </div>
      <Metric className={`!text-xl !text-text-primary tabular-nums ${valueClassName ?? ''}`}>{value}</Metric>
    </Card>
  );
}

function MapaTab({ region, empresaId, onlyVip }: {
  region: RegionFilter;
  empresaId: number | 'all';
  onlyVip: boolean;
}) {
  const [drawerRutaId, setDrawerRutaId] = useState<string | null>(null);
  // [Tarea 4] Toggle del panel inferior (Gantt + folios). Cuando collapsed,
  // el mapa toma full height. Persiste en localStorage para no perder el
  // estado entre navegaciones.
  const [bottomCollapsed, setBottomCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('op.bottomCollapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('op.bottomCollapsed', bottomCollapsed ? '1' : '0'); } catch {}
  }, [bottomCollapsed]);
  // R7-P4: la fecha activa global controla el plan-diario consultado.
  const { fecha: activeDate } = useDiaActivo();
  const stateQ = useQuery({ queryKey: ['state'], queryFn: api.state, refetchInterval: 5_000 });
  const empresasQ = useQuery({
    queryKey: ['empresas-contactos-empresas-list'],
    queryFn: api.empresaContactos.listEmpresas,
  });
  const empresaNombre = empresaId === 'all'
    ? null
    : empresasQ.data?.find(e => e.empresa_id === empresaId)?.nombre ?? null;
  // CR-012 Fix V2: queryKey CANÓNICO compartido con KpiStrip y DriversAvancePanel.
  // Normalización 'all'→null para estabilidad entre consumidores.
  const empresaIdKey = empresaId === 'all' ? null : empresaId;
  const planQ = useQuery({
    queryKey: ['plan-diario', activeDate, empresaIdKey, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaIdKey ?? undefined,
      region,
      only_vip: onlyVip,
      source: 'real',
      planned_date: activeDate,
    }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!activeDate,
  });

  // R7-P4: filtros granulares (driver + ruta) viven acá y se pasan al mapa.
  const [driverFilter, setDriverFilter] = useState<string>('');
  const [rutaFilter, setRutaFilter] = useState<string>('');

  // Cascada driver ↔ ruta:
  //  - driverOptions se acota si hay rutaFilter activo (solo el driver de esa
  //    ruta — porque una ruta tiene un solo driver).
  //  - rutaOptions se acota si hay driverFilter activo (solo sus rutas).
  //  - Si elegís una ruta, el driver se auto-completa (efecto más abajo).
  const { driverOptions, rutaOptions } = useMemo(() => {
    type RutaOpt = { ruta_id: string; driver_name: string; empresa_nombre: string; total: number };
    const driversSet = new Set<string>();
    const rutasMap: Record<string, RutaOpt> = {};
    (planQ.data?.empresas ?? []).forEach(emp => {
      emp.rutas.forEach(r => {
        // Cascada: si hay ruta elegida, solo dejamos pasar esa ruta.
        if (rutaFilter && r.ruta_id !== rutaFilter) return;
        // Cascada: si hay driver elegido, solo dejamos pasar sus rutas.
        if (driverFilter && r.driver_name !== driverFilter) return;
        if (r.driver_name) driversSet.add(r.driver_name);
        if (r.ruta_id) {
          rutasMap[r.ruta_id] = {
            ruta_id: r.ruta_id,
            driver_name: r.driver_name ?? '—',
            empresa_nombre: emp.empresa_nombre ?? '—',
            total: r.total_visitas ?? 0,
          };
        }
      });
    });
    return {
      driverOptions: Array.from(driversSet).sort(),
      rutaOptions: Object.values(rutasMap).sort((a, b) => a.ruta_id.localeCompare(b.ruta_id)),
    };
  }, [planQ.data, rutaFilter, driverFilter]);

  // Al elegir una ruta, auto-completar el driver (mejor UX: ves de quién es
  // y el dropdown queda consistente).
  useEffect(() => {
    if (!rutaFilter || !planQ.data) return;
    for (const emp of planQ.data.empresas) {
      const found = emp.rutas.find(r => r.ruta_id === rutaFilter);
      if (found && found.driver_name && found.driver_name !== driverFilter) {
        setDriverFilter(found.driver_name);
        return;
      }
    }
  }, [rutaFilter, planQ.data]);  // eslint-disable-line react-hooks/exhaustive-deps

  const selectedVehicles = useMemo<number[]>(() => {
    const all = stateQ.data?.vehicles ?? [];
    const anyFilter = onlyVip || empresaId !== 'all' || driverFilter || rutaFilter;
    if (!anyFilter) return all;
    if (!planQ.data) return all;

    const allowed = new Set<number>();
    planQ.data.empresas.forEach(emp => {
      emp.rutas.forEach(r => {
        if (driverFilter && r.driver_name !== driverFilter) return;
        if (rutaFilter && r.ruta_id !== rutaFilter) return;
        // Usar vehicle_id de la ruta (siempre presente en PlanRuta) en vez de
        // r.visitas[0].vehicle_id (no garantizado por el endpoint plan-diario,
        // generaba "0 / 12 vehículos" al filtrar por ruta).
        if (typeof r.vehicle_id === 'number') {
          allowed.add(r.vehicle_id);
        }
      });
    });
    return all.filter(v => allowed.has(v));
  }, [stateQ.data, planQ.data, onlyVip, empresaId, driverFilter, rutaFilter]);

  const totalVeh = stateQ.data?.vehicles.length ?? 0;
  const hayFiltros = onlyVip || empresaId !== 'all' || driverFilter !== '' || rutaFilter !== '' || region !== 'all';

  const planVacio = (planQ.data?.empresas?.length ?? 0) === 0;

  return (
    <div className="p-3 h-full flex flex-col gap-2">
      {planVacio && (
        <div className="rounded border border-accent-yellow/40 bg-accent-yellow/10 px-3 py-2 text-[11px] text-accent-yellow flex items-start gap-2">
          <span className="font-semibold shrink-0">⚠ Sin plan operativo</span>
          <span className="flex-1">
            No hay plan cargado para <span className="font-mono text-text-primary">{activeDate}</span>.
            Cambiá la fecha en el selector del topbar a una con plan EN_CURSO, o cargá un XLSX en
            <strong> Planificación → Día operativo → Carga del día</strong> y luego <strong>"Iniciar día"</strong>.
          </span>
        </div>
      )}
      {/* R7-P4: barra única de filtros visibles siempre. Controlan TODO lo
          que muestra el mapa abajo. */}
      <div className="panel p-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-text-muted uppercase tracking-wider text-[10px] mr-1">Filtros del mapa</span>

        <select
          value={driverFilter}
          onChange={e => setDriverFilter(e.target.value)}
          className="input !py-1 text-[11px] min-w-[160px] disabled:opacity-50"
          disabled={driverOptions.length === 0}
          title={driverOptions.length === 0 ? 'Sin drivers en el plan del día' : 'Filtrar por driver'}
        >
          <option value="">
            {driverOptions.length === 0 ? '(sin drivers)' : `Todos los drivers (${driverOptions.length})`}
          </option>
          {driverOptions.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={rutaFilter}
          onChange={e => setRutaFilter(e.target.value)}
          className="input !py-1 text-[11px] min-w-[260px] disabled:opacity-50"
          disabled={rutaOptions.length === 0}
          title={rutaOptions.length === 0 ? 'Sin rutas en el plan del día' : 'Filtrar por ruta'}
        >
          <option value="">
            {rutaOptions.length === 0 ? '(sin rutas)' : `Todas las rutas (${rutaOptions.length})`}
          </option>
          {rutaOptions
            .filter(r => empresaId === 'all' ? true :
              r.empresa_nombre === (empresasQ.data?.find(em => em.empresa_id === empresaId)?.nombre ?? ''))
            .map(r => (
              <option key={r.ruta_id} value={r.ruta_id}>
                {r.ruta_id} · {r.driver_name} · {r.empresa_nombre} ({r.total} stops)
              </option>
            ))}
        </select>

        {hayFiltros && (
          <button
            onClick={() => { setDriverFilter(''); setRutaFilter(''); }}
            className="text-text-muted hover:text-accent-red text-[10px] flex items-center gap-1"
            title="Limpiar filtros del mapa"
          >
            limpiar
          </button>
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
          <span className="text-[11px] text-cmr bg-cmr/10 px-2 py-0.5 rounded border border-cmr/40">★ VIP</span>
        )}
        {empresaId !== 'all' && empresaNombre && (
          <span className="text-[11px] text-brand bg-brand/10 px-2 py-0.5 rounded border border-brand/40">
            {empresaNombre}
          </span>
        )}

        <span className="ml-auto text-text-muted">
          Mostrando <span className="tabular-nums text-text-secondary">{selectedVehicles.length}</span> / {totalVeh} vehículos
        </span>
      </div>

      <div className="panel flex flex-col flex-1 min-h-[520px]">
        <div className="panel-title flex items-center gap-3 flex-wrap">
          <span>Mapa operacional</span>
          <span className="text-text-muted normal-case tracking-normal text-[11px]">
            color = p(fallo) · borde violeta = alerta VD
          </span>
          <span className="ml-auto flex items-center gap-2 text-[11px] normal-case tracking-normal">
            <span className="text-text-muted">📅</span>
            <span className="font-mono tabular-nums text-text-secondary">{activeDate}</span>
            <span className="text-text-muted">·</span>
            <span className="text-text-muted">🕐</span>
            <span className="font-mono tabular-nums text-brand">
              {stateQ.data?.sim_clock ? stateQ.data.sim_clock.slice(11, 16) : '--:--'}
            </span>
            <span className="text-text-muted text-[10px]">sim</span>
          </span>
        </div>
        {/* Split: panel lateral con avance por driver + mapa. */}
        <div className="flex flex-1 min-h-[480px] gap-2 p-2">
          {!planVacio && (
            <DriversAvancePanel
              fecha={activeDate}
              empresaId={empresaId === 'all' ? null : empresaId}
              region={region}
              onlyVip={onlyVip}
              focusedRutaId={rutaFilter}
              onPickRuta={setRutaFilter}
            />
          )}
          <div className="flex-1 relative">
            {planVacio ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg-900/80 text-center px-6">
                <div className="max-w-md flex flex-col items-center gap-2">
                  <span className="text-[18px] text-text-muted">🗺️</span>
                  <div className="text-[13px] font-semibold text-text-primary">Sin plan operativo para esta fecha</div>
                  <div className="text-[11px] text-text-muted">
                    El mapa muestra solo rutas reales del plan-diario.
                    Para ver pines, cargá un XLSX en Planificación → Día operativo
                    o cambiá la fecha activa en el topbar a una con plan EN_CURSO.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <OperationsMap
                  selectedVehicles={selectedVehicles}
                  externalRegion={region}
                  externalEmpresaId={empresaId === 'all' ? null : empresaId}
                  externalDriverName={driverFilter}
                  externalRutaId={rutaFilter}
                  externalOnlyVip={onlyVip}
                  plannedDate={activeDate}
                />
                {/* CR-012 T8: slide-over drill-down (consume selectedVisitaId).
                    region/onlyVip propagados para deduplicación queryKey (Fix V2). */}
                <VisitaDetailDrawer
                  fecha={activeDate}
                  empresaId={empresaId === 'all' ? null : empresaId}
                  region={region}
                  onlyVip={onlyVip}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* [Tarea 4] Panel inferior colapsable: cuando bottomCollapsed=true,
          el mapa de arriba toma todo el alto. Cuando false, ocupa ~35%.
          Por ahora contiene Gantt placeholder + tabla de folios existente. */}
      <BottomSplit
        collapsed={bottomCollapsed}
        onToggle={() => setBottomCollapsed(c => !c)}
        ganttPlaceholder={
          <GanttPorParada
            fecha={activeDate}
            empresaId={empresaId === 'all' ? null : empresaId}
            region={region}
            onlyVip={onlyVip}
          />
        }
        foliosTable={
          <MapaFoliosTable
            fecha={activeDate}
            empresaId={empresaId === 'all' ? null : empresaId}
            empresaNombre={empresaNombre}
            onlyVip={onlyVip}
            onOpenRuta={(rid) => setDrawerRutaId(rid)}
          />
        }
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

// =============================================================================
// R7: chip de diagnóstico — fecha activa + estado del día + reloj sim.
// Si las 3 fuentes (DiaActivoPicker / day_state / state.sim_clock) no están
// alineadas, este chip lo deja a la vista.
// =============================================================================
function DayStatusInline({ activeDate }: { activeDate: string }) {
  const stateQ = useQuery({ queryKey: ['state'], queryFn: api.state, refetchInterval: 5_000 });
  const dayStateQ = useQuery({
    queryKey: ['day-state-inline', activeDate],
    queryFn: () => api.planificacion.getDayState(activeDate),
    enabled: !!activeDate,
    refetchInterval: 10_000,
  });
  const dayState = dayStateQ.data?.state ?? '—';
  const simClock = stateQ.data?.sim_clock ?? null;
  const simToday = stateQ.data?.today ?? null;

  const stateColor =
    dayState === 'EN_CURSO' ? 'text-brand bg-brand/15 border-brand/40' :
    dayState === 'VALIDADO' ? 'text-accent-blue bg-accent-blue/15 border-accent-blue/40' :
    dayState === 'CERRADO'  ? 'text-text-muted bg-bg-700 border-line' :
    'text-accent-yellow bg-accent-yellow/15 border-accent-yellow/40';

  return (
    <span className="flex items-center gap-2 text-[11px]">
      <span className={`px-1.5 py-0.5 rounded border ${stateColor} font-mono`}>
        {dayState}
      </span>
      <span className="text-text-muted">🕐</span>
      <span className="font-mono tabular-nums text-text-secondary">
        {simClock ? simClock.slice(11, 16) : '--:--'}
      </span>
      {simToday && simToday !== activeDate && (
        <span
          className="text-[10px] text-accent-red"
          title={`Atención: fecha activa (${activeDate}) ≠ fecha del simulador legacy (${simToday}). El sim_clock corresponde a ${simToday}.`}
        >
          ⚠ {simToday}
        </span>
      )}
    </span>
  );
}


// =============================================================================
// DriversAvancePanel — lista lateral con los 13 (N) drivers del día y su avance
// real (stops_completed/stops_total, ruta_id, status). Click en una row enfoca
// esa ruta en el mapa. Single source of truth: /api/operacion/driver-positions.
// =============================================================================
function DriversAvancePanel({
  fecha, empresaId, region, onlyVip, focusedRutaId, onPickRuta,
}: {
  fecha: string;
  empresaId: number | null;
  /** CR-012 Fix V2: region/onlyVip se reciben del módulo padre para que
   *  el plan-diario que pidamos comparta queryKey con el del mapa y se
   *  dedupee. Resultado: sidebar y mapa filtran juntos por region/onlyVip
   *  (UX coherente) y se hace 1 fetch en vez de 2. */
  region: RegionFilter;
  onlyVip: boolean;
  focusedRutaId: string;
  onPickRuta: (rid: string) => void;
}) {
  // [Tarea 5] Sync con zustand para hover/select bidireccional.
  const hoveredDriverId = useOperacionStore(s => s.hoveredDriverId);
  const selectedDriverId = useOperacionStore(s => s.selectedDriverId);
  const setHoveredDriver = useOperacionStore(s => s.setHoveredDriver);
  const setSelectedDriver = useOperacionStore(s => s.setSelectedDriver);
  const scrollDriverIntoView = useOperacionStore(s => s.scrollDriverIntoView);
  const requestScrollToDriver = useOperacionStore(s => s.requestScrollToDriver);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // CR-012 Fix V2: queryKey CANÓNICO compartido con OperationsMap y MapaFoliosTable.
  // Convención: ['driver-positions', fecha, empresaId].
  const driversQ = useQuery({
    queryKey: ['driver-positions', fecha, empresaId],
    queryFn: () => api.operacion.driverPositions(fecha, empresaId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!fecha,
  });

  // CR-012 Fix V2: queryKey CANÓNICO ['plan-diario', fecha, empresaId, region, onlyVip].
  // Compartido con KpiStrip y MapaTab → 1 solo fetch para los 3 consumidores.
  const planQ = useQuery({
    queryKey: ['plan-diario', fecha, empresaId, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaId ?? undefined,
      region,
      only_vip: onlyVip,
      source: 'real',
      planned_date: fecha,
    }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!fecha,
  });

  // CR-012 T6 + CR-013: derivamos por vehicle_id:
  //   - riskByVid: count(alert_slack==RED && status==pending) — oficial
  //   - vipRiskByVid: count(is_vip && alert_slack==RED && status==pending)
  //   - peorSlackByVid: min(slack_min) entre pendientes — para urgencyScore
  //   - peorPFalloByVid: max(p_fallo) entre pendientes — para "P XX%" en el card
  //   - lastDriverAckByVid (CR-013): max(sent_at) de alertas target='driver'
  //     SIN acknowledged_at, en ms. null si no hay ninguna pendiente.
  // Lógica extraída a lib/operacionUrgency.ts para ser testeable.
  const agg = useMemo(
    () => computeUrgencyAggregates(planQ.data?.empresas ?? []),
    [planQ.data],
  );
  const { riskByVid, vipRiskByVid, peorPFalloByVid, lastDriverAckByVid } = agg;

  const drivers = driversQ.data?.drivers ?? [];
  // CR-013: nowMs — preferimos sim_clock del backend para mantener
  // determinismo en demos. Fallback a Date.now() si la query aún no resolvió.
  const nowMs = useMemo(() => {
    const sc = driversQ.data?.sim_clock ?? planQ.data?.sim_clock;
    if (sc) {
      const t = Date.parse(sc);
      if (Number.isFinite(t)) return t;
    }
    return Date.now();
  }, [driversQ.data?.sim_clock, planQ.data?.sim_clock]);

  const sorted = useMemo(() => {
    return [...drivers].sort((a, b) => {
      const sa = urgencyScoreFn(a.vehicle_id, a.status, agg, nowMs);
      const sb = urgencyScoreFn(b.vehicle_id, b.status, agg, nowMs);
      if (sa !== sb) return sb - sa;
      // Empate: % avance asc (rezagados arriba)
      const aPct = a.stops_total > 0 ? a.stops_completed / a.stops_total : 0;
      const bPct = b.stops_total > 0 ? b.stops_completed / b.stops_total : 0;
      return aPct - bPct;
    });
  }, [drivers, agg, nowMs]);

  // [Tarea 5] Scroll-into-view cuando el mapa pide enfocar un driver.
  // Buscamos el card por data-driver-id y le hacemos scrollIntoView con
  // scroll suave. Consumimos el pedido (set null) para no re-disparar.
  useEffect(() => {
    if (scrollDriverIntoView == null) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const card = container.querySelector(`[data-driver-id="${scrollDriverIntoView}"]`);
    if (card) {
      (card as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    requestScrollToDriver(null);
  }, [scrollDriverIntoView, requestScrollToDriver]);

  // CR-012 T6: virtualización con @tanstack/react-virtual.
  // Card promedio = 84px (con línea "VIP/P%" abajo). Overscan 5 según brief.
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 84,
    overscan: 5,
  });

  return (
    <div className="w-[280px] shrink-0 flex flex-col">
      <div className="text-[10px] uppercase tracking-wider text-text-muted px-2 pb-1 flex items-center justify-between shrink-0">
        <span>Drivers ({sorted.length})</span>
        {focusedRutaId && (
          <button
            onClick={() => { onPickRuta(''); setSelectedDriver(null); }}
            className="text-[9px] text-text-muted hover:text-accent-red"
            title="Quitar foco"
          >
            limpiar
          </button>
        )}
      </div>
      {sorted.length === 0 ? (
        // CR-012 T6: estado vacío con CTA cuando sim_active === false.
        // POST /api/sim/start no existe — el flujo correcto en este POC es
        // iniciar el día desde el panel "Día Operativo" (BORRADOR→VALIDADO→
        // EN_CURSO). Mostramos texto guía en ese caso.
        driversQ.data?.sim_active === false ? (
          <div className="text-[11px] text-text-muted px-2 py-3">
            <div className="font-medium mb-1">Simulador inactivo</div>
            <div className="text-text-muted">
              Iniciá el día operativo desde el panel "Día Operativo" para ver drivers en vivo.
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-text-muted px-2 py-3 italic">
            Sin drivers iniciados.
          </div>
        )
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto pr-1"
          style={{ contain: 'strict' }}
        >
          <div
            style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const d = sorted[virtualRow.index];
              const pct = d.stops_total > 0
                ? Math.round((d.stops_completed / d.stops_total) * 100)
                : 0;
              const isFocused = !!d.ruta_id && d.ruta_id === focusedRutaId;
              const barColor =
                d.status === 'finalizado' ? 'bg-text-muted' :
                d.stops_failed > 0 ? 'bg-accent-red' :
                'bg-brand';
              const riskCount = riskByVid[d.vehicle_id] ?? 0;
              const vipRiskCount = vipRiskByVid[d.vehicle_id] ?? 0;
              const maxP = peorPFalloByVid[d.vehicle_id] ?? 0;
              const hasVipRisk = vipRiskCount > 0;
              const hasRisk = riskCount > 0;
              // CR-013: SIN_RESPUESTA gana sobre VIP+RED/RED en la etiqueta y el borde.
              const sinRespuesta = isSinRespuesta(d.vehicle_id, agg, nowMs);
              const isHovered = hoveredDriverId === d.vehicle_id;
              const isSelected = selectedDriverId === d.vehicle_id || isFocused;
              // Etiqueta de estado según prioridad (brief T6 + CR-013).
              const stateLabel =
                sinRespuesta ? { txt: 'SIN RESPUESTA', cls: 'bg-red-900/60 text-red-200' } :
                d.status === 'finalizado' ? { txt: 'FINALIZADO', cls: 'bg-text-muted/20 text-text-muted' } :
                hasVipRisk ? { txt: 'EN RIESGO', cls: 'bg-red-500/20 text-red-500' } :
                hasRisk ? { txt: 'ATRASO', cls: 'bg-amber-500/20 text-amber-500' } :
                d.stops_completed > 0 ? { txt: 'OK', cls: 'bg-emerald-500/15 text-emerald-500' } :
                { txt: '—', cls: 'bg-bg-700 text-text-muted' };
              return (
                <button
                  key={d.vehicle_id}
                  data-driver-id={d.vehicle_id}
                  onMouseEnter={() => setHoveredDriver(d.vehicle_id)}
                  onMouseLeave={() => setHoveredDriver(null)}
                  onClick={() => {
                    if (!d.ruta_id) return;
                    if (isFocused) {
                      onPickRuta('');
                      setSelectedDriver(null);
                    } else {
                      onPickRuta(d.ruta_id);
                      setSelectedDriver(d.vehicle_id);
                    }
                  }}
                  className={`absolute left-0 right-0 text-left px-2 py-1.5 rounded border transition-colors ${
                    isSelected
                      ? 'bg-brand/15 border-brand/60 ring-1 ring-brand/40'
                      : isHovered
                      ? 'bg-bg-700/60 border-line'
                      : sinRespuesta
                      ? 'border-l-4 border-l-red-700 bg-red-900/20 border-line/40 hover:bg-red-900/30'
                      : hasVipRisk
                      ? 'border-l-4 border-l-red-500 border-line/40 hover:bg-bg-700/40'
                      : hasRisk
                      ? 'border-l-4 border-l-amber-500 border-line/40 hover:bg-bg-700/40'
                      : 'border-line/40 hover:bg-bg-700/40 hover:border-line'
                  }`}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    height: virtualRow.size - 4,
                    marginBottom: 4,
                  }}
                  title={`Click para ${isSelected ? 'quitar foco' : 'enfocar'} en el mapa`}
                >
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-medium truncate flex items-center gap-1">
                      {d.driver_name ?? `vid ${d.vehicle_id}`}
                    </span>
                    <span className={`text-[8px] uppercase tracking-wider px-1 py-0.5 rounded font-bold ${stateLabel.cls}`}>
                      {stateLabel.txt}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                    <span className="font-mono truncate">{d.ruta_id ?? '—'}</span>
                    <span className="tabular-nums shrink-0 ml-1">
                      {d.stops_completed}/{d.stops_total}
                      {d.stops_failed > 0 && (
                        <span className="text-accent-red ml-1">·{d.stops_failed}f</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1 bg-bg-700 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[9px] mt-0.5">
                    {hasVipRisk ? (
                      <span className="text-red-500">★ {vipRiskCount} VIP en riesgo</span>
                    ) : maxP > 0 ? (
                      <span className={maxP >= 0.5 ? 'text-red-500' : maxP >= 0.2 ? 'text-amber-500' : 'text-text-muted'}>
                        P {(maxP * 100).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-text-muted">{pct}%</span>
                    )}
                    {d.vip_visitas > 0 && !hasVipRisk && (
                      <span className="text-cmr">★{d.vip_visitas}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// [Tarea 4] Panel inferior colapsable con 2 sub-tabs: Gantt | Folios.
// Toggle expone/oculta. Cuando colapsado solo se ve la barra de header con
// chevron para expandir. Altura aproximada cuando expandido: 35vh.
function BottomSplit({
  collapsed, onToggle, ganttPlaceholder, foliosTable,
}: {
  collapsed: boolean;
  onToggle: () => void;
  ganttPlaceholder: React.ReactNode;
  foliosTable: React.ReactNode;
}) {
  const [tab, setTab] = useState<'gantt' | 'folios'>('folios');
  return (
    <div className={`panel flex flex-col ${collapsed ? '' : 'flex-shrink-0'}`}
         style={collapsed ? undefined : { height: '35vh', minHeight: '280px' }}>
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-line/40 text-[11px]">
        <button onClick={onToggle}
                className="flex items-center gap-1 text-text-muted hover:text-text-primary"
                title={collapsed ? 'Expandir panel inferior' : 'Colapsar panel inferior'}>
          <ChevronDown size={14} className={`transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          <span className="uppercase tracking-wider">{collapsed ? 'Mostrar Gantt + Folios' : 'Ocultar'}</span>
        </button>
        {!collapsed && (
          <div className="flex items-center gap-0 border border-line/40 rounded overflow-hidden">
            <button onClick={() => setTab('gantt')}
                    className={`px-2 py-0.5 text-[10px] ${tab === 'gantt' ? 'bg-brand text-white' : 'text-text-muted hover:bg-bg-700'}`}>
              Gantt
            </button>
            <button onClick={() => setTab('folios')}
                    className={`px-2 py-0.5 text-[10px] ${tab === 'folios' ? 'bg-brand text-white' : 'text-text-muted hover:bg-bg-700'}`}>
              Folios
            </button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {tab === 'gantt' ? ganttPlaceholder : foliosTable}
        </div>
      )}
    </div>
  );
}

// [Tarea 7] Layout del tab "Copiloto operativo": RouteOpsPanel (operativa
// completa) + CopilotoPanel (sugerencias AI mock) lateral derecho, colapsable.
// Persiste el estado del toggle en localStorage.
function CopilotoLayout() {
  const [copilotoCollapsed, setCopilotoCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem('op.copilotoCollapsed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('op.copilotoCollapsed', copilotoCollapsed ? '1' : '0'); } catch {}
  }, [copilotoCollapsed]);
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 overflow-auto">
        <RouteOpsPanel />
      </div>
      <CopilotoPanel
        collapsed={copilotoCollapsed}
        onToggle={() => setCopilotoCollapsed(c => !c)}
      />
    </div>
  );
}

// [Tarea 4] Placeholder del Gantt — la implementación con D3 viene en
// ROADMAP. Por ahora muestra una preview legible de las visitas en una
// timeline simple horizontal hecha con barras CSS.
function GanttPlaceholder({ fecha }: { fecha: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center text-center text-text-muted gap-3 h-full">
      <Truck size={32} className="opacity-40" />
      <div className="text-[13px] font-semibold text-text-secondary">Gantt de progreso (próximamente)</div>
      <div className="text-[11px] max-w-md">
        Vista horizontal de cada driver con avance vs ETA planificado, hitos de
        VIPs, slots de cutoff. Implementación con D3 scales agendada en el
        ROADMAP.md → "Gantt custom".
      </div>
      <div className="text-[10px] text-text-muted/70 font-mono">día: {fecha}</div>
    </div>
  );
}
