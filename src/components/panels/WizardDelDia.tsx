import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, CalendarDays, CheckCircle2, ChevronRight, Circle, Loader2,
  Play, ShieldAlert, Truck, Upload,
} from 'lucide-react';
import { api } from '../../api';

interface Props {
  fecha: string;
  onChangeFecha: (f: string) => void;
  /** Cuando el usuario hace click en un step, saltamos a esa tab del módulo. */
  onJumpToTab: (tabKey: string) => void;
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function WizardDelDia({ fecha, onChangeFecha, onJumpToTab }: Props) {
  const qc = useQueryClient();
  const statusQ = useQuery({
    queryKey: ['planif-day-status', fecha],
    queryFn: () => api.planificacion.dayStatus(fecha),
    refetchInterval: 15_000,
  });

  const startMut = useMutation({
    mutationFn: (f: string) => api.planificacion.startDay(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planif-day-status', fecha] });
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['plan-diario'] });
      qc.invalidateQueries({ queryKey: ['planif-calendar'] });
    },
  });

  const s = statusQ.data;
  const today = todayISO();

  // Estados de cada step:
  // 1. Cargado: s.loaded
  // 2. Verificar dotación: s.dotacion_checked (true si user es Falabella, sino se hace en cliente)
  // 3. Sin conflictos: s.no_conflicts
  // 4. Iniciado: s.started
  // 5. Operación: solo navega cuando started
  const steps = [
    {
      key: 'carga',
      label: 'Cargar entregas',
      tab: 'carga',
      done: !!s?.loaded,
      detail: s ? `${s.visitas} visita${s.visitas === 1 ? '' : 's'}` : '—',
      icon: Upload,
    },
    {
      key: 'dotacion',
      label: 'Verificar dotación',
      tab: 'dotacion',
      done: !!s?.dotacion_checked,
      detail: s ? (s.conflicts_count === 0 ? 'sin conflictos' : `${s.conflicts_count} pendiente(s)`) : '—',
      icon: Truck,
    },
    {
      key: 'plan',
      label: 'Revisar plan',
      tab: 'plan',
      done: !!s?.loaded && !!s?.no_conflicts,
      detail: s && s.conflicts_count > 0
        ? 'Resolvé conflictos primero'
        : (s?.loaded ? 'Listo' : '—'),
      icon: ShieldAlert,
    },
    {
      key: 'iniciar',
      label: 'Iniciar día',
      tab: null,
      done: !!s?.started,
      detail: s?.started
        ? (s.imported_at ? `Importado ${s.imported_at.slice(0, 16).replace('T', ' ')}` : 'Operativo')
        : (s?.live_gen_running ? 'live_gen corriendo' : 'pausado'),
      icon: Play,
    },
    {
      key: 'operacion',
      label: 'Operación',
      tab: null,
      done: false,
      detail: s?.started ? 'Ir al mapa' : 'Disponible al iniciar',
      icon: ChevronRight,
    },
  ];

  const canStart = !!s?.loaded && !!s?.no_conflicts && !s?.started;

  return (
    <div className="panel mb-3">
      <div className="px-4 py-3 border-b border-line/40 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-accent-blue" />
          <span className="text-[13px] font-semibold uppercase tracking-wider">Día operativo</span>
          <input
            type="date"
            value={fecha}
            onChange={e => onChangeFecha(e.target.value)}
            className="input !py-1 !text-[12px] font-mono"
          />
          {fecha !== today && (
            <button onClick={() => onChangeFecha(today)}
                    className="btn !py-1 !px-2 text-[10px]">Hoy</button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          {s ? (
            <>
              <span className={`pill ${s.loaded ? 'pill-green' : 'bg-bg-700 text-text-muted border-line border'}`}>
                {s.loaded ? `${s.visitas}v cargadas` : 'sin cargar'}
              </span>
              {s.conflicts_count > 0 && (
                <span className="pill bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border">
                  ⚠ {s.conflicts_count} conflictos dotación
                </span>
              )}
              {s.is_state_today && (
                <span className="pill bg-accent-blue/15 text-accent-blue border-accent-blue/40 border">
                  STATE.today
                </span>
              )}
              {s.live_gen_running ? (
                <span className="pill bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border" title="live_gen sigue inyectando visitas">
                  live_gen ▶
                </span>
              ) : (
                <span className="pill bg-bg-700 text-text-muted border-line border" title="live_gen pausado">
                  live_gen ⏸
                </span>
              )}
              {s.started && (
                <span className="pill pill-green">✓ Iniciado</span>
              )}
            </>
          ) : (
            <span className="text-text-muted flex items-center gap-1">
              <Loader2 size={11} className="animate-spin" /> cargando estado
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-4 py-3 flex items-center gap-1 overflow-x-auto">
        {steps.map((st, i) => {
          const Icon = st.done ? CheckCircle2 : (st.icon ?? Circle);
          const clickable = st.tab !== null;
          return (
            <div key={st.key} className="flex items-center shrink-0">
              <button
                disabled={!clickable}
                onClick={() => clickable && onJumpToTab(st.tab!)}
                className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
                  st.done
                    ? 'bg-accent-green/10 text-accent-green'
                    : 'bg-bg-700/30 text-text-secondary'
                } ${clickable ? 'hover:bg-bg-700/60 cursor-pointer' : 'cursor-default'}`}
                title={clickable ? `Ir a ${st.label}` : st.label}
              >
                <Icon size={14} />
                <div className="text-left">
                  <div className="text-[11px] font-medium">{i + 1}. {st.label}</div>
                  <div className="text-[10px] opacity-80">{st.detail}</div>
                </div>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight size={12} className="text-text-muted shrink-0" />
              )}
            </div>
          );
        })}
        {canStart && (
          <button onClick={() => {
                    const msg = (
                      `Iniciar día ${fecha}?\n\n` +
                      `Esta acción:\n` +
                      `  • Pausa el generador de visitas en vivo\n` +
                      `  • Fija ${fecha} como día operativo\n` +
                      `  • Resetea todas las visitas a status 'pending' y limpia checkouts\n\n` +
                      `Si querés conservar el estado actual de las visitas, cancelá y usa el botón con reset=false desde la API.`
                    );
                    if (confirm(msg)) {
                      startMut.mutate(fecha);
                    }
                  }}
                  disabled={startMut.isPending}
                  className="btn-primary text-[11px] flex items-center gap-1 ml-2">
            {startMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            Iniciar día
          </button>
        )}
        {s?.conflicts_count && s.conflicts_count > 0 ? (
          <div className="ml-2 text-[10px] text-accent-yellow flex items-center gap-1">
            <AlertCircle size={11} /> Resolvé los {s.conflicts_count} conflictos en "Dotación del día"
          </div>
        ) : null}
      </div>
    </div>
  );
}
