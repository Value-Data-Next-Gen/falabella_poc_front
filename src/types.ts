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

// ---- Seguimiento (fpoc) ----
export interface AvailableDates {
  dates: string[];
  min_date: string | null;
  max_date: string | null;
}

export interface SeguimientoKPIs {
  planned_date: string;
  total: number;
  completed: number;
  failed: number;
  completion_pct: number;
  ruta_anomala: number;
  ruta_anomala_pct: number;
  sla_hour_avg: number;
  sla_hour_p50: number;
  sla_hour_p90: number;
  on_time: number;
  early: number;
  late: number;
  empresas: number;
  drivers: number;
}

export interface SlaBin {
  bin_label: string;
  bin_start: number;
  count: number;
}

export interface MotivoItem {
  motivo: string;
  count: number;
}

export interface EmpresaPerf {
  empresa_id: number;
  nombre: string;
  total: number;
  completed: number;
  failed: number;
  ruta_anomala: number;
  sla_hour_avg: number;
  on_time_pct: number;
}

export interface LocalidadPerf {
  localidad: string;
  total: number;
  failed: number;
  failed_pct: number;
}

export interface RutaAnomalaBreakdown {
  flag: string;
  count: number;
  pct: number;
}

export interface FpocVisitRow {
  id: number;
  planned_date: string;
  title: string;
  order: number;
  address: string;
  status: string;
  checkout_cl: string | null;
  current_eta_cl: string | null;
  sla_hour_checkout_eta: number;
  ct: string;
  drivername: string;
  empresa_id: number;
  ruta_anomala: boolean;
  am_pm: string;
}

export interface FpocVisitsPage {
  rows: FpocVisitRow[];
  total: number;
  limit: number;
  offset: number;
}

// ---- Plan Diario ----
export interface PlanVisit {
  tracking_id: string;
  order: number;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  window_start: string;
  window_end: string;
  planned_arrival_time: string;
  estimated_time_arrival: string;
  slack_min: number;
  alert_slack: string;
  p_fallo: number;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'vip';
  priority_reason: string | null;
  is_vip: boolean;
  alert_valuedata: boolean;
}

export interface PlanDriver {
  vehicle_id: number;
  vehicle_name: string;
  driver_name: string;
  total_visits: number;
  completed: number;
  pending: number;
  red_visits: number;
  vip_visits: number;
  high_priority: number;
  visits: PlanVisit[];
}

export interface PlanEmpresa {
  empresa_id: number;
  nombre: string;
  total_visits: number;
  completed: number;
  pending: number;
  red_visits: number;
  vip_visits: number;
  high_priority: number;
  drivers: PlanDriver[];
}

export interface PlanDiarioResponse {
  planned_date: string;
  sim_clock: string;
  empresas: PlanEmpresa[];
}

// ---- Notifications / Preferences / VIP / Priority ----
export interface UserPreferences {
  phone_e164: string | null;
  notify_whatsapp: boolean;
  notify_pfallo_threshold: number; // 0-1
  notify_slack_min_threshold: number;
  notify_only_vip: boolean;
}

export interface NotificationResult {
  to_number: string;
  status: 'sent' | 'dry_run' | 'error';
  twilio_sid: string | null;
  error: string | null;
  user_id: number | null;
}

export interface WhatsAppResponse {
  dry_run: boolean;
  sent: number;
  failed: number;
  results: NotificationResult[];
}

export interface NotificationLogRow {
  notification_id: number;
  user_id: number | null;
  to_number: string;
  channel: string;
  subject: string | null;
  body: string;
  tracking_id: string | null;
  twilio_sid: string | null;
  status: string;
  error_msg: string | null;
  triggered_by: string;
  created_at: string;
}

// ---- Watchlist (visitas en riesgo) ----
export interface WatchlistVisit {
  tracking_id: string;
  vehicle_id: number;
  vehicle_name: string;
  driver_name: string;
  empresa_id: number | null;
  empresa_nombre: string | null;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  order: number;
  window_end: string;
  estimated_time_arrival: string;
  slack_min: number;
  alert_slack: string;
  p_fallo: number;
  alert_valuedata: boolean;
  is_vip: boolean;
  priority: 'low' | 'normal' | 'high' | 'vip';
  urgency_score: number;
  severity: 'CRITICO' | 'ALTO' | 'MEDIO';
  reasons: string[];
  notif: {
    count: number;
    sent_count: number;
    last_status: string;
    last_created_at: string;
  } | null;
}

export interface WatchlistSummary {
  total: number;
  critico: number;
  alto: number;
  medio: number;
  vip_at_risk: number;
  notified: number;
  not_notified: number;
}

export interface WatchlistResponse {
  summary: WatchlistSummary;
  visits: WatchlistVisit[];
}

export interface LiveGenStats {
  enabled: boolean;
  interval_sec: number;
  rows_per_tick: number;
  total_inserted_session: number;
  last_insert_at: string | null;
  last_error: string | null;
  rows_today_db: number;
}

export interface TrackingNotifSummary {
  tracking_id: string;
  count: number;
  sent_count: number;
  last_status: string;
  last_to: string;
  last_body: string;
  last_triggered_by: string;
  last_created_at: string;
  last_twilio_sid: string | null;
  last_content_sid: string | null;
  last_content_variables: Record<string, string> | null;
}

export interface NotificationsConfig {
  enabled: boolean;
  dry_run: boolean;
  from_number: string;
  has_creds: boolean;
}

export type MatchType = 'customer_id' | 'title' | 'reference';

export interface VipClient {
  vip_id: number;
  match_type: MatchType;
  match_value: string;
  empresa_id: number | null;
  tier: string;
  notes: string | null;
  active: boolean;
  created_by: number | null;
  created_at: string;
}

export type Priority = 'low' | 'normal' | 'high' | 'vip';

export interface PriorityOverride {
  tracking_id: string;
  priority: Priority;
  reason: string | null;
  set_by: number | null;
  set_by_name: string | null;
  set_at: string;
}

// ---- Access log (auditoría) ----
export interface AccessLogRow {
  log_id: number;
  event_type: 'login_success' | 'login_failed' | 'logout';
  user_id: number | null;
  user_email: string | null;
  user_display_name: string | null;
  user_role: string | null;
  email_attempted: string | null;
  ip_address: string | null;
  user_agent: string | null;
  error_detail: string | null;
  created_at: string;
}

export interface AccessSummary {
  total_24h: number;
  success_24h: number;
  failed_24h: number;
  unique_users_24h: number;
  unique_ips_24h: number;
}

// ---- Auth ----
export type UserRole = 'falabella_admin' | 'falabella_ops' | 'transport_manager';

export interface AuthUser {
  user_id: number;
  email: string;
  display_name: string;
  role: UserRole;
  empresa_id: number | null;
  empresa_nombre: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface Empresa {
  empresa_id: number;
  nombre: string;
  activo: boolean;
}

// ---- Mantenedores admin ----
export interface AdminEmpresa extends Empresa {
  created_at: string | null;
}

export interface AdminUser {
  user_id: number;
  email: string;
  display_name: string;
  role: UserRole;
  empresa_id: number | null;
  empresa_nombre: string | null;
  activo: boolean;
  phone_e164: string | null;
  notify_whatsapp: boolean;
  created_at: string | null;
  last_login: string | null;
}

export interface AdminDriver {
  driver_id: string;
  name: string;
  phone: string | null;
  license: string | null;
  vehicle_id: number;
  vehicle_name: string;
  rating: number;
  deliveries_30d: number;
  fail_rate_30d: number;
  joined_at: string | null;
  active: boolean;
  is_problem_hidden: boolean;
}

export interface AdminVehicle {
  vehicle_id: number;
  name: string;
  type: string;
  plate: string;
  capacity_m3: number;
  driver_id: string | null;
  driver_name: string | null;
  depot_lat: number;
  depot_lon: number;
  year: number | null;
  active: boolean;
  is_problem_hidden: boolean;
}

export interface AdminClient {
  customer_id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  is_recurrent: boolean;
  in_problem_comuna: boolean;
  notes: string | null;
}

export interface AdminClientsPage {
  rows: AdminClient[];
  total: number;
  limit: number;
  offset: number;
}

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
