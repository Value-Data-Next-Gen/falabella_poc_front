import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useDiaActivo } from '../hooks/useDiaActivo';

/**
 * R7: vigila el sim_clock vs el cutoff del día activo. Si el reloj
 * alcanza el cutoff y aún hay visitas pendientes, abre un modal que
 * ofrece: extender +60min / +120min, cerrar el día, o ignorar.
 *
 * Una sola instancia (en AppShell). Se desactiva si:
 *   - El día no está EN_CURSO.
 *   - El usuario ya respondió en esta sesión para este día (dismissedRef).
 */
export function CutoffReachedModal() {
  const { fecha: activeDate } = useDiaActivo();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const dismissedForDateRef = useRef<string | null>(null);

  const stateQ = useQuery({
    queryKey: ['state'],
    queryFn: api.state,
    refetchInterval: 5_000,
  });
  const dayStateQ = useQuery({
    queryKey: ['day-state-cutoff-watch', activeDate],
    queryFn: () => api.planificacion.getDayState(activeDate),
    enabled: !!activeDate,
    refetchInterval: 15_000,
  });
  const dayConfigQ = useQuery({
    queryKey: ['day-config-cutoff', activeDate],
    queryFn: () => api.planificacion.getDayConfig(activeDate),
    enabled: !!activeDate,
    refetchInterval: 30_000,
  });

  const dayState = dayStateQ.data?.state;
  const simClock = stateQ.data?.sim_clock ?? null;
  const cutoff = dayConfigQ.data?.cutoff_time ?? '18:30';
  const visitasTotales = dayStateQ.data?.visitas ?? 0;

  // Cutoff alcanzado si sim_clock (HH:MM) >= cutoff (HH:MM) y EN_CURSO.
  useEffect(() => {
    if (dayState !== 'EN_CURSO') return;
    if (!simClock || !cutoff) return;
    if (dismissedForDateRef.current === activeDate) return;
    const clockHM = simClock.slice(11, 16);            // 'HH:MM'
    const cutoffHM = cutoff.slice(0, 5);               // 'HH:MM'
    if (clockHM >= cutoffHM) {
      setOpen(true);
    }
  }, [dayState, simClock, cutoff, activeDate]);

  // Reset dismiss al cambiar de fecha
  useEffect(() => { dismissedForDateRef.current = null; }, [activeDate]);

  const extendMut = useMutation({
    mutationFn: (minutes: number) => api.planificacion.extendDay(activeDate, minutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-config-cutoff'] });
      qc.invalidateQueries({ queryKey: ['day-state-cutoff-watch'] });
      qc.invalidateQueries({ queryKey: ['state'] });
      setOpen(false);
    },
  });

  const closeMut = useMutation({
    mutationFn: () => api.planificacion.transitionDayState({
      fecha: activeDate, target: 'CERRADO', confirm: true, allow_non_blocking: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-state'] });
      qc.invalidateQueries({ queryKey: ['day-state-cutoff-watch'] });
      setOpen(false);
      dismissedForDateRef.current = activeDate;
    },
  });

  function dismiss() {
    dismissedForDateRef.current = activeDate;
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="panel p-6 max-w-md w-full">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-accent-yellow" />
          <h3 className="text-[14px] font-semibold">Cierre del día alcanzado</h3>
        </div>
        <div className="text-[12px] text-text-secondary space-y-1.5 mb-4">
          <div>
            Fecha activa: <span className="font-mono text-text-primary">{activeDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={11} className="text-text-muted" />
            <span>Cutoff programado: <span className="font-mono text-text-primary">{cutoff.slice(0, 5)}</span></span>
            <span className="text-text-muted">·</span>
            <span>Reloj sim: <span className="font-mono text-brand">{simClock?.slice(11, 16) ?? '--:--'}</span></span>
          </div>
          <div>
            El día tiene <span className="tabular-nums text-text-primary">{visitasTotales}</span> visitas totales y aún hay pendientes.
          </div>
        </div>

        <div className="text-[11px] text-text-muted mb-3">
          ¿Querés extender el cutoff para terminar las rutas, o cerrar el día ahora?
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => extendMut.mutate(60)}
            disabled={extendMut.isPending || closeMut.isPending}
            className="btn-primary text-[12px] flex items-center justify-center gap-2"
          >
            {extendMut.isPending && extendMut.variables === 60 ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
            Extender +60 min
          </button>
          <button
            onClick={() => extendMut.mutate(120)}
            disabled={extendMut.isPending || closeMut.isPending}
            className="btn text-[12px] flex items-center justify-center gap-2"
          >
            {extendMut.isPending && extendMut.variables === 120 ? <Loader2 size={12} className="animate-spin" /> : null}
            Extender +120 min
          </button>
          <button
            onClick={() => closeMut.mutate()}
            disabled={extendMut.isPending || closeMut.isPending}
            className="btn text-[12px] text-accent-red flex items-center justify-center gap-2 border-accent-red/40"
          >
            {closeMut.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
            Cerrar el día ahora
          </button>
          <button
            onClick={dismiss}
            disabled={extendMut.isPending || closeMut.isPending}
            className="text-[11px] text-text-muted hover:text-text-primary mt-1"
          >
            Decidir más tarde
          </button>
        </div>

        {(extendMut.isError || closeMut.isError) && (
          <div className="mt-3 text-[11px] text-accent-red">
            Error: {(extendMut.error as Error)?.message ?? (closeMut.error as Error)?.message}
          </div>
        )}
      </div>
    </div>
  );
}
