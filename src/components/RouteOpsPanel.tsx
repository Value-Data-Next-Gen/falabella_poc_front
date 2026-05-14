import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Radio,
  Route as RouteIcon,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Star,
  Truck,
  User,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api';
import {
  PlanDiarioResponseLegacy,
  PlanDriver,
  PlanVisit,
  Priority,
  TrackingNotifSummary,
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { useDiaActivo } from '../hooks/useDiaActivo';
import { NotifiedBadge } from './NotifiedBadge';
import { ReportMotivoButton } from './ReportMotivoButton';
import { AsistenteIAPanel } from './AsistenteIAPanel';

type DriverStatus = 'pre' | 'en_ruta' | 'finalizado';
type RightTab = 'prep' | 'live' | 'problems' | 'asistente';

const INCIDENT_PRESETS: { label: string; mins: number; reason: string }[] = [
  { label: 'Tráfico leve', mins: 10, reason: 'Tráfico leve en ruta' },
  { label: 'Tráfico denso', mins: 25, reason: 'Tráfico denso / congestión' },
  { label: 'Falla mecánica', mins: 45, reason: 'Falla mecánica del vehículo' },
  { label: 'Cliente no ubicado', mins: 15, reason: 'Cliente no ubicado en domicilio' },
  { label: 'Accidente / desvío', mins: 60, reason: 'Accidente o desvío forzado' },
];

function driverStatus(d: PlanDriver): DriverStatus {
  if (d.total_visits > 0 && d.completed === d.total_visits) return 'finalizado';
  if (d.completed > 0 && d.pending > 0) return 'en_ruta';
  return 'pre';
}

const STATUS_META: Record<DriverStatus, { label: string; cls: string }> = {
  pre: { label: 'Por salir', cls: 'pill bg-bg-700 text-text-secondary border border-line' },
  en_ruta: { label: 'En ruta', cls: 'pill bg-brand/15 text-brand border border-brand/40' },
  finalizado: { label: 'Cerrada', cls: 'pill bg-accent-green/15 text-accent-green border border-accent-green/40' },
};

export function RouteOpsPanel() {
  const { isFalabella, isAdmin } = useAuth();
  const qc = useQueryClient();
  // R7-P4: respeta la fecha activa global + day_state. Si el día no está
  // EN_CURSO no mostramos data (antes traía 12 drivers fake del simulador).
  const { fecha: activeDate } = useDiaActivo();

  const empresasQ = useQuery({ queryKey: ['empresas'], queryFn: api.empresas, enabled: isFalabella });
  const stateQ = useQuery({ queryKey: ['state'], queryFn: api.state, refetchInterval: 5_000 });
  const dayStateQ = useQuery({
    queryKey: ['day-state-copiloto', activeDate],
    queryFn: () => api.planificacion.getDayState(activeDate),
    enabled: !!activeDate,
    refetchInterval: 15_000,
  });
  const dayState = dayStateQ.data?.state ?? null;
  const dayEnCurso = dayState === 'EN_CURSO';

  const [empresaFilter, setEmpresaFilter] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'' | DriverStatus>('');
  const [search, setSearch] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('prep');
  const [notifyVisit, setNotifyVisit] = useState<PlanVisit | null>(null);

  // RouteOpsPanel usa la estructura LEGACY (Empresa->Drivers) del Sprint 1.
  // El Plan Diario "nuevo" (Empresa->Rutas) se renderiza desde PlanDiarioPanel.
  const planQ = useQuery<PlanDiarioResponseLegacy>({
    queryKey: ['plan-diario-legacy', empresaFilter, activeDate],
    queryFn: () => api.planDiario({
      empresa_id: empresaFilter === 'all' ? undefined : empresaFilter,
      legacy: true,
      planned_date: activeDate,
    }) as any,
    enabled: !!activeDate && dayEnCurso,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
  });

  const drivers: (PlanDriver & { empresa_nombre: string; empresa_id: number })[] = useMemo(() => {
    const out: any[] = [];
    planQ.data?.empresas.forEach(emp => {
      emp.drivers.forEach(d => out.push({ ...d, empresa_nombre: emp.nombre, empresa_id: emp.empresa_id }));
    });
    return out;
  }, [planQ.data]);

  const filteredDrivers = useMemo(() => {
    const s = search.trim().toLowerCase();
    return drivers.filter(d => {
      if (statusFilter && driverStatus(d) !== statusFilter) return false;
      if (s) {
        const hit =
          d.driver_name.toLowerCase().includes(s) ||
          d.vehicle_name.toLowerCase().includes(s) ||
          d.empresa_nombre.toLowerCase().includes(s);
        if (!hit) return false;
      }
      return true;
    });
  }, [drivers, statusFilter, search]);

  // Auto-seleccionar el primero
  useEffect(() => {
    if (selectedVehicle == null && filteredDrivers.length > 0) {
      setSelectedVehicle(filteredDrivers[0].vehicle_id);
    }
    if (selectedVehicle != null && filteredDrivers.length > 0 && !filteredDrivers.some(d => d.vehicle_id === selectedVehicle)) {
      setSelectedVehicle(filteredDrivers[0].vehicle_id);
    }
  }, [filteredDrivers, selectedVehicle]);

  const selected = useMemo(
    () => filteredDrivers.find(d => d.vehicle_id === selectedVehicle) ?? null,
    [filteredDrivers, selectedVehicle],
  );

  // Notif map para los tracking_ids del driver seleccionado
  const tids = selected?.visits.map(v => v.tracking_id) ?? [];
  const notifQ = useQuery({
    queryKey: ['route-ops-notif', selected?.vehicle_id, tids.length],
    queryFn: () => api.notif.byTrackings(tids),
    enabled: tids.length > 0,
    refetchInterval: 15_000,
  });
  const notifMap: Record<string, TrackingNotifSummary> = notifQ.data ?? {};

  // Totales globales para el header
  const globalTotals = useMemo(() => {
    let drvActive = 0, drvDone = 0, red = 0, vip = 0, completed = 0, total = 0;
    drivers.forEach(d => {
      const s = driverStatus(d);
      if (s === 'en_ruta') drvActive++;
      if (s === 'finalizado') drvDone++;
      red += d.red_visits;
      vip += d.vip_visits;
      completed += d.completed;
      total += d.total_visits;
    });
    const incidents = stateQ.data?.incidents ?? {};
    const incVehicles = Object.entries(incidents).filter(([, v]) => Number(v) > 0).length;
    return { drvActive, drvDone, red, vip, completed, total, incVehicles };
  }, [drivers, stateQ.data]);

  // R7-P4: si el día no está EN_CURSO mostramos placeholder en lugar de la
  // grilla. Antes el panel traía data del simulador legacy aunque el día
  // estuviera en BORRADOR.
  if (!dayEnCurso && !dayStateQ.isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="max-w-md text-center flex flex-col items-center gap-3">
          <Truck size={28} className="text-text-muted" />
          <div className="text-[14px] font-semibold text-text-primary">Copiloto inactivo</div>
          <div className="text-[12px] text-text-muted">
            El copiloto operativo solo se muestra cuando el día está{' '}
            <span className="font-mono text-brand">EN_CURSO</span>.
            <br />
            Fecha activa: <span className="font-mono text-text-secondary">{activeDate}</span>
            {' · '}Estado: <span className="font-mono">{dayState ?? 'sin estado'}</span>
          </div>
          <div className="text-[11px] text-text-muted mt-2">
            Para activarlo: <strong>Planificación → Día operativo → Iniciar día</strong>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-hidden">
      {/* Header global */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <KpiTile label="Drivers" value={drivers.length} icon={Truck} />
        <KpiTile label="En ruta" value={globalTotals.drvActive} icon={Radio} accent="text-brand" />
        <KpiTile label="Cerradas" value={globalTotals.drvDone} icon={CheckCircle2} accent="text-accent-green" />
        <KpiTile
          label="Visitas"
          value={`${globalTotals.completed}/${globalTotals.total}`}
          icon={MapPin}
        />
        <KpiTile label="Críticas pendientes" value={globalTotals.red} icon={AlertTriangle} accent="text-accent-red"
                 hint="Visitas pendientes con semáforo SLA en rojo (slack negativo o p(fallo) ≥ umbral crítico)." />
        <KpiTile label="VIP" value={globalTotals.vip} icon={Star} accent="text-cmr" />
        <KpiTile
          label="Incidentes activos"
          value={globalTotals.incVehicles}
          icon={Wrench}
          accent={globalTotals.incVehicles > 0 ? 'text-accent-yellow' : undefined}
        />
      </section>

      {/* Filtros */}
      <section className="panel">
        <div className="p-2 flex flex-wrap items-center gap-2">
          <RouteIcon size={14} className="text-brand" />
          <span className="text-xs uppercase tracking-wider text-text-secondary">
            Operación de ruta · {planQ.data?.planned_date ?? '—'} · {stateQ.data?.sim_clock?.slice(11, 16) ?? '--:--'}
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Driver, vehículo o empresa..."
            className="input ml-3 min-w-[200px]"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="input"
          >
            <option value="">Todas las rutas</option>
            <option value="pre">Por salir</option>
            <option value="en_ruta">En ruta</option>
            <option value="finalizado">Cerradas</option>
          </select>
          {isFalabella && (
            <select
              value={empresaFilter}
              onChange={e => setEmpresaFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="input"
            >
              <option value="all">Todas las empresas</option>
              {empresasQ.data?.map(e => (
                <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>
              ))}
            </select>
          )}
          <span className="text-[11px] text-text-muted ml-auto">
            {filteredDrivers.length} ruta(s) · refresh 5s
          </span>
        </div>
      </section>

      {/* Split: drivers list + detail */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
        <aside className="col-span-12 lg:col-span-4 xl:col-span-3 panel flex flex-col overflow-hidden">
          <div className="panel-title">
            <span title="Hacé click sobre un driver para ver el detalle de su ruta a la derecha.">
              Rutas / drivers
            </span>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredDrivers.length === 0 && (
              <div className="p-6 text-center text-text-muted text-xs">
                Sin rutas con los filtros actuales.
              </div>
            )}
            {filteredDrivers.map(d => {
              const st = driverStatus(d);
              const meta = STATUS_META[st];
              const pct = d.total_visits > 0 ? Math.round((d.completed / d.total_visits) * 100) : 0;
              const inc = Number(stateQ.data?.incidents?.[String(d.vehicle_id)] ?? 0);
              const isSel = d.vehicle_id === selectedVehicle;
              return (
                <button
                  key={d.vehicle_id}
                  onClick={() => setSelectedVehicle(d.vehicle_id)}
                  className={`w-full px-3 py-2 text-left border-b border-line/60 transition-colors ${
                    isSel ? 'bg-brand/10 border-l-2 border-l-brand' : 'hover:bg-bg-700/40'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Truck size={12} className={st === 'en_ruta' ? 'text-brand animate-pulse' : 'text-text-secondary'} />
                    <span className="font-mono">{d.vehicle_name}</span>
                    <span className={meta.cls}>{meta.label}</span>
                    {inc > 0 && (
                      <span className="pill bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/40 ml-auto">
                        +{inc.toFixed(0)}m
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-secondary truncate flex items-center gap-1">
                    <User size={10} className="text-text-muted" />
                    {d.driver_name}
                  </div>
                  <div className="text-[10px] text-text-muted truncate flex items-center gap-1">
                    <Building2 size={9} /> {d.empresa_nombre}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-bg-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${pct === 100 ? 'bg-accent-green' : pct > 0 ? 'bg-brand' : 'bg-bg-600'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted tabular-nums shrink-0">
                      {d.completed}/{d.total_visits}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px]">
                    {d.red_visits > 0 && <span className="text-accent-red">{d.red_visits} RED</span>}
                    {d.high_priority > 0 && <span className="text-accent-yellow">▲ {d.high_priority}</span>}
                    {d.vip_visits > 0 && <span className="text-cmr">★ {d.vip_visits}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col gap-3 min-h-0 overflow-hidden">
          {!selected ? (
            <div className="panel p-8 text-center text-text-muted text-sm">
              Selecciona una ruta para preparar o gestionar problemas.
            </div>
          ) : (
            <>
              <DriverHeader
                driver={selected}
                incidentExtra={Number(stateQ.data?.incidents?.[String(selected.vehicle_id)] ?? 0)}
              />

              {/* Right tabs */}
              <div className="flex gap-1 border-b border-line">
                {(
                  [
                    { key: 'prep', label: 'Preparar ruta', icon: ShieldCheck },
                    { key: 'live', label: 'En ruta', icon: Radio },
                    { key: 'problems', label: 'Problemas activos', icon: AlertTriangle },
                    { key: 'asistente', label: 'Asistente IA', icon: Sparkles },
                  ] as { key: RightTab; label: string; icon: any }[]
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setRightTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-wider border-b-2 transition-colors ${
                      rightTab === key
                        ? 'border-brand text-brand'
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-auto">
                {rightTab === 'prep' && (
                  <PreparationView driver={selected} canMarkVip={isAdmin} notifMap={notifMap} onNotify={setNotifyVisit} />
                )}
                {rightTab === 'live' && (
                  <LiveView
                    driver={selected}
                    notifMap={notifMap}
                    incidentExtra={Number(stateQ.data?.incidents?.[String(selected.vehicle_id)] ?? 0)}
                    canMarkVip={isAdmin}
                    onNotify={setNotifyVisit}
                  />
                )}
                {rightTab === 'problems' && (
                  <ProblemsView
                    driver={selected}
                    notifMap={notifMap}
                    incidentExtra={Number(stateQ.data?.incidents?.[String(selected.vehicle_id)] ?? 0)}
                    onNotify={setNotifyVisit}
                  />
                )}
                {rightTab === 'asistente' && (
                  <AsistenteIAPanel driver={selected} />
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {notifyVisit && selected && (
        <NotifyVisitModal
          visit={notifyVisit}
          driver={selected}
          onClose={() => {
            setNotifyVisit(null);
            qc.invalidateQueries({ queryKey: ['route-ops-notif'] });
          }}
        />
      )}
    </div>
  );
}

function KpiTile({ label, value, icon: Icon, accent, hint }: {
  label: string; value: number | string; icon: any; accent?: string; hint?: string;
}) {
  return (
    <div className="kpi-card" title={hint}>
      <div className="kpi-label flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className={`kpi-value tabular-nums ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

function DriverHeader({ driver, incidentExtra }: { driver: PlanDriver & { empresa_nombre: string }; incidentExtra: number }) {
  const status = driverStatus(driver);
  const meta = STATUS_META[status];
  const pct = driver.total_visits > 0 ? Math.round((driver.completed / driver.total_visits) * 100) : 0;
  const next = driver.visits.find(v => v.status === 'pending');
  return (
    <div className="panel">
      <div className="p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Truck size={16} className={status === 'en_ruta' ? 'text-brand animate-pulse' : 'text-text-secondary'} />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate flex items-center gap-2">
              <span className="font-mono">{driver.vehicle_name}</span>
              <span className="text-text-secondary">·</span>
              <span className="truncate">{driver.driver_name}</span>
              <span className={meta.cls}>{meta.label}</span>
              {incidentExtra > 0 && (
                <span className="pill bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/40 flex items-center gap-1">
                  <Wrench size={10} /> +{incidentExtra.toFixed(0)}m
                </span>
              )}
            </div>
            <div className="text-[11px] text-text-muted truncate flex items-center gap-1">
              <Building2 size={10} /> {driver.empresa_nombre}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto text-[11px]">
          <div className="flex items-center gap-2 min-w-[180px]">
            <div className="flex-1 h-1.5 bg-bg-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${pct === 100 ? 'bg-accent-green' : pct > 0 ? 'bg-brand' : 'bg-bg-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-text-muted tabular-nums shrink-0">{pct}%</span>
          </div>
          <span className="text-text-muted">{driver.completed}/{driver.total_visits}</span>
          {driver.red_visits > 0 && <span className="text-accent-red">{driver.red_visits} RED</span>}
          {driver.high_priority > 0 && <span className="text-accent-yellow">▲ {driver.high_priority}</span>}
          {driver.vip_visits > 0 && <span className="text-cmr">★ {driver.vip_visits}</span>}
          {next && (
            <span className="text-brand flex items-center gap-1">
              <ChevronRight size={11} /> próx #{next.order} · {next.estimated_time_arrival.slice(0, 5)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- Preparación -----
function PreparationView({ driver, canMarkVip, notifMap, onNotify }: {
  driver: PlanDriver; canMarkVip: boolean; notifMap: Record<string, TrackingNotifSummary>;
  onNotify: (v: PlanVisit) => void;
}) {
  const checks = [
    {
      label: `Sin RED al inicio (${driver.red_visits} RED actual)`,
      ok: driver.red_visits === 0,
    },
    {
      label: `Prioridades revisadas (${driver.high_priority + driver.vip_visits} marcadas)`,
      ok: driver.high_priority + driver.vip_visits > 0,
    },
    {
      label: `Slacks negativos: ${driver.visits.filter(v => v.status === 'pending' && v.slack_min < 0).length}`,
      ok: driver.visits.filter(v => v.status === 'pending' && v.slack_min < 0).length === 0,
    },
    {
      label: `VIPs sin alerta (${driver.visits.filter(v => v.is_vip && v.alert_slack !== 'GREEN' && v.status === 'pending').length} VIP en riesgo)`,
      ok: driver.visits.filter(v => v.is_vip && v.alert_slack !== 'GREEN' && v.status === 'pending').length === 0,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <ShieldCheck size={13} /> Checklist pre-salida
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {checks.map((c, i) => (
            <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded border ${c.ok ? 'border-accent-green/30 bg-accent-green/5 text-accent-green' : 'border-accent-red/30 bg-accent-red/5 text-accent-red'}`}>
              {c.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              <span className="text-text-primary">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <VisitsTable
        driver={driver}
        notifMap={notifMap}
        canMarkVip={canMarkVip}
        onNotify={onNotify}
        mode="prep"
      />
    </div>
  );
}

// ----- Live -----
function LiveView({ driver, notifMap, incidentExtra, canMarkVip, onNotify }: {
  driver: PlanDriver; notifMap: Record<string, TrackingNotifSummary>; incidentExtra: number;
  canMarkVip: boolean; onNotify: (v: PlanVisit) => void;
}) {
  const next3 = driver.visits.filter(v => v.status === 'pending').slice(0, 3);
  return (
    <div className="flex flex-col gap-3">
      <IncidentInjector vehicleId={driver.vehicle_id} currentExtra={incidentExtra} />
      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <Radio size={13} className="text-brand" /> Próximas 3 paradas
        </div>
        <div className="p-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          {next3.length === 0 && (
            <div className="md:col-span-3 text-text-muted text-xs text-center p-3">
              Sin paradas pendientes.
            </div>
          )}
          {next3.map((v, idx) => (
            <NextStopCard key={v.tracking_id} v={v} index={idx} notif={notifMap[v.tracking_id]} onNotify={() => onNotify(v)} />
          ))}
        </div>
      </div>
      <VisitsTable
        driver={driver}
        notifMap={notifMap}
        canMarkVip={canMarkVip}
        onNotify={onNotify}
        mode="live"
      />
    </div>
  );
}

function NextStopCard({ v, index, notif, onNotify }: {
  v: PlanVisit; index: number; notif?: TrackingNotifSummary; onNotify: () => void;
}) {
  const slackClass = v.slack_min < 0 ? 'text-accent-red' : v.slack_min < 20 ? 'text-accent-yellow' : 'text-brand';
  return (
    <div className={`panel p-2 ${index === 0 ? 'border-2 border-brand' : ''}`}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-text-muted mb-1">
        <span>{index === 0 ? 'En curso / próxima' : `+${index}`}</span>
        <span className="font-mono">#{v.order}</span>
      </div>
      <div className="text-xs font-medium truncate flex items-center gap-1">
        {v.is_vip && <Star size={11} className="text-cmr" />}
        {v.alert_valuedata && <Zap size={10} className="text-accent-violet" />}
        {v.title}
        <NotifiedBadge summary={notif} size="xs" />
      </div>
      <div className="text-[11px] text-text-muted truncate" title={v.address}>{v.address}</div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="tabular-nums"><Clock size={10} className="inline mr-1" />{v.estimated_time_arrival.slice(0, 5)}</span>
        <span className={`tabular-nums ${slackClass}`}>slack {v.slack_min.toFixed(0)}m</span>
        <span className={`tabular-nums ${v.p_fallo >= 0.5 ? 'text-accent-red' : v.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'}`}>
          {(v.p_fallo * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        <button onClick={onNotify} className="btn-primary flex items-center gap-1 text-[10px] flex-1 justify-center">
          <Phone size={10} /> Notificar
        </button>
        <ReportMotivoButton
          trackingId={v.tracking_id}
          variant="ghost"
          className="!text-[10px] !py-0.5 !px-2 flex-1 justify-center"
        />
      </div>
    </div>
  );
}

// ----- Problems -----
function ProblemsView({ driver, notifMap, incidentExtra, onNotify }: {
  driver: PlanDriver; notifMap: Record<string, TrackingNotifSummary>; incidentExtra: number;
  onNotify: (v: PlanVisit) => void;
}) {
  const qc = useQueryClient();

  const problemVisits = driver.visits.filter(v =>
    v.status === 'pending' && (v.alert_slack === 'RED' || v.alert_valuedata || v.p_fallo >= 0.4 || v.slack_min < 0)
  );

  const clearIncident = useMutation({
    mutationFn: () => api.postIncident(driver.vehicle_id, -incidentExtra),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['state'] }),
  });

  return (
    <div className="flex flex-col gap-3">
      {incidentExtra > 0 && (
        <div className="panel border-accent-yellow/40 border-2">
          <div className="p-3 flex items-center gap-3">
            <Wrench size={16} className="text-accent-yellow" />
            <div className="flex-1">
              <div className="text-sm font-semibold">Incidente activo: +{incidentExtra.toFixed(0)} min</div>
              <div className="text-[11px] text-text-muted">
                El simulador está aplicando este retraso al vehículo. Resuelve cuando la situación esté controlada.
              </div>
            </div>
            <button
              onClick={() => clearIncident.mutate()}
              disabled={clearIncident.isPending}
              className="btn flex items-center gap-1 text-[11px]"
            >
              {clearIncident.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Resolver incidente
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <Flame size={13} className="text-accent-red" />
          <span>Visitas con problema</span>
          <span className="ml-auto normal-case tracking-normal text-text-muted">
            {problemVisits.length} de {driver.pending} pendientes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-text-muted uppercase tracking-wider text-[10px] border-b border-line bg-bg-700/40">
              <tr>
                <th className="px-2 py-1 text-left w-10">#</th>
                <th className="px-2 py-1 text-left">Cliente</th>
                <th className="px-2 py-1 text-left">ETA / Window</th>
                <th className="px-2 py-1 text-right">Slack</th>
                <th className="px-2 py-1 text-right">P(fallo)</th>
                <th className="px-2 py-1 text-center">Status</th>
                <th className="px-2 py-1 text-center">Prioridad</th>
                <th className="px-2 py-1 text-center w-[260px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {problemVisits.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-text-muted py-6 text-xs">
                    Sin problemas pendientes en esta ruta. 🎉
                  </td>
                </tr>
              )}
              {problemVisits.map(v => (
                <ProblemRow
                  key={v.tracking_id}
                  v={v}
                  notif={notifMap[v.tracking_id]}
                  onNotify={() => onNotify(v)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProblemRow({ v, notif, onNotify }: { v: PlanVisit; notif?: TrackingNotifSummary; onNotify: () => void }) {
  const qc = useQueryClient();
  const setPriorityMut = useMutation({
    mutationFn: (req: { p: Priority; reason: string }) => api.priorities.set(v.tracking_id, req.p, req.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-diario'] }),
  });
  const slackClass = v.slack_min < 0 ? 'text-accent-red' : v.slack_min < 20 ? 'text-accent-yellow' : 'text-brand';

  return (
    <tr className="border-t border-line/40 hover:bg-bg-700/30">
      <td className="px-2 py-1 font-mono text-text-muted">{v.order}</td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1">
          {v.is_vip && <Star size={11} className="text-cmr" />}
          {v.alert_valuedata && <Zap size={10} className="text-accent-violet" />}
          <span className="font-medium truncate">{v.title}</span>
          <NotifiedBadge summary={notif} size="xs" />
        </div>
        <div className="text-[10px] text-text-muted truncate max-w-[280px]" title={v.address}>{v.address}</div>
      </td>
      <td className="px-2 py-1 tabular-nums">
        {v.estimated_time_arrival.slice(0, 5)} / <span className="text-text-muted">{(v.window_end ?? '').slice(0, 5)}</span>
      </td>
      <td className={`px-2 py-1 text-right tabular-nums ${slackClass}`}>{v.slack_min.toFixed(0)}</td>
      <td className="px-2 py-1 text-right tabular-nums">
        <span className={v.p_fallo >= 0.5 ? 'text-accent-red' : v.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'}>
          {(v.p_fallo * 100).toFixed(0)}%
        </span>
      </td>
      <td className="px-2 py-1 text-center">
        <span className={`pill ${v.alert_slack === 'RED' ? 'pill-red' : v.alert_slack === 'YELLOW' ? 'pill-yellow' : 'pill-blue'}`}>
          {v.alert_slack}
        </span>
      </td>
      <td className="px-2 py-1 text-center">
        <PriorityPill p={v.priority} />
      </td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setPriorityMut.mutate({ p: 'high', reason: 'Escalado desde problemas en ruta' })}
            disabled={setPriorityMut.isPending || v.priority === 'high' || v.priority === 'vip'}
            className="btn flex items-center gap-1 text-[10px]"
            title="Escalar prioridad"
          >
            <ArrowUpCircle size={10} /> Escalar
          </button>
          <button
            onClick={() => setPriorityMut.mutate({ p: 'low', reason: 'Postergada por incidencia en ruta' })}
            disabled={setPriorityMut.isPending || v.priority === 'low'}
            className="btn flex items-center gap-1 text-[10px]"
            title="Postergar / saltar"
          >
            <SkipForward size={10} /> Postergar
          </button>
          <button onClick={onNotify} className="btn-primary flex items-center gap-1 text-[10px]">
            <Phone size={10} /> Notificar
          </button>
        </div>
      </td>
    </tr>
  );
}

// ----- Visits table compartida -----
function VisitsTable({ driver, notifMap, canMarkVip, onNotify, mode }: {
  driver: PlanDriver; notifMap: Record<string, TrackingNotifSummary>; canMarkVip: boolean;
  onNotify: (v: PlanVisit) => void; mode: 'prep' | 'live';
}) {
  return (
    <div className="panel">
      <div className="panel-title flex items-center gap-2">
        <MapPin size={13} />
        <span>Secuencia de visitas</span>
        <span className="ml-auto normal-case tracking-normal text-text-muted">
          {driver.total_visits} totales · {driver.pending} pendientes
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-text-muted uppercase tracking-wider text-[10px] border-b border-line bg-bg-700/40">
            <tr>
              <th className="px-2 py-1 text-left w-10">#</th>
              <th className="px-2 py-1 text-left">Cliente</th>
              <th className="px-2 py-1 text-left">Dirección</th>
              <th className="px-2 py-1 text-left">ETA</th>
              <th className="px-2 py-1 text-right">Slack</th>
              <th className="px-2 py-1 text-right">P(fallo)</th>
              <th className="px-2 py-1 text-center">Status</th>
              <th className="px-2 py-1 text-center">Prioridad</th>
              <th className="px-2 py-1 text-center w-[180px]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {driver.visits.map(v => (
              <VisitRow
                key={v.tracking_id}
                v={v}
                notif={notifMap[v.tracking_id]}
                canMarkVip={canMarkVip}
                onNotify={() => onNotify(v)}
                mode={mode}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisitRow({ v, notif, canMarkVip, onNotify, mode }: {
  v: PlanVisit; notif?: TrackingNotifSummary; canMarkVip: boolean; onNotify: () => void; mode: 'prep' | 'live';
}) {
  const qc = useQueryClient();
  const setPriorityMut = useMutation({
    mutationFn: (req: { p: Priority; reason: string }) => api.priorities.set(v.tracking_id, req.p, req.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-diario'] }),
  });
  const markVip = useMutation({
    mutationFn: () => api.vip.create({
      match_type: 'title',
      match_value: v.title,
      tier: 'VIP',
      notes: `Marcado desde Operación de ruta · ${v.tracking_id}`,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-diario'] }),
  });

  const slackClass = v.slack_min < 0 ? 'text-accent-red' : v.slack_min < 20 ? 'text-accent-yellow' : 'text-brand';
  const rowClass =
    v.status === 'completed' ? 'opacity-70'
    : v.is_vip ? 'bg-cmr/5'
    : v.priority === 'high' ? 'bg-accent-red/5'
    : '';

  return (
    <tr className={`border-t border-line/40 hover:bg-bg-700/30 ${rowClass}`}>
      <td className="px-2 py-1 font-mono text-text-muted">{v.order}</td>
      <td className="px-2 py-1">
        <div className="flex items-center gap-1">
          {v.is_vip && <Star size={11} className="text-cmr" />}
          {v.alert_valuedata && <Zap size={10} className="text-accent-violet" />}
          <span className="font-medium truncate">{v.title}</span>
          <NotifiedBadge summary={notif} size="xs" />
        </div>
      </td>
      <td className="px-2 py-1 text-text-muted truncate max-w-[240px]" title={v.address}>{v.address}</td>
      <td className="px-2 py-1 tabular-nums">{v.estimated_time_arrival.slice(0, 5)}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${slackClass}`}>{v.slack_min.toFixed(0)}</td>
      <td className="px-2 py-1 text-right tabular-nums">
        <span className={v.p_fallo >= 0.5 ? 'text-accent-red' : v.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'}>
          {(v.p_fallo * 100).toFixed(0)}%
        </span>
      </td>
      <td className="px-2 py-1 text-center">
        <span className={`pill ${v.status === 'completed' ? 'pill-green' : v.alert_slack === 'RED' ? 'pill-red' : v.alert_slack === 'YELLOW' ? 'pill-yellow' : 'pill-blue'}`}>
          {v.status === 'completed' ? 'OK' : v.alert_slack}
        </span>
      </td>
      <td className="px-2 py-1 text-center"><PriorityPill p={v.priority} /></td>
      <td className="px-2 py-1">
        <div className="flex items-center justify-center gap-1">
          {v.status === 'pending' && (
            <>
              <button
                onClick={() => setPriorityMut.mutate({ p: 'high', reason: mode === 'prep' ? 'Elevada en preparación' : 'Elevada en ruta' })}
                disabled={setPriorityMut.isPending || v.priority === 'high' || v.priority === 'vip'}
                className="text-text-muted hover:text-accent-yellow"
                title="Elevar prioridad"
              >
                <ArrowUpCircle size={12} />
              </button>
              <button
                onClick={() => setPriorityMut.mutate({ p: 'low', reason: mode === 'prep' ? 'Bajada en preparación' : 'Postergada en ruta' })}
                disabled={setPriorityMut.isPending || v.priority === 'low'}
                className="text-text-muted hover:text-accent-blue"
                title="Bajar prioridad"
              >
                <ArrowDownCircle size={12} />
              </button>
              {canMarkVip && !v.is_vip && (
                <button
                  onClick={() => markVip.mutate()}
                  disabled={markVip.isPending}
                  className="text-text-muted hover:text-cmr"
                  title="Marcar cliente como VIP"
                >
                  <Star size={11} />
                </button>
              )}
              <button onClick={onNotify} className="text-text-muted hover:text-brand" title="Notificar al cliente">
                <Phone size={11} />
              </button>
              <ReportMotivoButton
                trackingId={v.tracking_id}
                variant="ghost"
                className="!px-1.5 !py-0.5 text-[10px]"
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function PriorityPill({ p }: { p: PlanVisit['priority'] }) {
  const cls: Record<PlanVisit['priority'], string> = {
    vip: 'bg-cmr/20 text-cmr border-cmr/40',
    high: 'bg-accent-red/20 text-accent-red border-accent-red/40',
    normal: 'bg-bg-700 text-text-secondary border-line',
    low: 'bg-bg-700 text-text-muted border-line',
  };
  return <span className={`pill border ${cls[p]}`}>{p.toUpperCase()}</span>;
}

// ----- Incident injector -----
function IncidentInjector({ vehicleId, currentExtra }: { vehicleId: number; currentExtra: number }) {
  const qc = useQueryClient();
  const [extra, setExtra] = useState<number>(15);
  const [reason, setReason] = useState<string>(INCIDENT_PRESETS[0].reason);

  const addMut = useMutation({
    mutationFn: () => api.postIncident(vehicleId, extra),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['state'] }),
  });
  const clearMut = useMutation({
    mutationFn: () => api.postIncident(vehicleId, -currentExtra),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['state'] }),
  });

  return (
    <div className="panel">
      <div className="panel-title flex items-center gap-2">
        <Wrench size={13} className={currentExtra > 0 ? 'text-accent-yellow' : ''} />
        <span>Incidencia en ruta</span>
        <span className="ml-auto normal-case tracking-normal text-text-muted">
          retraso vigente: <span className={currentExtra > 0 ? 'text-accent-yellow' : 'text-text-secondary'}>+{currentExtra.toFixed(0)} min</span>
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          {INCIDENT_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setExtra(p.mins); setReason(p.reason); }}
              className={`btn text-[10px] flex items-center gap-1 ${extra === p.mins && reason === p.reason ? 'border-brand text-brand' : ''}`}
            >
              {p.label} · +{p.mins}m
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-text-muted">Retraso (min)</span>
            <input
              type="number"
              min={1}
              max={240}
              value={extra}
              onChange={e => setExtra(Math.max(1, Math.min(240, Number(e.target.value) || 0)))}
              className="input w-20 tabular-nums"
            />
          </label>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Motivo (opcional)"
            className="input flex-1 min-w-[200px]"
          />
          <button
            onClick={() => addMut.mutate()}
            disabled={addMut.isPending || extra <= 0}
            className="btn-primary flex items-center gap-1 text-[11px]"
          >
            {addMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Wrench size={11} />}
            Inyectar
          </button>
          {currentExtra > 0 && (
            <button
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
              className="btn flex items-center gap-1 text-[11px]"
            >
              {clearMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
              Liberar
            </button>
          )}
        </div>
        {(addMut.isError || clearMut.isError) && (
          <span className="text-[11px] text-accent-red">
            {String(addMut.error || clearMut.error)}
          </span>
        )}
      </div>
    </div>
  );
}

// ----- Notify modal -----
function NotifyVisitModal({ visit, driver, onClose }: {
  visit: PlanVisit; driver: PlanDriver; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [numbers, setNumbers] = useState('');
  const defaultBody =
    `[Falabella ValueData] Actualización de entrega\n` +
    `Cliente: ${visit.title}\n` +
    `Vehículo: ${driver.vehicle_name} (${driver.driver_name})\n` +
    `ETA: ${visit.estimated_time_arrival.slice(0, 5)} · Window: ${(visit.window_end ?? '').slice(0, 5)} · Slack: ${visit.slack_min.toFixed(0)}m\n` +
    `Riesgo de fallo: ${(visit.p_fallo * 100).toFixed(0)}%`;
  const [body, setBody] = useState(defaultBody);

  const sendMut = useMutation({
    mutationFn: () => api.notif.send({
      body,
      to_numbers: numbers.split(',').map(s => s.trim()).filter(Boolean),
      tracking_id: visit.tracking_id,
      subject: `Actualización ${visit.title}`,
      triggered_by: 'route-ops',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['route-ops-notif'] });
      qc.invalidateQueries({ queryKey: ['plan-notif-summary'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg panel" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare size={14} /> Notificar: {visit.title}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-accent-red"><X size={16} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Destinatarios (E.164 separados por coma)</span>
            <input value={numbers} onChange={e => setNumbers(e.target.value)} placeholder="+56912345678" className="input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Mensaje</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} className="input font-mono text-[11px] resize-none" />
          </label>
          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <button
              onClick={() => sendMut.mutate()}
              disabled={sendMut.isPending || !numbers.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {sendMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
              Enviar WhatsApp
            </button>
            <button onClick={onClose} className="btn">Cancelar</button>
            {sendMut.isError && <span className="text-[11px] text-accent-red">{String(sendMut.error)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
