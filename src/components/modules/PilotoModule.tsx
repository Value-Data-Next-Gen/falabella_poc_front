/**
 * PilotoModule — UI del módulo Piloto (Fase 3 MVP refactor).
 *
 * Consume los endpoints `/api/admin/pilot/*` y `/api/operacion/driver-positions`
 * para permitir al ops generar un piloto sintético (drivers, regiones, visitas
 * por driver, horario), avanzar manualmente el sim_clock, simular eventos por
 * visita y ver en vivo el progreso (mapa + tabla).
 *
 * Visibilidad: solo `falabella_admin` / `falabella_ops` (gated en AppShell vía
 * Sidebar.tsx con `falabellaOnly: true`). El backend ya impone admin/ops para
 * todos los endpoints `/admin/pilot/*` salvo `driver-positions` (current_user).
 *
 * Convenciones:
 *  - todo el polling se hace con react-query (refetchInterval).
 *  - mutations invalidan las 3 queries vivas: pilot-clock / pilot-status /
 *    pilot-driver-positions.
 *  - tokens visuales: usamos las clases utility del proyecto (`panel`, `btn`,
 *    `input`) más `text-brand` / `accent-*` para mantener consistencia con el
 *    resto de los módulos.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Clock, FlaskConical, Play,
  RefreshCw, RotateCcw, XCircle,
} from 'lucide-react';
import {
  api,
  getDriverPositions,
  getPilotClock,
  getPilotStatus,
  pilotSetup,
  pilotSimulateEvent,
  setPilotClock,
  type PilotClockResponse,
  type PilotSetupRequest,
  type PilotStatusResponse,
} from '../../api';
import { useDiaActivo } from '../../hooks/useDiaActivo';
import { REGIONES_CL } from '../../lib/regiones';
import { PilotoMap } from './PilotoMap';

// Conjunto de regiones a ofrecer en el setup. Toggle simple por chip.
const REGIONES_PILOTO = REGIONES_CL;

// Helper: formato HH:MM desde un ISO. Fallback "--:--".
function hhmm(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const t = iso.indexOf('T');
  if (t < 0) return iso.slice(11, 16) || '--:--';
  return iso.slice(t + 1, t + 6);
}

// Helper: minutos entre dos ISOs (puede ser negativo). Devuelve null si no se
// puede parsear.
function minsBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  if (!fromIso || !toIso) return null;
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 60000);
}

export function PilotoModule() {
  const qc = useQueryClient();
  const { fecha } = useDiaActivo();

  // -----------------------------------------------------------------------
  // Form state — setup del piloto.
  // -----------------------------------------------------------------------
  const [selDriverIds, setSelDriverIds] = useState<string[]>([]);
  const [selRegiones, setSelRegiones] = useState<string[]>(['Metropolitana']);
  const [visitasPorDriver, setVisitasPorDriver] = useState<number>(3);
  const [horarioInicio, setHorarioInicio] = useState<string>('09:00');
  const [horarioFin, setHorarioFin] = useState<string>('18:00');
  const [autoStartDay, setAutoStartDay] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Queries.
  // -----------------------------------------------------------------------
  const driversQ = useQuery({
    queryKey: ['drivers-list-piloto'],
    queryFn: () => api.drivers(),
    staleTime: 60_000,
  });

  const clockQ = useQuery<PilotClockResponse>({
    queryKey: ['pilot-clock', fecha],
    queryFn: () => getPilotClock(fecha),
    refetchInterval: 30_000,
    enabled: !!fecha,
  });

  const statusQ = useQuery<PilotStatusResponse>({
    queryKey: ['pilot-status', fecha],
    queryFn: () => getPilotStatus(fecha),
    refetchInterval: 15_000,
    enabled: !!fecha,
  });

  const positionsQ = useQuery({
    queryKey: ['pilot-driver-positions', fecha],
    queryFn: () => getDriverPositions(fecha),
    refetchInterval: 30_000,
    enabled: !!fecha,
  });

  // -----------------------------------------------------------------------
  // Mutations.
  // -----------------------------------------------------------------------
  const invalidatePiloto = () => {
    qc.invalidateQueries({ queryKey: ['pilot-clock', fecha] });
    qc.invalidateQueries({ queryKey: ['pilot-status', fecha] });
    qc.invalidateQueries({ queryKey: ['pilot-driver-positions', fecha] });
  };

  const setupMut = useMutation({
    mutationFn: (body: PilotSetupRequest) => pilotSetup(body),
    onSuccess: invalidatePiloto,
  });

  const clockMut = useMutation({
    mutationFn: (req: { action: 'advance' | 'reset'; minutes?: number }) =>
      setPilotClock(fecha, req.action, req.minutes),
    onSuccess: invalidatePiloto,
  });

  const eventMut = useMutation({
    mutationFn: (req: { tid: string | number; event: 'delay' | 'complete' | 'no_show' }) =>
      pilotSimulateEvent(req.tid, req.event),
    onSuccess: invalidatePiloto,
  });

  // -----------------------------------------------------------------------
  // Handlers de form.
  // -----------------------------------------------------------------------
  const toggleDriver = (driverId: string) => {
    setSelDriverIds((cur) =>
      cur.includes(driverId) ? cur.filter(x => x !== driverId) : [...cur, driverId]
    );
  };
  const toggleRegion = (region: string) => {
    setSelRegiones((cur) =>
      cur.includes(region) ? cur.filter(x => x !== region) : [...cur, region]
    );
  };

  const submitSetup = () => {
    setFormError(null);
    if (selDriverIds.length === 0) {
      setFormError('Seleccioná al menos un driver.');
      return;
    }
    if (selRegiones.length === 0) {
      setFormError('Seleccioná al menos una región.');
      return;
    }
    if (visitasPorDriver < 1 || visitasPorDriver > 50) {
      setFormError('Visitas por driver debe estar entre 1 y 50.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(horarioInicio) || !/^\d{2}:\d{2}$/.test(horarioFin)) {
      setFormError('Horario inválido (formato HH:MM).');
      return;
    }
    if (horarioInicio >= horarioFin) {
      setFormError('Horario fin debe ser posterior a inicio.');
      return;
    }
    setupMut.mutate({
      fecha,
      driver_ids: selDriverIds,
      regiones: selRegiones,
      visitas_por_driver: visitasPorDriver,
      horario_inicio: horarioInicio,
      horario_fin: horarioFin,
      auto_start_day: autoStartDay,
    });
  };

  // -----------------------------------------------------------------------
  // Derivados de status.
  // -----------------------------------------------------------------------
  const totals = statusQ.data?.totals ?? { pending: 0, completed: 0, failed: 0 };
  const nextBreachMin = useMemo(
    () => minsBetween(clockQ.data?.sim_clock, statusQ.data?.next_eta_breach_at ?? null),
    [clockQ.data?.sim_clock, statusQ.data?.next_eta_breach_at],
  );

  const positions = positionsQ.data ?? [];

  return (
    <div className="h-full overflow-auto bg-bg-900 text-text-primary">
      <div className="max-w-7xl mx-auto p-4 flex flex-col gap-4">

        {/* ───── Header con fecha + estado del día ───── */}
        <div className="panel p-3 flex flex-wrap items-center gap-3">
          <FlaskConical size={18} className="text-brand" />
          <div className="flex flex-col leading-tight">
            <div className="text-[13px] font-semibold">Piloto — Día {fecha}</div>
            <div className="text-[10px] text-text-muted">
              Generación sintética de drivers + visitas, reloj manual y eventos por visita.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DayStateBadge state={statusQ.data?.day_state ?? null} />
            <button
              onClick={() => {
                qc.invalidateQueries({ queryKey: ['pilot-clock', fecha] });
                qc.invalidateQueries({ queryKey: ['pilot-status', fecha] });
                qc.invalidateQueries({ queryKey: ['pilot-driver-positions', fecha] });
              }}
              className="btn !py-1 !px-2 text-[11px] flex items-center gap-1"
              title="Refrescar todo"
            >
              <RefreshCw size={11} /> Refrescar
            </button>
          </div>
        </div>

        {/* ───── Sim clock ───── */}
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
            <Clock size={11} /> Reloj de simulación
          </div>
          {clockQ.isLoading && (
            <div className="text-[11px] text-text-muted">Cargando reloj…</div>
          )}
          {clockQ.isError && (
            <div className="text-[11px] text-accent-red">
              No se pudo cargar el reloj del piloto.
            </div>
          )}
          {clockQ.data && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-[22px] font-mono tabular-nums text-brand">
                {hhmm(clockQ.data.sim_clock)}
              </div>
              <div className="text-[11px] text-text-muted">
                modo <span className="font-mono text-text-secondary">{clockQ.data.mode}</span>
                {' · '}
                offset <span className="font-mono text-text-secondary">{clockQ.data.offset_min >= 0 ? '+' : ''}{clockQ.data.offset_min} min</span>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {[15, 30, 60].map((m) => (
                  <button
                    key={m}
                    onClick={() => clockMut.mutate({ action: 'advance', minutes: m })}
                    disabled={clockMut.isPending}
                    className="btn !py-1 !px-2 text-[11px] flex items-center gap-1 disabled:opacity-50"
                    title={`Avanzar ${m} minutos`}
                  >
                    <Play size={10} /> +{m}min
                  </button>
                ))}
                <button
                  onClick={() => clockMut.mutate({ action: 'reset' })}
                  disabled={clockMut.isPending}
                  className="btn !py-1 !px-2 text-[11px] flex items-center gap-1 disabled:opacity-50"
                  title="Volver al modo auto (sin offset)"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              </div>
            </div>
          )}
          {clockMut.isError && (
            <div className="mt-2 text-[10px] text-accent-red">
              Error al cambiar el reloj: {(clockMut.error as Error)?.message ?? 'desconocido'}
            </div>
          )}
        </div>

        {/* ───── Setup del día ───── */}
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Setup del día (genera piloto sintético)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Drivers */}
            <div>
              <div className="text-[11px] text-text-secondary mb-1">
                Drivers ({selDriverIds.length} seleccionados)
              </div>
              {driversQ.isLoading && (
                <div className="text-[10px] text-text-muted">Cargando drivers…</div>
              )}
              {driversQ.isError && (
                <div className="text-[10px] text-accent-red">No se pudieron cargar los drivers.</div>
              )}
              {driversQ.data && (
                <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1 pr-1">
                  {driversQ.data.length === 0 ? (
                    <div className="text-[10px] text-text-muted italic">Sin drivers activos.</div>
                  ) : (
                    driversQ.data.map(d => {
                      const sel = selDriverIds.includes(d.driver_id);
                      return (
                        <button
                          key={d.driver_id}
                          type="button"
                          onClick={() => toggleDriver(d.driver_id)}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                            sel
                              ? 'bg-brand/15 text-brand border-brand/40'
                              : 'border-line/40 text-text-secondary hover:bg-bg-700/40 hover:border-line'
                          }`}
                        >
                          {sel ? '☑ ' : '☐ '}{d.driver_id} <span className="text-text-muted">· {d.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Regiones */}
            <div>
              <div className="text-[11px] text-text-secondary mb-1">
                Regiones ({selRegiones.length} seleccionadas)
              </div>
              <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1 pr-1">
                {REGIONES_PILOTO.map(r => {
                  const sel = selRegiones.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRegion(r)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        sel
                          ? 'bg-brand/15 text-brand border-brand/40'
                          : 'border-line/40 text-text-secondary hover:bg-bg-700/40 hover:border-line'
                      }`}
                    >
                      {sel ? '☑ ' : '☐ '}{r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visitas / Horario */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="text-[11px] text-text-secondary mb-1">Visitas / driver</div>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={visitasPorDriver}
                  onChange={e => setVisitasPorDriver(Number(e.target.value) || 0)}
                  className="input text-[11px] py-1 w-20 tabular-nums"
                />
              </div>
              <div>
                <div className="text-[11px] text-text-secondary mb-1">Horario inicio</div>
                <input
                  type="time"
                  value={horarioInicio}
                  onChange={e => setHorarioInicio(e.target.value)}
                  className="input text-[11px] py-1 w-28 tabular-nums"
                />
              </div>
              <div>
                <div className="text-[11px] text-text-secondary mb-1">Horario fin</div>
                <input
                  type="time"
                  value={horarioFin}
                  onChange={e => setHorarioFin(e.target.value)}
                  className="input text-[11px] py-1 w-28 tabular-nums"
                />
              </div>
            </div>

            {/* Auto-start */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={autoStartDay}
                  onChange={e => setAutoStartDay(e.target.checked)}
                  className="accent-brand"
                />
                Auto-iniciar día (transiciona a EN_CURSO)
              </label>
            </div>
          </div>

          {formError && (
            <div className="mt-3 text-[11px] text-accent-red flex items-center gap-1">
              <AlertTriangle size={11} /> {formError}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={submitSetup}
              disabled={setupMut.isPending}
              className="btn-primary !py-1.5 !px-3 text-[12px] flex items-center gap-1 disabled:opacity-50"
            >
              <Play size={12} /> {setupMut.isPending ? 'Generando…' : 'Generar piloto'}
            </button>
            {setupMut.data && (
              <div className="text-[11px] text-emerald-500">
                ✓ {setupMut.data.created} visitas creadas en {setupMut.data.drivers.length} drivers
                {setupMut.data.regiones_used.length > 0 && (
                  <span className="text-text-muted">
                    {' '}· regiones: {setupMut.data.regiones_used.join(', ')}
                  </span>
                )}
              </div>
            )}
            {setupMut.isError && (
              <div className="text-[11px] text-accent-red">
                Error: {(setupMut.error as Error)?.message ?? 'desconocido'}
              </div>
            )}
          </div>
        </div>

        {/* ───── Resumen ───── */}
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
            <CalendarClock size={11} /> Resumen del día
          </div>
          {statusQ.isLoading && (
            <div className="text-[11px] text-text-muted">Cargando estado…</div>
          )}
          {statusQ.isError && (
            <div className="text-[11px] text-accent-red">No se pudo cargar el estado del piloto.</div>
          )}
          {statusQ.data && (
            <div className="flex flex-wrap items-center gap-4 text-[12px]">
              <StatTile label="Pending"   value={totals.pending}   color="text-text-primary" />
              <StatTile label="Completed" value={totals.completed} color="text-emerald-500" />
              <StatTile label="Failed"    value={totals.failed}    color="text-accent-red" />
              <div className="ml-auto text-[11px] text-text-muted">
                {statusQ.data.next_eta_breach_at ? (
                  <>
                    Próxima alerta ETA:{' '}
                    <span className="font-mono tabular-nums text-amber-500">
                      {hhmm(statusQ.data.next_eta_breach_at)}
                    </span>
                    {nextBreachMin != null && (
                      <span className="text-text-muted">
                        {' '}({nextBreachMin >= 0 ? `en ${nextBreachMin} min` : `hace ${-nextBreachMin} min`})
                      </span>
                    )}
                  </>
                ) : (
                  <span>Sin breach pronosticado.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ───── Tabla de drivers + visitas ─────
            Nota: hoy no hay un endpoint listing de visitas por piloto en el
            backend (status devuelve solo agregados por driver). El detalle por
            tracking_id queda como TODO Fase 4 — mientras tanto mostramos los
            drivers con sus contadores y un acceso a simular eventos por
            next_visit_id desde el shape de driver-positions. */}
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Drivers en piloto
          </div>
          {(statusQ.data?.drivers?.length ?? 0) === 0 ? (
            <div className="text-[11px] text-text-muted italic py-2">
              Sin drivers configurados. Generá un piloto arriba.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="text-text-muted text-[10px] uppercase tracking-wider border-b border-line/40">
                  <tr>
                    <th className="text-left py-1.5 px-2">Driver</th>
                    <th className="text-left py-1.5 px-2">Vehículo</th>
                    <th className="text-right py-1.5 px-2">Pending</th>
                    <th className="text-right py-1.5 px-2">Done</th>
                    <th className="text-right py-1.5 px-2">Failed</th>
                    <th className="text-left py-1.5 px-2">Próxima visita</th>
                    <th className="text-left py-1.5 px-2">Status</th>
                    <th className="text-right py-1.5 px-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {statusQ.data!.drivers.map(sd => {
                    const pos = positions.find(p => p.driver_id === sd.driver_id);
                    const nextEta = pos?.next_visit_eta ? hhmm(pos.next_visit_eta) : null;
                    const tid = pos?.next_visit_id ?? null;
                    return (
                      <tr key={sd.driver_id} className="border-b border-line/20 hover:bg-bg-700/30">
                        <td className="py-1.5 px-2">
                          <div className="font-medium">{sd.driver_name || sd.driver_id}</div>
                          <div className="text-text-muted text-[10px]">{sd.driver_id}</div>
                        </td>
                        <td className="py-1.5 px-2 font-mono text-text-muted">{sd.vehicle_id}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{sd.pending}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-emerald-500">{sd.completed}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums text-accent-red">{sd.failed}</td>
                        <td className="py-1.5 px-2">
                          {pos?.next_visit_title ? (
                            <div className="flex flex-col leading-tight">
                              <span className="truncate max-w-[200px]">{pos.next_visit_title}</span>
                              {nextEta && (
                                <span className="text-text-muted text-[10px] font-mono">ETA {nextEta}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          <StatusPill status={pos?.status ?? null} />
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {tid ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => eventMut.mutate({ tid, event: 'delay' })}
                                disabled={eventMut.isPending}
                                className="btn !py-0.5 !px-1.5 text-[10px] text-amber-500 border-amber-500/40 hover:bg-amber-500/10 disabled:opacity-50"
                                title="Simular delay"
                              >
                                <Clock size={10} />
                              </button>
                              <button
                                onClick={() => eventMut.mutate({ tid, event: 'complete' })}
                                disabled={eventMut.isPending}
                                className="btn !py-0.5 !px-1.5 text-[10px] text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-50"
                                title="Simular complete"
                              >
                                <CheckCircle2 size={10} />
                              </button>
                              <button
                                onClick={() => eventMut.mutate({ tid, event: 'no_show' })}
                                disabled={eventMut.isPending}
                                className="btn !py-0.5 !px-1.5 text-[10px] text-accent-red border-accent-red/40 hover:bg-accent-red/10 disabled:opacity-50"
                                title="Simular no_show"
                              >
                                <XCircle size={10} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-text-muted text-[10px]">sin pending</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {eventMut.isError && (
            <div className="mt-2 text-[10px] text-accent-red">
              Evento falló: {(eventMut.error as Error)?.message ?? 'desconocido'}
            </div>
          )}
        </div>

        {/* ───── Mapa ───── */}
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between">
            <span>Mapa de drivers</span>
            <span className="text-text-muted normal-case tracking-normal text-[10px]">
              {positionsQ.data?.length ?? 0} driver{positionsQ.data?.length === 1 ? '' : 's'}
              {' · refresh 30s'}
            </span>
          </div>
          {positionsQ.isLoading && (
            <div className="h-[420px] flex items-center justify-center text-[11px] text-text-muted">
              Cargando posiciones…
            </div>
          )}
          {positionsQ.isError && (
            <div className="h-[420px] flex items-center justify-center text-[11px] text-accent-red">
              No se pudieron cargar las posiciones de drivers.
            </div>
          )}
          {positionsQ.data && (
            <PilotoMap positions={positionsQ.data} />
          )}
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// Sub-componentes simples.
// ============================================================================

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[9px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className={`text-[18px] tabular-nums font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function DayStateBadge({ state }: { state: string | null }) {
  if (!state) return null;
  const cls =
    state === 'EN_CURSO' ? 'text-brand bg-brand/15 border-brand/40' :
    state === 'VALIDADO' ? 'text-accent-blue bg-accent-blue/15 border-accent-blue/40' :
    state === 'CERRADO'  ? 'text-text-muted bg-bg-700 border-line' :
    'text-accent-yellow bg-accent-yellow/15 border-accent-yellow/40';
  return (
    <span className={`px-2 py-0.5 rounded border ${cls} font-mono text-[10px]`}>
      {state}
    </span>
  );
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="text-text-muted text-[10px]">—</span>;
  const cls =
    status === 'finalizado' ? 'text-text-muted bg-bg-700/60 border-line' :
    status === 'en_ruta'    ? 'text-brand bg-brand/15 border-brand/40' :
    status === 'detenido'   ? 'text-amber-500 bg-amber-500/15 border-amber-500/40' :
    'text-text-muted bg-bg-700 border-line';
  return (
    <span className={`px-1.5 py-0.5 rounded border ${cls} font-mono text-[9px] uppercase tracking-wider`}>
      {status}
    </span>
  );
}
