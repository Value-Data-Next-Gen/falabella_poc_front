import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronRight, CircleAlert, Clock, Crown, ExternalLink,
  Loader2, MoreVertical, Pause, Play, ShieldAlert, Square, Truck,
  Upload, Users, X,
} from 'lucide-react';
import { api } from '../../api';

interface Props {
  fecha: string;
  onChangeFecha: (f: string) => void;
  onJumpToTab: (key: string) => void;
}

type DayState = 'BORRADOR' | 'LISTO' | 'EN_CURSO' | 'PAUSADO' | 'CERRADO';

const STATE_META: Record<DayState, { label: string; cls: string; tip: string }> = {
  BORRADOR: { label: 'BORRADOR',  cls: 'bg-bg-700 text-text-secondary border-line',
              tip: 'Día con visitas cargadas. Resolvé los issues bloqueantes y validá para pasar a LISTO.' },
  LISTO:    { label: 'LISTO',     cls: 'bg-accent-blue/15 text-accent-blue border-accent-blue/40',
              tip: 'Sin issues. Apretá "Iniciar día" para arrancar el reloj operativo.' },
  EN_CURSO: { label: 'EN CURSO',  cls: 'bg-accent-green/15 text-accent-green border-accent-green/40',
              tip: 'Reloj corriendo. El generator inyecta visitas en vivo.' },
  PAUSADO:  { label: 'PAUSADO',   cls: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40',
              tip: 'Pausa temporal. El reloj no avanza. Apretá "Reanudar" para continuar.' },
  CERRADO:  { label: 'CERRADO',   cls: 'bg-bg-700 text-text-muted border-line',
              tip: 'Jornada cerrada. Solo lectura.' },
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function DiaOperativoPanel({ fecha, onChangeFecha, onJumpToTab }: Props) {
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
    mutationFn: (target: DayState) => api.planificacion.transitionDayState({
      fecha, target,
      confirm: target === 'EN_CURSO' || target === 'CERRADO',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state', fecha] });
      qc.invalidateQueries({ queryKey: ['planif-day-status', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
    },
  });

  const s = stateQ.data;
  const meta = useMemo(() => s ? STATE_META[s.state] : null, [s]);
  const isToday = fecha === todayISO();
  const todayClick = () => onChangeFecha(todayISO());

  const runHours = s?.started_at ? hoursAgo(s.started_at) : null;

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
                {s.state === 'PAUSADO' && s.paused_at && (
                  <span className="text-[10px] text-text-muted mt-1">
                    pausado {formatDateTime(s.paused_at)}
                  </span>
                )}
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
              onValidate={() => mut.mutate('LISTO')}
              onStart={() => setConfirmAction('EN_CURSO')}
              onPause={() => mut.mutate('PAUSADO')}
              onResume={() => mut.mutate('EN_CURSO')}
              onGoToOps={() => onJumpToTab('operacion-jump')}
              onViewSummary={() => onJumpToTab('summary-jump')}
            />
            <KebabMenu
              open={kebabOpen}
              onToggle={() => setKebabOpen(o => !o)}
              state={s?.state ?? null}
              canClose={s?.can_close ?? false}
              onClose={() => { setKebabOpen(false); setConfirmAction('CERRADO'); }}
              onRegenerate={() => { setKebabOpen(false); /* TODO regenerate */ }}
            />
          </div>
        </div>
        {mut.error && (
          <div className="text-[11px] text-accent-red mt-2 flex items-center gap-1">
            <CircleAlert size={11} /> {(mut.error as Error).message}
          </div>
        )}
      </div>

      {/* 3 cards */}
      <CardCarga fecha={fecha} state={s} loading={stateQ.isLoading} onDetail={() => onJumpToTab('carga')} />
      <CardDotacion fecha={fecha} state={s} loading={stateQ.isLoading} onDetail={() => onJumpToTab('dotacion')} />
      <CardCasosEspeciales
        fecha={fecha}
        prep={prepQ.data}
        loading={prepQ.isLoading}
        onDetail={() => onJumpToTab('plan')}
      />

      {/* Confirmation modal */}
      {confirmAction && s && (
        <ConfirmModal
          fecha={fecha}
          target={confirmAction}
          state={s}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            mut.mutate(confirmAction);
            setConfirmAction(null);
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Botón contextual
// ----------------------------------------------------------------------------
function ContextualButton({
  state, canValidate, canStart, canPause, canResume, blockedReason, loading,
  onValidate, onStart, onPause, onResume, onGoToOps, onViewSummary,
}: {
  state: DayState | null;
  canValidate: boolean; canStart: boolean; canPause: boolean; canResume: boolean;
  blockedReason: string | null;
  loading: boolean;
  onValidate: () => void; onStart: () => void; onPause: () => void; onResume: () => void;
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
  if (state === 'LISTO') {
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
      <div className="flex items-center gap-2">
        <button onClick={onPause} disabled={!canPause || loading}
                className="btn text-[12px] flex items-center gap-1">
          {loadingIcon ?? <Pause size={12} />} Pausar
        </button>
        <button onClick={onGoToOps}
                className="btn-primary text-[12px] flex items-center gap-1">
          Ir a Operación <ChevronRight size={12} />
        </button>
      </div>
    );
  }
  if (state === 'PAUSADO') {
    return (
      <button onClick={onResume} disabled={!canResume || loading}
              className="btn-primary text-[12px] flex items-center gap-1 bg-accent-green hover:bg-accent-green/80">
        {loadingIcon ?? <Play size={12} />} Reanudar
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
function KebabMenu({ open, onToggle, state, canClose, onClose, onRegenerate }: {
  open: boolean; onToggle: () => void; state: DayState | null;
  canClose: boolean;
  onClose: () => void; onRegenerate: () => void;
}) {
  return (
    <div className="relative">
      <button onClick={onToggle} className="btn !p-1.5" title="Acciones avanzadas">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 panel min-w-[200px] z-20 text-[11px]">
          <button onClick={onRegenerate} className="w-full px-3 py-2 hover:bg-bg-700/50 text-left flex items-center gap-2">
            🔁 Regenerar plan (nuevo seed)
          </button>
          {canClose && (
            <button onClick={onClose} className="w-full px-3 py-2 hover:bg-accent-red/10 text-accent-red text-left flex items-center gap-2 border-t border-line/40">
              <Square size={11} /> Cerrar día
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

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const _unused = Clock;
