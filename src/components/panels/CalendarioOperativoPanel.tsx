import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2,
  CircleAlert, Loader2, Play,
} from 'lucide-react';
import { api } from '../../api';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function CalendarioOperativoPanel() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedISO, setSelectedISO] = useState<string | null>(null);

  const calQ = useQuery({
    queryKey: ['planif-calendar', monthKey(cursor)],
    queryFn: () => api.planificacion.calendar(monthKey(cursor)),
  });

  const dayMap = useMemo(() => {
    const m = new Map<string, NonNullable<typeof calQ.data>[number]>();
    (calQ.data ?? []).forEach(d => m.set(d.fecha, d));
    return m;
  }, [calQ.data]);

  const startDayMut = useMutation({
    mutationFn: (f: string) => api.planificacion.startDay(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planif-calendar'] });
      qc.invalidateQueries({ queryKey: ['state'] });
    },
  });

  // Build grid: 6 rows × 7 cols, starting Monday
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  // 0 = lunes
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(firstOfMonth);
    d.setDate(d.getDate() - startOffset + i);
    cells.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
  }

  const prevMonth = () => setCursor(c => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const nextMonth = () => setCursor(c => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const today = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedISO(isoDate(d));
  };

  const todayISO = isoDate(new Date());

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="btn !py-1 !px-2"><ChevronLeft size={14} /></button>
            <div className="text-[15px] font-semibold tracking-tight min-w-[180px] text-center">
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button onClick={nextMonth} className="btn !py-1 !px-2"><ChevronRight size={14} /></button>
            <button onClick={today} className="btn !py-1 !px-3 text-[11px]">Hoy</button>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-accent-green"></div> cargado</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-accent-blue"></div> operativo</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-accent-yellow"></div> conflictos</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DAY_NAMES.map((d, i) => (
            <div key={i} className="text-[10px] uppercase tracking-wider text-text-muted text-center py-1">
              {d}
            </div>
          ))}
          {cells.map((c, i) => {
            const iso = isoDate(c.date);
            const info = dayMap.get(iso);
            const selected = selectedISO === iso;
            const isToday = iso === todayISO;
            const hasData = !!info && info.visitas > 0;
            const hasConflicts = info && info.conflicts_count > 0;
            return (
              <button
                key={i}
                onClick={() => setSelectedISO(iso)}
                className={`
                  relative aspect-square rounded p-1 text-[11px] text-left transition-colors
                  ${c.inMonth ? 'bg-bg-700/30 hover:bg-bg-700/60' : 'bg-bg-700/10 text-text-muted'}
                  ${selected ? 'ring-2 ring-accent-blue' : ''}
                  ${isToday ? 'border border-brand' : 'border border-transparent'}
                `}
              >
                <div className={`text-[12px] ${isToday ? 'font-bold text-brand' : ''}`}>
                  {c.date.getDate()}
                </div>
                {info?.is_today && (
                  <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent-blue" title="Día operativo activo" />
                )}
                {hasData && (
                  <div className="absolute bottom-1 left-1 right-1 flex flex-col gap-0.5">
                    <div className="text-[9px] font-mono text-accent-green">
                      {info.visitas} v
                    </div>
                    {hasConflicts && (
                      <div className="text-[9px] font-mono text-accent-yellow flex items-center gap-0.5">
                        <CircleAlert size={8} /> {info.conflicts_count}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedISO && (
        <SelectedDayDetail
          iso={selectedISO}
          info={dayMap.get(selectedISO)}
          isToday={selectedISO === todayISO}
          onStartDay={() => {
            if (confirm(`Iniciar día ${selectedISO}? Esto pausa el live_gen y fija STATE.today.`)) {
              startDayMut.mutate(selectedISO);
            }
          }}
          startDayPending={startDayMut.isPending}
        />
      )}

      {calQ.isLoading && (
        <div className="text-text-muted text-xs flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Cargando calendario…
        </div>
      )}
    </div>
  );
}

function SelectedDayDetail({ iso, info, isToday, onStartDay, startDayPending }: {
  iso: string;
  info: NonNullable<ReturnType<typeof api.planificacion.calendar> extends Promise<infer T> ? T : never>[number] | undefined;
  isToday: boolean;
  onStartDay: () => void;
  startDayPending: boolean;
}) {
  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>Detalle del día: {iso} {isToday && <span className="text-accent-blue ml-2">(hoy)</span>}</span>
        {info && info.visitas > 0 && (
          <button onClick={onStartDay} disabled={startDayPending}
                  className="btn-primary !py-1 !px-3 text-[11px] flex items-center gap-1">
            {startDayPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            Iniciar este día
          </button>
        )}
      </div>
      <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
        <KV label="Visitas totales" value={info?.visitas ?? 0} mono />
        <KV label="Completadas"     value={info?.completed ?? 0} mono tone={info && info.completed > 0 ? 'green' : undefined} />
        <KV label="Pendientes"      value={info?.pending ?? 0} mono />
        <KV label="Fallidas"        value={info?.failed ?? 0} mono tone={info && info.failed > 0 ? 'red' : undefined} />
        <KV label="Día operativo activo (STATE.today)"
            value={info?.is_today ? 'Sí' : 'No'}
            tone={info?.is_today ? 'blue' : undefined} />
        <KV label="Última importación" value={info?.imported_at ?? '—'} mono />
        <KV label="Conflictos de dotación"
            value={info?.conflicts_count ?? 0}
            tone={info && info.conflicts_count > 0 ? 'yellow' : undefined} />
      </div>
      {!info || info.visitas === 0 ? (
        <div className="px-4 pb-3 text-[11px] text-text-muted italic flex items-center gap-2">
          <AlertTriangle size={11} className="text-text-muted/60" />
          Este día no tiene visitas cargadas. Para programarlo, andá a "Carga de entregas" y subí el XLSX.
        </div>
      ) : info.conflicts_count > 0 ? (
        <div className="px-4 pb-3 text-[11px] text-accent-yellow flex items-center gap-2">
          <CircleAlert size={11} />
          Resolvé los {info.conflicts_count} conflictos de dotación antes de iniciar.
        </div>
      ) : (
        <div className="px-4 pb-3 text-[11px] text-accent-green flex items-center gap-2">
          <CheckCircle2 size={11} />
          Día listo para iniciar.
        </div>
      )}
    </div>
  );
}

function KV({ label, value, mono, tone }: {
  label: string;
  value: string | number;
  mono?: boolean;
  tone?: 'green' | 'red' | 'yellow' | 'blue';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${
        tone === 'green'  ? 'text-accent-green'  :
        tone === 'red'    ? 'text-accent-red'    :
        tone === 'yellow' ? 'text-accent-yellow' :
        tone === 'blue'   ? 'text-accent-blue'   : ''
      }`}>{value}</span>
    </div>
  );
}
