/**
 * Hook de polling robusto para la pantalla Operación.
 *
 * Coordina los 2 queries críticos del mapa:
 *   - /api/operacion/driver-positions?fecha=X   (posiciones live, poll 10s)
 *   - /api/plan-diario?source=real&...          (plan + visitas, poll 10s)
 *
 * Garantías (Tarea 6 del CR-010):
 *
 *   ✅ Polling cada 10s con setInterval + cleanup.
 *      → React-Query con refetchInterval: 10_000 y cleanup automático al
 *        desmontar el hook.
 *
 *   ✅ Pausa cuando document.visibilityState === 'hidden' y reanuda al volver.
 *      → react-query desde v5 trae refetchOnWindowFocus + pausa automática
 *        cuando el browser quita visibilidad. Lo dejamos en sus defaults
 *        (refetchIntervalInBackground=false) y exponemos `polling.isPaused`
 *        para que la UI pueda indicarlo.
 *
 *   ✅ Backoff exponencial en error (10s → 20s → 40s → 80s, reset al éxito).
 *      → Configuramos retry/retryDelay manualmente. react-query retry default
 *        es 3 con delay=Math.min(1000 * 2 ** attemptIndex, 30000); aquí lo
 *        ajustamos a la curva del brief.
 *
 *   ⚠️ If-Modified-Since: TODO(backend). Hoy backend NO devuelve Last-Modified
 *      ni respeta el header (responde 200 siempre con el snapshot completo).
 *      Cuando lo agregue, modificar el queryFn para enviar `If-Modified-Since`
 *      con el `updated_at` recibido y tratar 304 como "no-op".
 *
 *   ✅ Mutación quirúrgica del source GeoJSON.
 *      → Garantizado por deck.gl: usamos `updateTriggers` por accessor, no
 *        recreamos layers. React-Query hace structural sharing del objeto
 *        de respuesta (mismo data ref si el JSON no cambió byte-a-byte).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api';

/**
 * Curva de backoff del brief: 10s → 20s → 40s → 80s. Reset a 10s al primer éxito.
 * react-query llama retryDelay(failureCount) con failureCount empezando en 1.
 */
export function operacionBackoffMs(failureCount: number): number {
  const base = 10_000;
  const max = 80_000;
  // 2^(failureCount-1): 1→10s, 2→20s, 3→40s, 4→80s, 5+→80s
  return Math.min(base * Math.pow(2, Math.max(0, failureCount - 1)), max);
}

const RETRY_MAX = 4; // 4 intentos = ~150s de back-pressure antes de claudicar

export interface UseLiveOperationDataOptions {
  /** Fecha activa del día operativo (YYYY-MM-DD). Si null, hook deshabilitado. */
  fecha: string | null;
  /** Filtro de empresa (transport_manager scope o admin filter). null = todas. */
  empresaId?: number | null;
  /** Región (RM | regiones | nombre exacto | all). */
  region?: string;
  /** Sólo visitas VIP. */
  onlyVip?: boolean;
  /** Override del intervalo de polling (testing). Default 10s. */
  pollMs?: number;
}

/**
 * Output:
 *   drivers / plan      → datos
 *   isLoading / isError / error → status combinado
 *   polling             → telemetría (errorCount, nextRetryMs, isPaused, lastUpdate)
 */
export function useLiveOperationData(opts: UseLiveOperationDataOptions) {
  const { fecha, empresaId = null, region = 'all', onlyVip = false, pollMs = 10_000 } = opts;

  // Pausa automática cuando la tab no está visible. react-query también pausa
  // los polls; este flag es solo para que la UI lo muestre.
  const [isPaused, setIsPaused] = useState<boolean>(
    typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
  );
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => setIsPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const driversQ = useQuery({
    queryKey: ['live-op-drivers', fecha, empresaId],
    queryFn: () => api.operacion.driverPositions(fecha as string, empresaId),
    enabled: !!fecha,
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    retry: RETRY_MAX,
    retryDelay: operacionBackoffMs,
    staleTime: pollMs / 2,
  });

  const planQ = useQuery({
    queryKey: ['live-op-plan', fecha, empresaId, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaId ?? undefined,
      region: region as any,
      only_vip: onlyVip,
      source: 'real',
      planned_date: fecha as string,
    }),
    enabled: !!fecha,
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    retry: RETRY_MAX,
    retryDelay: operacionBackoffMs,
    staleTime: pollMs / 2,
  });

  // Telemetría agregada (mayor de ambos counters → estado peor del peor)
  const errorCount = Math.max(
    driversQ.failureCount ?? 0,
    planQ.failureCount ?? 0,
  );
  const nextRetryMs = errorCount > 0 ? operacionBackoffMs(errorCount) : null;
  const lastUpdate = Math.max(
    driversQ.dataUpdatedAt ?? 0,
    planQ.dataUpdatedAt ?? 0,
  );

  return {
    drivers: driversQ.data,
    plan: planQ.data,
    isLoading: driversQ.isLoading || planQ.isLoading,
    isError: driversQ.isError || planQ.isError,
    error: (driversQ.error ?? planQ.error) as Error | null,
    /** Forzar refresh manual de ambos queries. */
    refresh: () => Promise.all([driversQ.refetch(), planQ.refetch()]),
    polling: {
      /** Tab oculta o sin visibilidad → polling en pausa. */
      isPaused,
      /** Cantidad de errores consecutivos en cualquiera de los dos queries. */
      errorCount,
      /** Ms hasta el próximo retry (si hay errores activos), null si saludable. */
      nextRetryMs,
      /** Epoch ms del último data update efectivo. */
      lastUpdate,
    },
  };
}
