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

// ---- Onboarding ----
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
  | 'day_reset'
  | 'comment_alert'
  | 'vip_deadline_warning'
  | 'motivo_correction_suggested'
  | 'motivo_correction_decided'
  | 'wa_user_onboarded';

// ---- Motivo corrections (Sprint 4.A2) ----
export type CorrectionStatus = 'pending' | 'accepted' | 'rejected' | 'no_action';

export interface MotivoCorrection {
  correction_id: number;
  comment_id: number;
  tracking_id: string;
  motivo_reportado: string;
  motivo_sugerido: string;
  confianza: 'alta' | 'media' | 'baja' | string;
  razonamiento: string;
  driver_id: string | null;
  driver_name: string | null;
  status: CorrectionStatus;
  decided_by_user_id: number | null;
  decided_at: string | null;
  notified_driver_at: string | null;
  created_at: string;
  vehicle_name: string | null;
  empresa_nombre: string | null;
  comentario: string | null;
}

// ---- Driver scorecard (Sprint 4.A3) ----
export interface DriverScorecardRow {
  driver_id: string;
  driver_name: string;
  vehicle_id: number | null;
  vehicle_name: string | null;
  empresa_id: number | null;
  empresa_nombre: string | null;
  deliveries_30d: number;
  fail_rate_30d: number;
  comments_total: number;
  corrections_pending: number;
  corrections_accepted: number;
  corrections_rejected: number;
  corrections_acceptance_rate: number;
  rating: number;
  alerts_critical_30d: number;
  alerts_medium_30d: number;
  rank_fail_rate: number;
  rank_acceptance: number;
}

// ---- Driver WhatsApp opt-in (Sprint 4.A1) ----
export interface DriverWhatsAppOut {
  driver_id: string;
  name: string;
  phone: string | null;
  phone_e164: string | null;
  notify_whatsapp: boolean;
  opted_in_at: string | null;
}

export interface DriverWhatsAppUpdate {
  phone_e164?: string | null;
  notify_whatsapp?: boolean;
  opted_in_at?: string | null;
  set_opted_in_now?: boolean;
  clear_opted_in?: boolean;
}

// ---- Motivos / comentarios del transportista ----
export type MotivoSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Motivo {
  motivo: string;
  default_alertable: boolean;
  default_severity: MotivoSeverity;
}

export interface MotivoAlertConfig {
  motivo: string;
  empresa_id: number | null;
  alertable: boolean;
  severity: MotivoSeverity;
  description: string;
  description_is_custom: boolean;
  default_description: string;
  is_default: boolean;
  updated_at: string | null;
  updated_by: number | null;
}

export interface SystemPromptResponse {
  system_prompt: string;
  empresa_id: number | null;
  has_llm_creds: boolean;
}

export interface CommentSimStats {
  enabled: boolean;
  interval_sec: number;
  only_alertable: boolean;
  severity_filter: MotivoSeverity | null;
  total_emitted_session: number;
  last_emit_at: string | null;
  last_emit_payload: {
    tracking_id: string;
    vehicle_name: string;
    motivo: string;
    comentario: string;
    severity: MotivoSeverity;
    alertable: boolean;
  } | null;
  last_error: string | null;
}

export interface ClassifyResponse {
  motivo: string;
  confianza: 'alta' | 'media' | 'baja';
  razonamiento: string;
  fallback: boolean;
  alertable: boolean;
  severity: MotivoSeverity;
}

export interface VisitComment {
  comment_id: number;
  tracking_id: string;
  vehicle_id: number | null;
  empresa_id: number | null;
  motivo: string;
  comentario: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  alertable: boolean;
  severity: MotivoSeverity | null;
}

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

// ---- Plan Diario (Sprint 6: ruta_id string + folio + region/comuna ampliada) ----
export interface PlanVisit {
  tracking_id: string;
  order: number;
  title: string;
  cliente_nombre: string;
  address: string;
  comuna: string | null;
  // Sprint 6: region puede ser 'RM' o nombre de región concreta (Valparaíso, Biobío...)
  region: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  window_start?: string;
  window_end?: string;
  planned_arrival_time?: string;
  estimated_time_arrival: string;     // 'HH:MM'
  current_eta_cl?: string;            // ISO timestamp (Sprint 6)
  slack_min: number;
  alert_slack: string;
  p_fallo: number;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'vip';
  priority_reason: string | null;
  is_vip: boolean;
  vip_tier: string | null;
  vip_deadline_time: string | null;
  alert_valuedata: boolean;
  folio: string | null;               // Sprint 6: e.g. '#14246780'
  motivo_reportado: string | null;
  severity: MotivoSeverity | null;
}

export interface PlanRuta {
  ruta_id: string;                    // Sprint 6: 'R-YYYYMMDD-NNN'
  vehicle_id: number;
  vehicle_name: string;
  plate: string | null;
  patente: string | null;             // Sprint 6: alias visible
  driver_name: string | null;         // puede ser null si la dotación no asigna chofer
  dotacion_estado: string | null;
  dotacion_motivo: string | null;
  operable: boolean;
  region: string;                     // Sprint 6
  ct: string | null;                  // Sprint 6: 'CD NORTE' | 'CD SUR' | ...
  next_stop_order: number | null;     // Sprint 6: alias semántico
  orden_actual: number | null;        // compat
  total_visitas: number;
  completadas: number;
  pendientes: number;
  fallidas: number;
  en_riesgo: number;
  progreso_pct: number;
  red_visitas: number;
  vip_visitas: number;
  high_priority: number;
  visitas: PlanVisit[];
}

export interface PlanEmpresa {
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
  rutas: PlanRuta[];
}

export interface PlanDiarioResponse {
  planned_date: string;
  sim_clock: string;
  region: string;
  only_vip: boolean;
  source?: 'real' | 'synthetic';      // Sprint 6
  empresas: PlanEmpresa[];
}

// Compat (Sprint 1): forma legacy que devuelve /api/plan-diario?legacy=true.
// Usado por RouteOpsPanel, DayConfigPanel y AsistenteIAPanel.
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

// Forma legacy de PlanEmpresa (Sprint 1) — backend devuelve esta cuando se usa
// ?legacy=true. La forma nueva PlanEmpresa (Sprint 2) anida `rutas` en lugar de
// `drivers`.
export interface PlanEmpresaLegacy {
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

export interface PlanDiarioResponseLegacy {
  planned_date: string;
  sim_clock: string;
  empresas: PlanEmpresaLegacy[];
}

export type RegionFilter = 'all' | 'RM' | 'regiones' | string;

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
  direction?: 'inbound' | 'outbound' | null;
  profile_name?: string | null;
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
  vip_tier: string | null;
  vip_deadline_time: string | null;
  priority: 'low' | 'normal' | 'high' | 'vip';
  urgency_score: number;
  severity: 'CRITICO' | 'ALTO' | 'MEDIO';
  reasons: string[];
  region: 'RM' | 'regiones';
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
  default_content_sid?: string | null;
}

export type MatchType = 'customer_id' | 'title' | 'reference';

export interface VipClient {
  vip_id: number;
  match_type: MatchType;
  match_value: string;
  empresa_id: number | null;
  tier: string;
  notes: string | null;
  deadline_time: string | null;        // HH:MM
  alert_minutes_before: number;
  last_alert_sent_at: string | null;
  active: boolean;
  created_by: number | null;
  created_at: string;
}

export interface VipParseNotesResponse {
  deadline_time: string | null;
  alert_minutes_before: number;
  razonamiento: string;
  fallback: boolean;
}

export type EventTypeExtended = EventType | 'vip_deadline_warning';

// ---- Sprint 7: buscador global ----
export type SearchKind = 'vip' | 'empresa' | 'contacto' | 'driver' | 'visita' | 'motivo';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  label: string;
  sublabel: string | null;
  empresa_id: number | null;
  tracking_id: string | null;
}

export interface SearchResults {
  vips: SearchHit[];
  empresas: SearchHit[];
  contactos: SearchHit[];
  drivers: SearchHit[];
  visitas: SearchHit[];
  motivos: SearchHit[];
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
export type UserRole = 'falabella_admin' | 'falabella_ops' | 'transport_manager' | 'driver';

export interface AuthUser {
  user_id: number;
  email: string;
  display_name: string;
  role: UserRole;
  empresa_id: number | null;
  empresa_nombre: string | null;
  driver_id: string | null;
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
  central_phone?: string | null;
}

// ---- Empresa contactos (destinatarios WhatsApp por empresa transportista) ----
// Los drivers viven en fpoc.drivers con su propio phone. Los contactos de
// empresa son SOLO no-drivers. Filas legacy con rol='driver' fueron migradas
// a 'otro' en migración 012; el backend ya no acepta crear 'driver' acá.
export type ContactoRol = 'jefe' | 'coordinador' | 'dispatcher' | 'otro';
export type ContactoRegion = 'RM' | 'regiones' | 'all';

export interface EmpresaSummary {
  empresa_id: number;
  nombre: string;
  activo: boolean;
  central_phone: string | null;
  contactos_count: number;
  opted_in_count: number;
  last_alert_at: string | null;
}

export interface Contacto {
  contact_id: number;
  empresa_id: number;
  nombre: string;
  rol: ContactoRol;
  phone_e164: string;
  email: string | null;
  severities_in: MotivoSeverity[] | null;  // null = todas
  motivos_in: string[] | null;              // null = todos
  region_filter: ContactoRegion;
  opted_in_at: string | null;
  active: boolean;
  notes: string | null;
  created_by_user_id: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContactoCreate {
  nombre: string;
  rol: ContactoRol;
  phone_e164: string;
  email?: string | null;
  severities_in?: MotivoSeverity[] | null;
  motivos_in?: string[] | null;
  region_filter?: ContactoRegion;
  notes?: string | null;
}

export interface ContactoUpdate {
  nombre?: string;
  rol?: ContactoRol;
  phone_e164?: string;
  email?: string | null;
  severities_in?: MotivoSeverity[] | null;
  motivos_in?: string[] | null;
  region_filter?: ContactoRegion;
  notes?: string | null;
  active?: boolean;
}

export interface BulkCSVResult {
  added: number;
  skipped: { row: number; reason: string }[];
  errors: { row: number; reason: string }[];
}

export interface TestBroadcastRow {
  contact_id: number;
  nombre: string;
  phone: string;
  status: 'sent' | 'dry_run' | 'error' | 'disabled';
  twilio_sid: string | null;
  error: string | null;
}

export interface TestBroadcastResult {
  empresa_id: number;
  body: string;
  sent: number;
  failed: number;
  results: TestBroadcastRow[];
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
  driver_id: string | null;
  driver_name: string | null;
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
  empresa_id: number | null;
  empresa_nombre: string | null;
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
  empresa_id: number | null;
  empresa_nombre: string | null;
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

export type DotacionEstado = 'disponible' | 'ausente' | 'licencia' | 'mantencion' | 'baja' | 'reemplazo';

export interface CapacitacionModulo {
  modulo_id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  validez_meses: number;
  activo: boolean;
}

export interface DriverCapacitacion {
  cap_id: number;
  driver_id: string;
  modulo_id: number;
  modulo_codigo: string;
  modulo_nombre: string;
  fecha_completado: string;
  vence_at: string | null;
  notas: string | null;
  doc_id: number | null;
  created_by: number | null;
  created_at: string;
  validated_by_user_id: number | null;
  validated_at: string | null;
  validated_by_name: string | null;
}

export type DriverDocTipo = 'licencia' | 'antecedentes' | 'contrato' | 'poliza' | 'certificacion' | 'otro';

export type DocEntityType = 'driver' | 'vehicle' | 'empresa';

export interface DocumentType {
  doc_type_id: number;
  entity_type: DocEntityType;
  codigo: string;
  nombre: string;
  mandatory: boolean;
  validez_meses: number | null;
  active: boolean;
}

export interface EntityDocument {
  doc_id: number;
  entity_id: number;
  tipo: string;
  filename: string;
  file_size: number;
  content_type: string | null;
  uploaded_at: string;
  uploaded_by_user_id: number | null;
  expires_at: string | null;
  notes: string | null;
}

export interface DriverDocument {
  doc_id: number;
  driver_id: string;
  tipo: DriverDocTipo;
  filename: string;
  file_size: number;
  content_type: string | null;
  uploaded_at: string;
  uploaded_by_user_id: number | null;
  expires_at: string | null;
  notes: string | null;
}

export interface DotacionConflict {
  empresa_id: number;
  empresa_nombre: string | null;
  driver_id: string | null;
  driver_name: string | null;
  vehicle_id: number | null;
  plate: string | null;
  estado: string;
  motivo: string | null;
  visitas_afectadas: number;
  ruta_id: string | null;
}

export interface DotacionDiariaRow {
  fecha: string;
  empresa_id: number;
  empresa_nombre: string | null;
  driver_id: string | null;
  driver_name: string | null;
  driver_active: boolean;
  default_vehicle_id: number | null;
  vehicle_id: number | null;
  vehicle_name: string | null;
  plate: string | null;
  vehicle_active: boolean;
  estado: DotacionEstado;
  motivo: string | null;
  updated_at: string | null;
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
  phone?: string | null;
  name?: string | null;
  kind?: string | null;
  source?: string | null;
  contact_id?: number | null;
  empresa_nombre?: string | null;
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
  motivo?: string;
  comentario?: string;
  severity?: MotivoSeverity;
  reported_by?: string;
  // motivo_correction_suggested / motivo_correction_decided
  correction_id?: number;
  comment_id?: number;
  motivo_reportado?: string;
  motivo_sugerido?: string;
  motivo_aplicado?: string;
  confianza?: string;
  razonamiento?: string;
  decision?: string;
  decided_by?: string;
}
