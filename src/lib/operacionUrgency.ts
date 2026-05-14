/**
 * CR-013 — Helpers puros para `urgencyScore` del sidebar de drivers en
 * `OperacionModuleV2.tsx`.
 *
 * Extraídos para poder testear sin renderizar el componente (deck.gl /
 * react-map-gl no funcionan en jsdom). Si la lógica cambia, actualizá
 * ambos extremos.
 *
 * Convención de scores (más alto = más urgente):
 *   2000  → driver con alerta `target='driver'` sin ack hace ≥ THRESHOLD min
 *   1000  → al menos un VIP con alert_slack === 'RED'
 *    500  → al menos un RED no-VIP
 *    100+ → peor slack_min < -10 (más negativo = mayor urgencia)
 *   -1000 → finalizado (al fondo de la lista)
 */
import type { AlertEvent } from '../types/operacion';
import { SIN_RESPUESTA_THRESHOLD_MIN } from '../types/operacion';

/** Shape estructural mínimo. Aceptamos tanto `PlanEmpresa` (types.ts legacy)
 *  como `Empresa` (types/operacion.ts). PlanVisit no declara `alert_history`
 *  pero el backend lo hidrata (CR-012 T0.3) — lo accedemos defensivamente. */
export interface UrgencyVisitaInput {
  status: string;
  alert_slack: string;
  is_vip: boolean;
  slack_min: number;
  p_fallo: number;
  alert_history?: AlertEvent[] | null;
}
export interface UrgencyRutaInput {
  vehicle_id: number;
  visitas: UrgencyVisitaInput[];
}
export interface UrgencyEmpresaInput {
  rutas: UrgencyRutaInput[];
}

/** Tipo mínimo necesario para que la función pura pueda recibir el dato
 *  proveniente de planQ.data.empresas. Usamos un structural type relajado
 *  para no atarnos a `Empresa[]` exacto en los tests (mocks parciales). */
export interface UrgencyAgg {
  riskByVid: Record<number, number>;
  vipRiskByVid: Record<number, number>;
  peorSlackByVid: Record<number, number>;
  peorPFalloByVid: Record<number, number>;
  /** Timestamp ms de la alerta `target='driver'` más reciente SIN ack por vehículo.
   *  `null` cuando no hay ninguna alerta sin ack para ese driver. */
  lastDriverAckByVid: Record<number, number | null>;
}

/**
 * Recorre `empresas[].rutas[].visitas[].alert_history` y arma agregados
 * per-vehicle_id consumidos por `urgencyScore`. Implementación replicada
 * del useMemo en OperacionModuleV2.tsx → DriversAvancePanel.
 */
export function computeUrgencyAggregates(empresas: UrgencyEmpresaInput[]): UrgencyAgg {
  const risk: Record<number, number> = {};
  const vipRisk: Record<number, number> = {};
  const peorSlack: Record<number, number> = {};
  const peorPFallo: Record<number, number> = {};
  const lastDriverAck: Record<number, number | null> = {};

  empresas.forEach(emp => {
    emp.rutas.forEach(r => {
      if (r.vehicle_id == null) return;
      let rk = 0, vr = 0, sl = Infinity, pf = 0;
      let lastUnackMs: number | null = null;
      (r.visitas ?? []).forEach(v => {
        if (v.status === 'pending') {
          if (v.alert_slack === 'RED') {
            rk += 1;
            if (v.is_vip) vr += 1;
          }
          const s = v.slack_min ?? 0;
          if (s < sl) sl = s;
          const p = v.p_fallo ?? 0;
          if (p > pf) pf = p;
        }
        // SIN_RESPUESTA: max(sent_at) entre alertas target='driver' SIN ack.
        // Recorremos TODAS las visitas (no solo pendientes) — si el driver
        // ignoró una alerta a una visita ya completada, igual es un dato útil.
        (v.alert_history ?? []).forEach(ev => {
          if (ev.target !== 'driver') return;
          if (ev.acknowledged_at != null) return;
          const t = Date.parse(ev.timestamp);
          if (!Number.isFinite(t)) return;
          if (lastUnackMs == null || t > lastUnackMs) lastUnackMs = t;
        });
      });
      if (rk > 0) risk[r.vehicle_id] = rk;
      if (vr > 0) vipRisk[r.vehicle_id] = vr;
      if (sl !== Infinity) peorSlack[r.vehicle_id] = sl;
      if (pf > 0) peorPFallo[r.vehicle_id] = pf;
      lastDriverAck[r.vehicle_id] = lastUnackMs;
    });
  });

  return {
    riskByVid: risk,
    vipRiskByVid: vipRisk,
    peorSlackByVid: peorSlack,
    peorPFalloByVid: peorPFallo,
    lastDriverAckByVid: lastDriverAck,
  };
}

const SIN_RESPUESTA_THRESHOLD_MS = SIN_RESPUESTA_THRESHOLD_MIN * 60 * 1000;

/**
 * Score de urgencia para ordenamiento del sidebar. `nowMs` viene del
 * `sim_clock` cuando está disponible; sino `Date.now()`.
 */
export function urgencyScore(
  vid: number,
  status: string,
  agg: UrgencyAgg,
  nowMs: number,
): number {
  // CR-013: SIN_RESPUESTA — driver con alerta sin ack hace ≥ THRESHOLD min.
  const lastUnack = agg.lastDriverAckByVid[vid];
  if (lastUnack != null && (nowMs - lastUnack) > SIN_RESPUESTA_THRESHOLD_MS) {
    return 2000;
  }
  if ((agg.vipRiskByVid[vid] ?? 0) > 0) return 1000;
  if ((agg.riskByVid[vid] ?? 0) > 0) return 500;
  const sl = agg.peorSlackByVid[vid] ?? 0;
  if (sl < -10) return 100 + Math.abs(sl);
  if (status === 'finalizado') return -1000;
  return -sl;
}

/** True si el driver califica como "SIN RESPUESTA" según el agregado + reloj. */
export function isSinRespuesta(
  vid: number,
  agg: UrgencyAgg,
  nowMs: number,
): boolean {
  const lastUnack = agg.lastDriverAckByVid[vid];
  if (lastUnack == null) return false;
  return (nowMs - lastUnack) > SIN_RESPUESTA_THRESHOLD_MS;
}
