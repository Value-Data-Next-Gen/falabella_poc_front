/**
 * Tipos canónicos del módulo Operación. Espejo del shape real del backend
 * (`/api/plan-diario?source=real` y `/api/operacion/driver-positions`).
 *
 * Fuente de verdad: backend/routers/plan_diario.py (CR-012 T0.3).
 *
 * Convenciones:
 *   - Literales estrictos para `status`, `alert_slack`, `priority`, `vip_tier`.
 *     El backend ya los normaliza — no aceptamos `string` libre.
 *   - Los campos de teléfono vienen con flag `*_is_mock` que el UI debe
 *     respetar para deshabilitar acciones (CR-012 T0.3).
 *
 * NOTA brief vs realidad:
 *   El brief refactor v4 lista `status: "pending" | "in_progress" | "ok" | "failed"`.
 *   El backend REAL usa `'pending' | 'completed' | 'failed'` (no "ok" ni
 *   "in_progress"). Usamos los valores reales. Si en algún momento el brief
 *   gana, el cambio es en backend + acá simultáneo.
 */

// ============================================================================
// Literales de dominio
// ============================================================================

/** Categorización oficial del backend según slack vs ventana de entrega. */
export type AlertSlack = 'RED' | 'YELLOW' | 'GREEN';

/** Status de visita normalizado en backend. */
export type VisitaStatus = 'pending' | 'completed' | 'failed';

/** Tier VIP del cliente (null = no VIP). */
export type VipTier = 'gold' | 'platinum' | null;

/** Prioridad efectiva de la visita. `vip` se asigna automáticamente cuando is_vip=true. */
export type Priority = 'low' | 'normal' | 'high' | 'vip';

/** Estado operacional del driver (de `/driver-positions`, NO de visita). */
export type DriverStatus = 'pendiente' | 'en_ruta' | 'entregando' | 'finalizado';

/** Canales de envío de alerta. Coincide con CHECK constraint del backend. */
export type AlertChannel = 'whatsapp' | 'sms' | 'in_app';

/** Destinatario de alerta. */
export type AlertTarget = 'cliente' | 'driver' | 'supervisor';

/** Tipos de evento alertable detectados por el copiloto (v1). */
export type AlertType = 'retraso_vip' | 'driver_sin_respuesta' | 'motivo_patron';

// ============================================================================
// Modelos
// ============================================================================

/** Evento histórico de alerta enviada para una visita.
 *  `acknowledged_at = null` + `timestamp` >10min → estado "sin respuesta". */
export interface AlertEvent {
  /** ISO 8601, alias de `sent_at` en backend. */
  timestamp: string;
  type: AlertType;
  channel: AlertChannel;
  target: AlertTarget;
  /** ISO 8601 o null. null = pendiente de ack. */
  acknowledged_at: string | null;
}

export interface Visita {
  tracking_id: string;
  /** Orden cronológico dentro de la ruta (1..N). NO usar "secuencia". */
  order: number;
  title: string;
  cliente_nombre: string;
  address: string;
  comuna: string | null;
  region: string;
  /** Lat/Lon canónicos. Los alias `lat`/`lon` siguen presentes por compat. */
  latitude: number;
  longitude: number;
  lat: number;
  lon: number;
  /** Strings HH:MM. Vacío "" = sin dato — usar `—` en UI. */
  window_start: string;
  window_end: string;
  planned_arrival_time: string;
  estimated_time_arrival: string;
  /** ISO 8601 timestamp. Fuente principal para Gantt. */
  current_eta_cl: string;
  /** Minutos antes de cerrar la ventana. Negativo = atraso. */
  slack_min: number;
  alert_slack: AlertSlack;
  /** 0..1. P(fallo) predictiva. */
  p_fallo: number;
  status: VisitaStatus;
  priority: Priority;
  priority_reason: string | null;
  is_vip: boolean;
  vip_tier: VipTier;
  vip_deadline_time: string | null;
  /** Flag VD propio: borde naranjo en mapa. NO confundir con `alert_slack`. */
  alert_valuedata: boolean;
  folio: string | null;
  motivo_reportado: string | null;
  severity: string | null;
  /** CR-012 T0.3: historial cronológico ascendente de alertas enviadas. */
  alert_history: AlertEvent[];
}

export interface Ruta {
  ruta_id: string;
  /** Alias de patente_falsa. Identificador estable del vehículo. */
  vehicle_id: number;
  vehicle_name: string;
  plate: string | null;
  patente: string | null;
  driver_name: string | null;
  dotacion_estado: string | null;
  dotacion_motivo: string | null;
  operable: boolean;
  region: string;
  ct: string | null;
  /** Próximo stop pendiente. null si ruta finalizada. */
  next_stop_order: number | null;
  orden_actual: number | null;
  total_visitas: number;
  completadas: number;
  pendientes: number;
  fallidas: number;
  en_riesgo: number;
  progreso_pct: number;
  red_visitas: number;
  vip_visitas: number;
  high_priority: number;
  visitas: Visita[];
  /** CR-012 T0.3. E.164. is_mock=true → deshabilitar acciones WhatsApp. */
  driver_phone: string;
  driver_phone_is_mock: boolean;
}

export interface Empresa {
  empresa_id: number;
  empresa_nombre: string;
  total_visitas: number;
  completadas: number;
  pendientes: number;
  fallidas: number;
  en_riesgo: number;
  red_visitas: number;
  vip_visitas: number;
  high_priority: number;
  rutas: Ruta[];
  /** CR-012 T0.3. Supervisor que recibe escalamientos. */
  supervisor_phone: string;
  supervisor_phone_is_mock: boolean;
}

export interface PlanDiarioResponse {
  planned_date: string;
  /** ISO timestamp del reloj simulado. Fuente para línea "now" del Gantt. */
  sim_clock: string;
  region: string;
  only_vip: boolean;
  source: 'real' | 'synthetic';
  empresas: Empresa[];
}

/**
 * @deprecated Shape viejo del endpoint `/api/operacion/driver-positions`.
 * Fase 3 reemplazó el response por el flat array `DriverPosition[]` declarado
 * en `src/api.ts`. Este tipo quedó huérfano (no se consume en ningún caller)
 * pero se preserva como referencia histórica hasta que se haga la limpieza
 * generalizada de `types.ts` legacy. Usar `DriverPosition` de `api.ts`.
 */
export interface DriverLive {
  vehicle_id: number;
  patente: string;
  lat: number;
  lon: number;
  ruta_id: string | null;
  status: DriverStatus;
  stops_total: number;
  stops_completed: number;
  stops_failed: number;
  vip_visitas: number;
}

/**
 * @deprecated Shape viejo (envoltura con sim_active/sim_clock/drivers). Fase 3
 * eliminó la envoltura: el endpoint ahora devuelve `DriverPosition[]` directo.
 */
export interface DriverPositionsResponse {
  sim_active: boolean;
  sim_clock: string | null;
  tick_sec: number;
  minutes_per_tick: number;
  drivers: DriverLive[];
}

// ============================================================================
// Constantes UI compartidas (consumidas por mapa + Gantt + KPI strip)
// ============================================================================

/** Ventana operativa para Gantt (eje X) y banner de fuera-de-hora. */
export const OPERATION_WINDOW = { start: '07:00', end: '22:00' } as const;

/** Umbral para considerar a un driver "sin respuesta" tras enviar alerta. */
export const SIN_RESPUESTA_THRESHOLD_MIN = 10;

// ============================================================================
// Type guards
// ============================================================================

export const isPending = (v: Pick<Visita, 'status'>): boolean =>
  v.status === 'pending';

export const isCompleted = (v: Pick<Visita, 'status'>): boolean =>
  v.status === 'completed';

export const isFailed = (v: Pick<Visita, 'status'>): boolean =>
  v.status === 'failed';

/** Una visita está "en riesgo" según el flag oficial del backend, NO p_fallo. */
export const isAtRisk = (v: Pick<Visita, 'alert_slack'>): boolean =>
  v.alert_slack === 'RED';

// ============================================================================
// Compatibilidad: re-export del shape auto-generado por openapi-typescript.
// Si en el futuro alguien necesita el tipo exacto del request/response sin
// la curaduría de arriba, lo puede importar de `./api`.
// ============================================================================
export type { components as OpenApiComponents } from './api';
