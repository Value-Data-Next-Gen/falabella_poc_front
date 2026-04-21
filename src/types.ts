export interface AppState {
  sim_clock: string;
  today: string;
  day_seed: number;
  auto_advance: boolean;
  sim_minutes_per_tick: number;
  total_visits: number;
  vehicles: number[];
  incidents: Record<string, number>;
  last_tick_at: string | null;
}

export interface KPIs {
  total: number;
  completed: number;
  in_route: number;
  pending: number;
  red_simpliroute: number;
  yellow_simpliroute: number;
  vd_alerts: number;
  vd_alerts_caught_real: number;
  real_failures_oracle: number;
  projected_compliance_pct: number;
  rescue_clp: number;
}

export interface Visit {
  tracking_id: string;
  vehicle_id: number;
  vehicle_name: string;
  order: number;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  load: number;
  window_start: string;
  window_end: string;
  planned_arrival_time: string;
  estimated_time_arrival: string;
  slack_min: number;
  alert_slack: 'GREEN' | 'YELLOW' | 'RED';
  p_fallo: number;
  alert_valuedata: boolean;
  status: 'pending' | 'completed';
  horas_hasta_window_end: number;
}

export interface ShapFactor {
  name: string;
  display: string;
  contribution: number;
}

export interface AnticipatedAlert {
  tracking_id: string;
  title: string;
  vehicle_id: number;
  vehicle_name: string;
  window_end: string;
  estimated_time_arrival: string;
  p_fallo: number;
  horas_hasta_window_end: number;
  latitude: number;
  longitude: number;
  top_factors: ShapFactor[];
}

export interface VisitExplanation {
  tracking_id: string;
  title: string;
  p_fallo: number;
  alert_slack: string;
  alert_valuedata: boolean;
  top_factors: ShapFactor[];
}

export interface ModelMetrics {
  auc: number;
  brier: number;
  confusion_matrix: number[][];
  calibration_curve: { predicted: number; actual: number }[];
  n_train: number;
  n_val: number;
  base_rate_train: number;
  base_rate_val: number;
}

export interface FeatureImportance {
  name: string;
  display: string;
  importance: number;
}

export interface VehicleSummary {
  vehicle_id: number;
  vehicle_name: string;
  n_visits: number;
  completed: number;
  pending: number;
  red_simpliroute: number;
  vd_alerts: number;
  last_observed_delay_min: number;
  incident_extra_min: number;
}

// ---- Maestros ----
export interface Driver {
  driver_id: string;
  name: string;
  phone: string;
  license: string;
  vehicle_id: number;
  vehicle_name: string;
  rating: number;
  deliveries_30d: number;
  fail_rate_30d: number;
  active: boolean;
  joined_at: string;
}

export interface VehicleExtended {
  vehicle_id: number;
  name: string;
  type: string;
  plate: string;
  capacity_m3: number;
  driver_id: string;
  driver_name: string;
  depot_lat: number;
  depot_lon: number;
  active: boolean;
  year: number;
}

export interface ClientMaster {
  customer_id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  comuna_id: string;
  is_problem_zone: boolean;
  n_visits_60d: number;
  n_failed_60d: number;
  fail_rate_60d: number;
  first_seen: string;
  last_seen: string;
}

// ---- Eventos ----
export type EventType =
  | 'delivery'
  | 'failed_delivery'
  | 'alert_triggered'
  | 'alert_cleared'
  | 'red_simpli'
  | 'incident_auto'
  | 'incident_manual'
  | 'day_reset';

export interface StreamEvent {
  event_id: string;
  type: EventType;
  sim_ts: string;
  wall_ts: string;
  tracking_id?: string;
  vehicle_id?: number;
  vehicle_name?: string;
  title?: string;
  window_end?: string;
  eta?: string;
  slack_min?: number;
  delay_min?: number;
  p_fallo?: number;
  horas_hasta_we?: number;
  extra_min?: number;
  reason?: string;
  new_day_seed?: number;
}
