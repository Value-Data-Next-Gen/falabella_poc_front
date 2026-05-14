import { useEffect, useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronDown, ChevronRight, CircleAlert, Clock, Crown,
  ExternalLink, Loader2, MoreVertical, Pause, Play, ShieldAlert, Sliders,
  Square, Truck, Upload, Users, UsersRound, X, ClipboardList,
} from 'lucide-react';
import { api } from '../../api';
import { CargaEntregasPanel } from './CargaEntregasPanel';
import { DotacionPanel } from './DotacionPanel';
import { PlanDelDiaSimplePanel } from './PlanDelDiaSimplePanel';
import { ClientesDelDiaPanel } from './ClientesDelDiaPanel';
import { ConfigDelDiaPanel } from './ConfigDelDiaPanel';

interface Props {
  fecha: string;
  onChangeFecha: (f: string) => void;
  onJumpToTab: (key: string) => void;
  /** Slug de card a abrir por default (viene de slugs legacy /carga, /plan, etc.). */
  openCard?: string | null;
}

type DayState = 'BORRADOR' | 'VALIDADO' | 'EN_CURSO' | 'CERRADO';

const STATE_META: Record<DayState, { label: string; cls: string; tip: string }> = {
  BORRADOR: { label: 'BORRADOR',  cls: 'bg-bg-700 text-text-secondary border-line',
              tip: 'Día con visitas cargadas. Resolvé los issues bloqueantes y validá para pasar a VALIDADO.' },
  VALIDADO: { label: 'VALIDADO',  cls: 'bg-accent-blue/15 text-accent-blue border-accent-blue/40',
              tip: 'Listo para operar. Apretá "Iniciar día" para arrancar el reloj operativo.' },
  EN_CURSO: { label: 'EN CURSO',  cls: 'bg-accent-green/15 text-accent-green border-accent-green/40',
              tip: 'Reloj corriendo. El generador inyecta visitas en vivo.' },
  CERRADO:  { label: 'CERRADO',   cls: 'bg-bg-700 text-text-muted border-line',
              tip: 'Jornada cerrada. Solo lectura.' },
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function DiaOperativoPanel({ fecha, onChangeFecha, onJumpToTab, openCard }: Props) {
  const qc = useQueryClient();
  const [kebabOpen, setKebabOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'EN_CURSO' | 'CERRADO'>(null);

  const stateQ = useQuery({
    queryKey: ['day-state', fecha],
    queryFn: () => api.planificacion.getDayState(fecha),
    refetchInterval: 10_000,
  });
  const prepQ = useQuery({
    queryKey: ['day-prep', fecha],
    queryFn: () => api.planificacion.dayPrep(fecha),
    refetchInterval: 30_000,
  });

  const mut = useMutation({
    mutationFn: (req: { target: DayState; allowNonBlocking?: boolean }) =>
      api.planificacion.transitionDayState({
        fecha, target: req.target,
        confirm: req.target === 'EN_CURSO' || req.target === 'CERRADO',
        allow_non_blocking: !!req.allowNonBlocking,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state', fecha] });
      qc.invalidateQueries({ queryKey: ['planif-day-status', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
    },
  });

  // Rebobinar simulación del día EN_CURSO sin destruir plan.
  const regenMut = useMutation({
    mutationFn: () => api.planificacion.regenerateDay(fecha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
      // CR-012 Fix V2: queryKey unificado.
      qc.invalidateQueries({ queryKey: ['driver-positions', fecha] });
      qc.invalidateQueries({ queryKey: ['plan-diario', fecha] });
    },
  });

  // Reset destructivo → vuelve a BORRADOR.
  const resetMut = useMutation({
    mutationFn: () => api.planificacion.resetDay(fecha),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
    },
  });

  // Limpia todas las visitas del día y regenera con rutas regionalmente
  // coherentes (live_generator con region determinística por driver).
  const cleanRegenMut = useMutation({
    mutationFn: () => api.planificacion.cleanAndRegenerate(fecha, 1800, 'default'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['plan-diario', fecha] });
      // CR-012 Fix V2: queryKey unificado.
      qc.invalidateQueries({ queryKey: ['driver-positions', fecha] });
    },
  });

  // Modo demo limpio: 1 empresa / 1 driver / 5 visitas RM, ETAs cronológicas.
  const cleanRegenMinimalMut = useMutation({
    mutationFn: () => api.planificacion.cleanAndRegenerate(fecha, 5, 'minimal'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['plan-diario', fecha] });
      // CR-012 Fix V2: queryKey unificado.
      qc.invalidateQueries({ queryKey: ['driver-positions', fecha] });
    },
  });

  const s = stateQ.data;
  const meta = useMemo(() => s ? STATE_META[s.state] : null, [s]);
  const isToday = fecha === todayISO();
  const todayClick = () => onChangeFecha(todayISO());

  const runHours = s?.started_at ? hoursAgo(s.started_at) : null;

  // Hay warnings (no bloqueantes) que el user debe confirmar al validar
  const hasWarnings = !!s && (
    (s.driver_issues_count ?? 0) > 0 ||
    (s.config_issues_count ?? 0) > 0
  );
  const [confirmWarnings, setConfirmWarnings] = useState(false);

  const onValidate = () => {
    if (hasWarnings) setConfirmWarnings(true);
    else mut.mutate({ target: 'VALIDADO' });
  };

  return (
    <div className="flex flex-col gap-4 max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Día operativo</div>
              <div className="flex items-center gap-2 mt-1">
                <input type="date" value={fecha} onChange={e => onChangeFecha(e.target.value)}
                       className="input !py-1 !text-[13px] font-mono" />
                {!isToday && (
                  <button onClick={todayClick} className="btn !py-1 !px-2 text-[10px]">hoy</button>
                )}
              </div>
            </div>
            {meta && s && (
              <div className="flex flex-col">
                <span title={meta.tip}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold tracking-wider ${meta.cls}`}>
                  {meta.label}
                </span>
                {s.state === 'EN_CURSO' && s.started_at && (
                  <span className="text-[10px] text-text-muted mt-1">
                    iniciado {formatDateTime(s.started_at)}
                    {s.started_by_name && ` · por ${s.started_by_name}`}
                    {runHours !== null && ` · lleva ${runHours}`}
                  </span>
                )}
                {/* PAUSADO eliminado en R3 — la pausa la maneja live_gen toggle */}
                {s.state === 'CERRADO' && s.closed_at && (
                  <span className="text-[10px] text-text-muted mt-1">
                    cerrado {formatDateTime(s.closed_at)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Botón contextual + kebab */}
          <div className="flex items-center gap-2">
            <ContextualButton
              state={s?.state ?? null}
              canValidate={s?.can_validate ?? false}
              canStart={s?.can_start ?? false}
              canPause={s?.can_pause ?? false}
              canResume={s?.can_resume ?? false}
              blockedReason={s?.blocked_reason ?? null}
              loading={mut.isPending}
              onValidate={onValidate}
              onStart={() => setConfirmAction('EN_CURSO')}
              onGoToOps={() => onJumpToTab('operacion-jump')}
              onViewSummary={() => onJumpToTab('summary-jump')}
            />
            <KebabMenu
              open={kebabOpen}
              onToggle={() => setKebabOpen(o => !o)}
              state={s?.state ?? null}
              canClose={s?.can_close ?? false}
              regenLoading={regenMut.isPending}
              resetLoading={resetMut.isPending}
              cleanRegenLoading={cleanRegenMut.isPending}
              onClose={() => { setKebabOpen(false); setConfirmAction('CERRADO'); }}
              onRegenerate={() => {
                setKebabOpen(false);
                if (!window.confirm(
                  `¿Rebobinar la simulación del día ${fecha} a 09:00?\n\n` +
                  `Las visitas vuelven a 'pending' y el camión vuelve al inicio. ` +
                  `El plan (rutas y drivers) NO se toca.`
                )) return;
                regenMut.mutate();
              }}
              onReset={() => {
                setKebabOpen(false);
                if (!window.confirm(
                  `¿Volver el día ${fecha} a BORRADOR?\n\n` +
                  `Esto descarta el progreso de la simulación. Vas a tener que ` +
                  `validar e iniciar de nuevo. El plan cargado se conserva.`
                )) return;
                resetMut.mutate();
              }}
              onCleanRegen={() => {
                setKebabOpen(false);
                if (!window.confirm(
                  `¿Limpiar el día ${fecha} y regenerar con rutas regionales?\n\n` +
                  `Esto BORRA todas las visitas del día y genera ~1800 nuevas, ` +
                  `con cada ruta agrupada en una región (rutas en RM, Valparaíso, ` +
                  `Biobío, etc.). Los drivers arrancan desde el CD de su región.\n\n` +
                  `El día queda en BORRADOR.`
                )) return;
                cleanRegenMut.mutate();
              }}
              cleanRegenMinimalLoading={cleanRegenMinimalMut.isPending}
              onCleanRegenMinimal={() => {
                setKebabOpen(false);
                if (!window.confirm(
                  `¿Generar plan MÍNIMO para ${fecha}?\n\n` +
                  `1 empresa · 1 driver · 5 visitas en RM con ETAs ` +
                  `cronológicas (09:00, 09:30, 10:00, 10:30, 11:00).\n\n` +
                  `Ideal para demos limpios y debugging. Borra todo lo previo. ` +
                  `El día queda en BORRADOR.`
                )) return;
                cleanRegenMinimalMut.mutate();
              }}
            />
          </div>
        </div>
        {mut.error && (
          <div className="text-[11px] text-accent-red mt-2 flex items-center gap-1">
            <CircleAlert size={11} /> {(mut.error as Error).message}
          </div>
        )}
      </div>

      {/* 5 cards expandibles — todo lo que antes era tab separada */}
      <ExpandableCard
        cardKey="carga"
        title="Carga del día"
        icon={Upload}
        defaultOpen={openCard === 'carga'}
        summary={!s ? '—' : s.visitas === 0 ? 'Sin visitas cargadas' :
          `${s.visitas.toLocaleString()} visitas · última carga ${s.imported_at ? formatDateTime(s.imported_at) : '—'}`}
        summaryTone={s && s.visitas > 0 ? 'green' : 'gray'}
      >
        <CargaEntregasPanel initialFecha={fecha} onFechaChange={onChangeFecha} />
      </ExpandableCard>

      <ExpandableCard
        cardKey="dotacion"
        title="Dotación"
        icon={Users}
        defaultOpen={openCard === 'dotacion'}
        summary={!s ? '—' :
          s.conflicts_count > 0 ? `${s.conflicts_count} conflictos de dotación` :
          s.driver_issues_count > 0 ? `${s.driver_issues_count} drivers con datos faltantes (warnings)` :
          'Sin conflictos · drivers OK'}
        summaryTone={!s ? 'gray' :
          s.conflicts_count > 0 ? 'red' :
          s.driver_issues_count > 0 ? 'yellow' : 'green'}
      >
        <DotacionPanel initialFecha={fecha} />
      </ExpandableCard>

      <ExpandableCard
        cardKey="plan"
        title="Plan del día"
        icon={ClipboardList}
        defaultOpen={openCard === 'plan'}
        summary={!prepQ.data ? '—' :
          prepQ.data.all_ok ? `${prepQ.data.vips.length} VIPs · sin issues` :
          `${prepQ.data.vips.length} VIPs · ${prepQ.data.config_issues.length + prepQ.data.driver_issues.length} issues`}
        summaryTone={!prepQ.data ? 'gray' : prepQ.data.all_ok ? 'green' : 'yellow'}
      >
        <PlanDelDiaSimplePanel fecha={fecha} />
      </ExpandableCard>

      <ExpandableCard
        cardKey="clientes"
        title="Clientes del día"
        icon={UsersRound}
        defaultOpen={openCard === 'clientes'}
        summary={!s ? '—' : `${s.visitas.toLocaleString()} visitas · ${prepQ.data?.vips.length ?? 0} VIPs`}
        summaryTone={!s ? 'gray' : 'green'}
      >
        <ClientesDelDiaPanel fecha={fecha} />
      </ExpandableCard>

      <ExpandableCard
        cardKey="config"
        title="Configuración del día"
        icon={Sliders}
        defaultOpen={openCard === 'configdia'}
        summary="Cutoff, mensaje a drivers, overrides, restricciones"
        summaryTone="gray"
      >
        <ConfigDelDiaPanel fecha={fecha} />
      </ExpandableCard>

      {/* Confirmation modal */}
      {confirmAction && s && (
        <ConfirmModal
          fecha={fecha}
          target={confirmAction}
          state={s}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            mut.mutate({ target: confirmAction });
            setConfirmAction(null);
          }}
        />
      )}
      {/* Modal de confirmación de warnings al validar */}
      {confirmWarnings && s && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-800 border border-line rounded-md max-w-md w-full">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <AlertTriangle size={14} className="text-accent-yellow" />
              <h3 className="text-[13px] font-semibold uppercase tracking-wider">
                Validar con warnings
              </h3>
            </div>
            <div className="p-4 text-[12px] flex flex-col gap-3">
              <p>Hay <strong>{(s.driver_issues_count ?? 0) + (s.config_issues_count ?? 0)} warnings</strong> no bloqueantes:</p>
              <ul className="list-disc list-inside text-text-secondary space-y-1">
                {(s.driver_issues_count ?? 0) > 0 && (
                  <li>{s.driver_issues_count} drivers con datos faltantes (sin teléfono, sin licencia administrativa)</li>
                )}
                {(s.config_issues_count ?? 0) > 0 && (
                  <li>{s.config_issues_count} visitas con configuración faltante (sin región, sin comuna, sin CT)</li>
                )}
              </ul>
              <p className="text-text-muted text-[11px]">
                Estas issues no impiden operar, pero podés revisarlas en "Plan del día" antes de iniciar.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setConfirmWarnings(false)} className="btn text-[11px]">Revisar primero</button>
                <button onClick={() => {
                  mut.mutate({ target: 'VALIDADO', allowNonBlocking: true });
                  setConfirmWarnings(false);
                }} className="btn-primary text-[11px]">
                  Validar igual
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Botón contextual
// ----------------------------------------------------------------------------
function ContextualButton({
  state, canValidate, canStart, blockedReason, loading,
  onValidate, onStart, onGoToOps, onViewSummary,
}: {
  state: DayState | null;
  canValidate: boolean; canStart: boolean;
  canPause?: boolean; canResume?: boolean;  // legacy, ignorados
  blockedReason: string | null;
  loading: boolean;
  onValidate: () => void; onStart: () => void;
  onGoToOps: () => void; onViewSummary: () => void;
}) {
  if (!state) return null;

  const loadingIcon = loading ? <Loader2 size={12} className="animate-spin" /> : null;

  if (state === 'BORRADOR') {
    return (
      <button onClick={onValidate} disabled={!canValidate || loading}
              title={!canValidate ? blockedReason ?? 'Resolvé los issues antes de validar' : 'Validar día'}
              className="btn-primary text-[12px] flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed">
        {loadingIcon ?? <Square size={12} />} Validar día
      </button>
    );
  }
  if (state === 'VALIDADO') {
    return (
      <button onClick={onStart} disabled={!canStart || loading}
              title={!canStart ? blockedReason ?? '' : 'Iniciar el reloj operativo'}
              className="btn-primary text-[12px] flex items-center gap-1 bg-accent-green hover:bg-accent-green/80">
        {loadingIcon ?? <Play size={12} />} Iniciar día
      </button>
    );
  }
  if (state === 'EN_CURSO') {
    return (
      <button onClick={onGoToOps}
              className="btn-primary text-[12px] flex items-center gap-1">
        Ir a Operación <ChevronRight size={12} />
      </button>
    );
  }
  // CERRADO
  return (
    <button onClick={onViewSummary} className="btn text-[12px] flex items-center gap-1">
      Ver resumen <ChevronRight size={12} />
    </button>
  );
}

// ----------------------------------------------------------------------------
// Kebab menu
// ----------------------------------------------------------------------------
function KebabMenu({ open, onToggle, state, canClose, regenLoading, resetLoading, cleanRegenLoading, cleanRegenMinimalLoading, onClose, onRegenerate, onReset, onCleanRegen, onCleanRegenMinimal }: {
  open: boolean; onToggle: () => void; state: DayState | null;
  canClose: boolean;
  regenLoading?: boolean; resetLoading?: boolean; cleanRegenLoading?: boolean; cleanRegenMinimalLoading?: boolean;
  onClose: () => void; onRegenerate: () => void; onReset: () => void; onCleanRegen: () => void; onCleanRegenMinimal: () => void;
}) {
  const isEnCurso = state === 'EN_CURSO';
  const canReset = state === 'EN_CURSO' || state === 'CERRADO';
  return (
    <div className="relative">
      <button onClick={onToggle} className="btn !p-1.5" title="Acciones avanzadas">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 panel min-w-[260px] z-20 text-[11px]">
          {/* Rebobinar — solo aplica en EN_CURSO */}
          <button
            onClick={onRegenerate}
            disabled={!isEnCurso || regenLoading}
            className="w-full px-3 py-2 hover:bg-bg-700/50 text-left flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isEnCurso ? 'Vuelve sim_clock a 09:00, plan intacto' : 'Solo disponible si el día está EN_CURSO'}
          >
            🔁 {regenLoading ? 'Rebobinando…' : 'Rebobinar simulación (09:00)'}
          </button>
          {/* Plan mínimo — 5 visitas RM determinísticas para demos y tests */}
          <button
            onClick={onCleanRegenMinimal}
            disabled={cleanRegenMinimalLoading}
            className="w-full px-3 py-2 hover:bg-accent-green/10 text-left flex items-center gap-2 border-t border-line/40 disabled:opacity-40 disabled:cursor-not-allowed"
            title="1 empresa · 1 driver · 5 visitas RM cronológicas. Para demos limpios y tests"
          >
            ✨ {cleanRegenMinimalLoading ? 'Generando…' : 'Plan mínimo (5 visitas RM)'}
          </button>
          {/* Limpiar y regenerar plan — borra visitas y crea coherentes por región */}
          <button
            onClick={onCleanRegen}
            disabled={cleanRegenLoading}
            className="w-full px-3 py-2 hover:bg-accent-blue/10 text-left flex items-center gap-2 border-t border-line/40 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Borra visitas del día y regenera con rutas regionales (arrancando desde CDs)"
          >
            🧹 {cleanRegenLoading ? 'Regenerando…' : 'Limpiar + regenerar plan (regional)'}
          </button>
          {/* Reset destructivo → BORRADOR */}
          <button
            onClick={onReset}
            disabled={!canReset || resetLoading}
            className="w-full px-3 py-2 hover:bg-accent-yellow/10 text-left flex items-center gap-2 border-t border-line/40 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canReset ? 'Volver a BORRADOR (descarta progreso de simulación)' : 'Solo en EN_CURSO o CERRADO'}
          >
            ↺ {resetLoading ? 'Reseteando…' : 'Volver a BORRADOR'}
          </button>
          {canClose && (
            <button onClick={onClose} className="w-full px-3 py-2 hover:bg-accent-red/10 text-accent-red text-left flex items-center gap-2 border-t border-line/40">
              <Square size={11} /> Cerrar día antes
            </button>
          )}
          {state && (
            <div className="px-3 py-2 text-[10px] text-text-muted border-t border-line/40">
              Estado actual: <span className="font-mono">{state}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Cards
// ----------------------------------------------------------------------------
type StateData = NonNullable<Awaited<ReturnType<typeof api.planificacion.getDayState>>>;
type PrepData = NonNullable<Awaited<ReturnType<typeof api.planificacion.dayPrep>>>;

function CardCarga({ fecha, state, loading, onDetail }: {
  fecha: string; state: StateData | undefined; loading: boolean; onDetail: () => void;
}) {
  return (
    <Card title="Carga del día" icon={Upload} loading={loading} onDetail={onDetail}>
      {!state ? <Skel /> : state.visitas === 0 ? (
        <div className="text-[11px] text-text-muted italic flex items-center gap-2">
          <AlertTriangle size={11} className="text-accent-yellow" />
          No hay visitas cargadas para {fecha}. Subí el XLSX en la sección "Carga de entregas".
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
          <KV label="Total visitas" value={state.visitas.toLocaleString()} highlight />
          <KV label="Última carga" value={state.imported_at ? formatDateTime(state.imported_at) : '—'} mono />
          <KV label="Cargado por" value={state.imported_by_user_id ? `user #${state.imported_by_user_id}` : '—'} />
        </div>
      )}
    </Card>
  );
}

function CardDotacion({ fecha: _fecha, state, loading, onDetail }: {
  fecha: string; state: StateData | undefined; loading: boolean; onDetail: () => void;
}) {
  const tone = state?.driver_issues_count
    ? 'text-accent-red'
    : state?.conflicts_count
    ? 'text-accent-yellow'
    : 'text-accent-green';
  return (
    <Card title="Dotación" icon={Users} loading={loading} onDetail={onDetail}>
      {!state ? <Skel /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[12px]">
          <KV label="Conflictos" value={state.conflicts_count} mono
              tone={state.conflicts_count > 0 ? 'red' : 'green'} />
          <KV label="Drivers con problemas" value={state.driver_issues_count} mono
              tone={state.driver_issues_count > 0 ? 'red' : 'green'} />
          <KV label="Estado" value={state.driver_issues_count === 0 && state.conflicts_count === 0 ? 'OK' : 'requiere atención'}
              tone={state.driver_issues_count === 0 && state.conflicts_count === 0 ? 'green' : 'yellow'} />
        </div>
      )}
    </Card>
  );
}

function CardCasosEspeciales({ fecha: _fecha, prep, loading, onDetail }: {
  fecha: string; prep: PrepData | undefined; loading: boolean; onDetail: () => void;
}) {
  return (
    <Card title="Casos especiales" icon={ShieldAlert} loading={loading} onDetail={onDetail}>
      {!prep ? <Skel /> : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-3 text-[12px]">
            <KV label="VIPs del día" value={prep.vips.length} icon={Crown} tone={prep.vips.length ? 'yellow' : undefined} />
            <KV label="Issues config" value={prep.config_issues.length} mono
                tone={prep.config_issues.length ? 'yellow' : 'green'} />
            <KV label="Issues drivers" value={prep.driver_issues.length} mono
                tone={prep.driver_issues.length ? 'red' : 'green'} />
          </div>
          {prep.vips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {prep.vips.slice(0, 5).map(v => (
                <span key={v.tracking_id}
                      className="text-[10px] px-1.5 py-0.5 bg-cmr/15 text-cmr border border-cmr/40 rounded inline-flex items-center gap-1">
                  <Crown size={9} /> {v.cliente}
                </span>
              ))}
              {prep.vips.length > 5 && (
                <span className="text-[10px] text-text-muted">+{prep.vips.length - 5} más</span>
              )}
            </div>
          )}
          {!prep.all_ok && (
            <div className="text-[11px] text-accent-yellow flex items-center gap-1 mt-1">
              <AlertTriangle size={11} />
              {prep.config_issues.length + prep.driver_issues.length} issues por resolver
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Card / KV / Modal helpers
// ----------------------------------------------------------------------------
function Card({ title, icon: Icon, loading, onDetail, children }: {
  title: string; icon: any; loading: boolean; onDetail: () => void; children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="px-4 py-2.5 border-b border-line/40 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider">
          <Icon size={14} /> {title}
          {loading && <Loader2 size={11} className="animate-spin text-text-muted" />}
        </div>
        <button onClick={onDetail}
                className="text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1">
          Ver detalle <ExternalLink size={11} />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function KV({ label, value, icon: Icon, mono, tone, highlight }: {
  label: string; value: string | number; icon?: any; mono?: boolean;
  tone?: 'green' | 'red' | 'yellow' | 'blue';
  highlight?: boolean;
}) {
  const toneCls = tone === 'green' ? 'text-accent-green'
    : tone === 'red' ? 'text-accent-red'
    : tone === 'yellow' ? 'text-accent-yellow'
    : tone === 'blue' ? 'text-accent-blue' : '';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        {Icon && <Icon size={10} />} {label}
      </span>
      <span className={`${mono ? 'font-mono' : ''} ${toneCls} ${highlight ? 'text-[18px] font-semibold' : 'text-[13px]'}`}>
        {value}
      </span>
    </div>
  );
}

function Skel() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[0, 1, 2].map(i => (
        <div key={i} className="flex flex-col gap-1 animate-pulse">
          <div className="h-2 bg-bg-700/50 rounded w-20"></div>
          <div className="h-4 bg-bg-700/50 rounded w-12"></div>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ fecha, target, state, onCancel, onConfirm }: {
  fecha: string;
  target: 'EN_CURSO' | 'CERRADO';
  state: StateData;
  onCancel: () => void; onConfirm: () => void;
}) {
  const isStart = target === 'EN_CURSO';
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-bg-800 border border-line rounded-md max-w-md w-full">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="text-[13px] font-semibold uppercase tracking-wider">
            {isStart ? 'Iniciar día' : 'Cerrar día'}
          </h3>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 text-[12px] flex flex-col gap-3">
          {isStart ? (
            <>
              <p>Vas a iniciar el día <strong>{fecha}</strong>.</p>
              <p className="text-text-muted">
                Esto arranca el reloj operativo y la inyección de visitas en vivo.
                Una vez iniciado, podés pausar pero no volver a BORRADOR.
              </p>
              <div className="bg-bg-700/40 rounded p-2 text-[11px] flex items-center gap-2">
                <Truck size={12} className="text-text-secondary" />
                <span>{state.visitas} visitas listas para operar</span>
              </div>
            </>
          ) : (
            <>
              <p>Vas a <strong>cerrar</strong> el día <strong>{fecha}</strong>.</p>
              <p className="text-text-muted">
                Esta acción es <strong>terminal</strong>. El día pasa a solo lectura y no se
                puede reabrir. Las visitas pendientes quedan tal cual.
              </p>
              {state.started_at && state.state === 'EN_CURSO' && (
                <div className="text-[11px] text-accent-yellow flex items-center gap-1">
                  <AlertTriangle size={11} />
                  El día sigue en curso. ¿Confirmás cerrarlo igual?
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onCancel} className="btn text-[11px]">Cancelar</button>
            <button onClick={onConfirm}
                    className={`btn-primary text-[11px] flex items-center gap-1 ${
                      isStart ? 'bg-accent-green hover:bg-accent-green/80' : 'bg-accent-red hover:bg-accent-red/80'
                    }`}>
              {isStart ? <><Play size={11} /> Sí, iniciar</> : <><Square size={11} /> Sí, cerrar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function hoursAgo(iso: string): string {
  try {
    const t = new Date(iso.replace(' ', 'T'));
    const diff = (Date.now() - t.getTime()) / 60_000;
    if (diff < 60) return `${Math.floor(diff)} min`;
    const h = Math.floor(diff / 60);
    const m = Math.floor(diff % 60);
    return `${h}h${String(m).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function formatDateTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

// ----------------------------------------------------------------------------
// ExpandableCard — para las 5 secciones expandibles dentro de Día operativo
// ----------------------------------------------------------------------------
type Tone = 'green' | 'red' | 'yellow' | 'gray';

const TONE_DOT: Record<Tone, string> = {
  green: 'bg-accent-green',
  red: 'bg-accent-red',
  yellow: 'bg-accent-yellow',
  gray: 'bg-bg-700 border border-line',
};

function ExpandableCard({
  cardKey, title, icon: Icon, summary, summaryTone, defaultOpen, children,
}: {
  cardKey: string;
  title: string;
  icon: any;
  summary: string;
  summaryTone?: Tone;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  // Si defaultOpen cambia (por openCard del query string), forzamos apertura.
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-700/30 transition-colors text-left"
        data-card={cardKey}
      >
        <Icon size={14} className="text-text-secondary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[summaryTone ?? 'gray']}`} />
            {summary}
          </div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-text-muted shrink-0" />
          : <ChevronRight size={14} className="text-text-muted shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-line/40">
          {children}
        </div>
      )}
    </div>
  );
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const _unused = Clock;
