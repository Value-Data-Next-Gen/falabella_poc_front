import {
  AvailableDates,
  BulkCSVResult,
  Contacto,
  CapacitacionModulo,
  ContactoCreate,
  ContactoUpdate,
  DocEntityType,
  DocumentType,
  DotacionConflict,
  DotacionDiariaRow,
  DotacionEstado,
  DriverCapacitacion,
  DriverDocument,
  EmpresaSummary,
  EntityDocument,
  TestBroadcastResult,
  AccessLogRow,
  AccessSummary,
  AdminClient,
  AdminClientsPage,
  AdminDriver,
  AdminEmpresa,
  AdminUser,
  AdminVehicle,
  AnticipatedAlert,
  AppState,
  AuthUser,
  ClassifyResponse,
  ClientMaster,
  CommentSimStats,
  Driver,
  Empresa,
  EmpresaPerf,
  FeatureImportance,
  FpocVisitsPage,
  KPIs,
  LiveGenStats,
  LocalidadPerf,
  LoginResponse,
  ModelMetrics,
  Motivo,
  MotivoAlertConfig,
  MotivoItem,
  MotivoSeverity,
  SystemPromptResponse,
  NotificationLogRow,
  NotificationsConfig,
  VisitComment,
  TrackingNotifSummary,
  PlanDiarioResponse,
  WatchlistResponse,
  Priority,
  PriorityOverride,
  RutaAnomalaBreakdown,
  SeguimientoKPIs,
  SlaBin,
  StreamEvent,
  UserPreferences,
  VehicleExtended,
  VehicleSummary,
  VipClient,
  VipParseNotesResponse,
  Visit,
  VisitExplanation,
  WhatsAppResponse,
  MotivoCorrection,
  CorrectionStatus,
  DriverScorecardRow,
  DriverWhatsAppOut,
  DriverWhatsAppUpdate,
  SearchResults,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
const TOKEN_KEY = 'fpoc.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const t = getToken();
  // 'ngrok-skip-browser-warning' bypassea la página interstitial de ngrok-free
  // cuando el backend está expuesto via ngrok. No afecta dominios sin ngrok.
  const base: HeadersInit = { 'ngrok-skip-browser-warning': '1' };
  return t ? { ...base, Authorization: `Bearer ${t}` } : base;
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  if (res.status === 401) {
    setToken(null);
    throw new AuthError(401, 'sesión expirada');
  }
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  // /auth/login returns 401 for bad credentials — surface the server's
  // detail ("Credenciales inválidas") instead of the generic session-expired path.
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    throw new AuthError(401, 'sesión expirada');
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      if (j?.detail) detail = j.detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status === 401) { setToken(null); throw new AuthError(401, 'sesión expirada'); }
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); if (j?.detail) detail = j.detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  if (res.status === 401) { setToken(null); throw new AuthError(401, 'sesión expirada'); }
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); if (j?.detail) detail = j.detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),
  authMe: () => get<AuthUser>('/auth/me'),
  empresas: () => get<Empresa[]>('/empresas'),
  accessLog: (opts?: { limit?: number; event_type?: string }) => {
    const p: string[] = [];
    if (opts?.limit != null) p.push(`limit=${opts.limit}`);
    if (opts?.event_type) p.push(`event_type=${opts.event_type}`);
    const q = p.length ? '?' + p.join('&') : '';
    return get<AccessLogRow[]>(`/auth/access-log${q}`);
  },
  accessSummary: () => get<AccessSummary>('/auth/access-summary'),

  // Datos
  state: () => get<AppState>('/state'),
  kpis: (vehicleIds?: number[]) => {
    const q = vehicleIds && vehicleIds.length
      ? '?' + vehicleIds.map(v => `vehicle_id=${v}`).join('&')
      : '';
    return get<KPIs>(`/kpis${q}`);
  },
  visits: (params?: {
    vehicle_ids?: number[]; status?: string; only_alerts?: boolean;
    region?: string; only_vip?: boolean;
  }) => {
    const parts: string[] = [];
    if (params?.vehicle_ids?.length) {
      params.vehicle_ids.forEach(v => parts.push(`vehicle_id=${v}`));
    }
    if (params?.status) parts.push(`status=${params.status}`);
    if (params?.only_alerts) parts.push('only_alerts=true');
    if (params?.region && params.region !== 'all') parts.push(`region=${params.region}`);
    if (params?.only_vip) parts.push('only_vip=true');
    const q = parts.length ? '?' + parts.join('&') : '';
    return get<Visit[]>(`/visits${q}`);
  },
  alerts: (limit = 20) => get<AnticipatedAlert[]>(`/alerts/anticipated?limit=${limit}`),
  explanation: (trackingId: string) => get<VisitExplanation>(`/visits/${trackingId}/explanation`),
  vehicles: () => get<VehicleSummary[]>('/vehicles'),
  modelMetrics: () => get<ModelMetrics>('/model/metrics'),
  modelImportance: (topK = 15) => get<FeatureImportance[]>(`/model/importance?top_k=${topK}`),
  postIncident: (vehicle_id: number, extra_min: number) =>
    post<{ status: string; incidents: Record<string, number> }>('/control/incident', { vehicle_id, extra_min }),
  postReset: (opts?: { start_date?: string; day_seed?: number; sim_minutes_per_tick?: number }) =>
    post<{ status: string; today: string; day_seed: number; sim_clock: string; sim_minutes_per_tick: number }>(
      '/control/reset', opts ?? {},
    ),
  postClock: (body: { sim_clock?: string; offset_minutes?: number; auto_advance?: boolean }) =>
    post<{ status: string; sim_clock: string; auto_advance: boolean }>('/control/clock', body),
  postFreeze: () =>
    post<{ status: string; sim_clock: string; auto_advance: boolean }>('/control/freeze', {}),
  postStartDay: (opts?: { regen_plan?: boolean; day_seed?: number }) =>
    post<{ status: string; today: string; day_seed: number; sim_clock: string; auto_advance: boolean }>(
      '/control/start-day', opts ?? {}),

  // Onboarding
  drivers: () => get<Driver[]>('/drivers'),
  fleetVehicles: () => get<VehicleExtended[]>('/fleet/vehicles'),
  clients: (opts?: { limit?: number; offset?: number; only_problem_zone?: boolean; min_fail_rate?: number; search?: string }) => {
    const parts: string[] = [];
    if (opts?.limit) parts.push(`limit=${opts.limit}`);
    if (opts?.offset) parts.push(`offset=${opts.offset}`);
    if (opts?.only_problem_zone) parts.push('only_problem_zone=true');
    if (opts?.min_fail_rate) parts.push(`min_fail_rate=${opts.min_fail_rate}`);
    if (opts?.search) parts.push(`search=${encodeURIComponent(opts.search)}`);
    const q = parts.length ? '?' + parts.join('&') : '';
    return get<ClientMaster[]>(`/clients${q}`);
  },

  // Stream de eventos
  events: (limit = 50, types?: string[]) => {
    const parts = [`limit=${limit}`];
    if (types?.length) types.forEach(t => parts.push(`types=${t}`));
    return get<StreamEvent[]>(`/events/stream?${parts.join('&')}`);
  },

  // Plan diario
  planDiario: (params?: {
    empresa_id?: number; region?: string;
    only_vip?: boolean; legacy?: boolean;
    planned_date?: string;
    source?: 'real' | 'synthetic';
  }) => {
    const p: string[] = [];
    if (params?.empresa_id != null) p.push(`empresa_id=${params.empresa_id}`);
    if (params?.region && params.region !== 'all') p.push(`region=${params.region}`);
    if (params?.only_vip) p.push('only_vip=true');
    if (params?.legacy) p.push('legacy=true');
    if (params?.planned_date) p.push(`planned_date=${params.planned_date}`);
    if (params?.source) p.push(`source=${params.source}`);
    const q = p.length ? '?' + p.join('&') : '';
    return get<PlanDiarioResponse>(`/plan-diario${q}`);
  },

  // Watchlist
  watchlist: (params?: {
    empresa_id?: number; region?: string; only_vip?: boolean;
  }) => {
    const p: string[] = [];
    if (params?.empresa_id != null) p.push(`empresa_id=${params.empresa_id}`);
    if (params?.region && params.region !== 'all') p.push(`region=${params.region}`);
    if (params?.only_vip) p.push('only_vip=true');
    const q = p.length ? '?' + p.join('&') : '';
    return get<WatchlistResponse>(`/watchlist${q}`);
  },

  // Live generator
  liveGen: {
    stats: () => get<LiveGenStats>('/live-gen/stats'),
    toggle: (enabled: boolean) => post<LiveGenStats>('/live-gen/toggle', { enabled }),
    reset: () => post<{ deleted: number }>('/live-gen/reset', {}),
    batch: (rows: number, date?: string) =>
      post<{ date: string; inserted: number; elapsed_sec: number }>(
        '/live-gen/batch', { rows, date },
      ),
    simulateDays: (days: number, rows_per_day: number, include_today = true) =>
      post<{ total_inserted: number; per_day: Record<string, number>; elapsed_sec: number }>(
        '/live-gen/simulate-days', { days, rows_per_day, include_today },
      ),
  },

  // Preferences + driver-scoped endpoints (rol driver)
  me: {
    prefs: () => get<UserPreferences>('/me/preferences'),
    updatePrefs: (req: Partial<UserPreferences>) => {
      // PUT manual porque es distinto del post()
      const t = getToken();
      return fetch(`${BASE}/me/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify(req),
      }).then(async r => {
        if (!r.ok) throw new Error(`PUT /me/preferences -> ${r.status}`);
        return r.json() as Promise<UserPreferences>;
      });
    },
    // Driver dashboard
    profile: () => get<{
      user_id: number; driver_id: string; name: string; email: string;
      phone: string | null; license: string | null;
      empresa_id: number | null; empresa_nombre: string | null;
      vehicle_id: number | null; vehicle_name: string | null; plate: string | null;
      active: boolean;
    }>('/me/profile'),
    orders: (fecha?: string) => get<Array<{
      tracking_id: string; order: number; title: string; address: string;
      comuna: string | null; region: string; status: string;
      current_eta_cl: string; current_eta_hhmm: string; sla_hour: number;
      ruta_id: string | null; reference: number | null;
    }>>(`/me/orders${fecha ? `?fecha=${fecha}` : ''}`),
    documents: () => get<Array<{
      doc_id: number; tipo: string; filename: string; file_size: number;
      uploaded_at: string; expires_at: string | null; notes: string | null;
    }>>('/me/documents'),
    capacitaciones: () => get<Array<{
      cap_id: number; modulo_codigo: string; modulo_nombre: string;
      fecha_completado: string; vence_at: string | null; notas: string | null;
    }>>('/me/capacitaciones'),
  },

  // Notifications
  notif: {
    config: () => get<NotificationsConfig>('/notifications/config'),
    test: () => post<WhatsAppResponse>('/notifications/test', {}),
    send: (req: {
      body: string;
      to_user_ids?: number[];
      to_numbers?: string[];
      tracking_id?: string;
      subject?: string;
      triggered_by?: string;
    }) => post<WhatsAppResponse>('/notifications/whatsapp', req),
    log: (opts?: { limit?: number; triggered_by?: string; status?: string; direction?: 'inbound' | 'outbound' }) => {
      const limit = opts?.limit ?? 50;
      const parts = [`limit=${limit}`];
      if (opts?.triggered_by) parts.push(`triggered_by=${encodeURIComponent(opts.triggered_by)}`);
      if (opts?.status) parts.push(`status=${encodeURIComponent(opts.status)}`);
      if (opts?.direction) parts.push(`direction=${opts.direction}`);
      return get<NotificationLogRow[]>(`/notifications/log?${parts.join('&')}`);
    },
    byTrackings: (ids: string[]) => {
      if (!ids.length) return Promise.resolve({} as Record<string, TrackingNotifSummary>);
      return get<Record<string, TrackingNotifSummary>>(`/notifications/by-trackings?ids=${encodeURIComponent(ids.join(','))}`);
    },
  },

  // VIP
  vip: {
    list: (opts?: {
      q?: string;
      solo_del_dia?: boolean;
      empresa_id?: number | null;  // -1 = solo globales (NULL)
      tier?: string;
      active?: boolean;
    }) => {
      const p: string[] = [];
      if (opts?.q) p.push(`q=${encodeURIComponent(opts.q)}`);
      if (opts?.solo_del_dia) p.push('solo_del_dia=true');
      if (opts?.empresa_id != null) p.push(`empresa_id=${opts.empresa_id}`);
      if (opts?.tier) p.push(`tier=${encodeURIComponent(opts.tier)}`);
      if (opts?.active != null) p.push(`active=${opts.active}`);
      const qs = p.length ? `?${p.join('&')}` : '';
      return get<VipClient[]>(`/vip-clients${qs}`);
    },
    create: (req: {
      match_type: string; match_value: string; empresa_id?: number | null;
      tier?: string; notes?: string;
      deadline_time?: string | null; alert_minutes_before?: number | null;
      parse_notes?: boolean;
    }) => post<VipClient>('/vip-clients', req),
    update: (vip_id: number, req: {
      tier?: string; notes?: string | null;
      deadline_time?: string | null; alert_minutes_before?: number | null;
      active?: boolean; parse_notes?: boolean;
    }) => put<VipClient>(`/vip-clients/${vip_id}`, req),
    remove: (vip_id: number) => del<{ deleted: number }>(`/vip-clients/${vip_id}`),
    parseNotes: (notes: string) =>
      post<VipParseNotesResponse>('/vip-clients/parse-notes', { notes }),
  },

  // Priorities
  priorities: {
    list: (priority?: Priority) =>
      get<PriorityOverride[]>(`/priorities${priority ? `?priority=${priority}` : ''}`),
    set: (tracking_id: string, priority: Priority, reason?: string) => {
      const t = getToken();
      return fetch(`${BASE}/priorities/${tracking_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ priority, reason }),
      }).then(async r => {
        if (!r.ok) throw new Error(`PUT priority -> ${r.status}`);
        return r.json() as Promise<PriorityOverride>;
      });
    },
    clear: (tracking_id: string) => {
      const t = getToken();
      return fetch(`${BASE}/priorities/${tracking_id}`, {
        method: 'DELETE',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      }).then(r => r.json());
    },
  },

  // ---- Mantenedores admin (CRUD) ----
  admin: {
    // Empresas
    listEmpresas: () => get<AdminEmpresa[]>('/admin/empresas'),
    createEmpresa: (req: { empresa_id: number; nombre: string; activo?: boolean; central_phone?: string | null }) =>
      post<AdminEmpresa>('/admin/empresas', req),
    updateEmpresa: (id: number, req: { nombre?: string; activo?: boolean; central_phone?: string | null }) =>
      put<AdminEmpresa>(`/admin/empresas/${id}`, req),
    deleteEmpresa: (id: number) => del<{ deleted: number }>(`/admin/empresas/${id}`),

    // Users
    listUsers: () => get<AdminUser[]>('/admin/users'),
    createUser: (req: {
      email: string; password: string; display_name: string; role: string;
      empresa_id?: number | null; driver_id?: string | null;
      activo?: boolean; phone_e164?: string | null;
      notify_whatsapp?: boolean; empresa_nombre?: string | null;
    }) => post<AdminUser>('/admin/users', req),
    updateUser: (id: number, req: Partial<{
      email: string; display_name: string; role: string;
      empresa_id: number | null; driver_id: string | null;
      activo: boolean; phone_e164: string; notify_whatsapp: boolean;
    }>) => put<AdminUser>(`/admin/users/${id}`, req),
    resetPassword: (id: number, new_password: string) =>
      post<{ reset: number }>(`/admin/users/${id}/reset-password`, { new_password }),
    deleteUser: (id: number) => del<{ deleted: number }>(`/admin/users/${id}`),

    // Drivers
    listDrivers: () => get<AdminDriver[]>('/admin/drivers'),
    createDriver: (req: AdminDriver) => post<AdminDriver>('/admin/drivers', req),
    updateDriver: (id: string, req: Partial<AdminDriver>) =>
      put<AdminDriver>(`/admin/drivers/${id}`, req),
    deleteDriver: (id: string) => del<{ deleted: string }>(`/admin/drivers/${id}`),

    // Vehicles
    listVehicles: () => get<AdminVehicle[]>('/admin/vehicles'),
    createVehicle: (req: AdminVehicle) => post<AdminVehicle>('/admin/vehicles', req),
    updateVehicle: (id: number, req: Partial<AdminVehicle>) =>
      put<AdminVehicle>(`/admin/vehicles/${id}`, req),
    deleteVehicle: (id: number) => del<{ deleted: number }>(`/admin/vehicles/${id}`),

    // WhatsApp invite
    whatsappInvite: (req: {
      phone_e164: string;
      name?: string;
      role_hint?: 'driver' | 'manager' | 'contacto';
      driver_id?: string;
      user_id?: number;
      contact_id?: number;
      custom_message?: string;
    }) => post<{
      ok: boolean;
      status: string;
      twilio_sid: string | null;
      error: string | null;
      sandbox_warning: string | null;
      target_phone: string;
      body_preview: string;
    }>('/admin/whatsapp/invite', req),

    whatsappSandboxInfo: () => get<{
      sandbox_number: string;
      join_code: string | null;
      instructions: string;
      public_webhook_url: string | null;
    }>('/whatsapp/onboard/sandbox-info'),

    // Capacitaciones — catálogo
    listCapacitacionModulos: (only_active = false) =>
      get<CapacitacionModulo[]>(`/admin/capacitacion-modulos${only_active ? '?only_active=true' : ''}`),
    createCapacitacionModulo: (req: Omit<CapacitacionModulo, 'modulo_id'>) =>
      post<CapacitacionModulo>('/admin/capacitacion-modulos', req),
    updateCapacitacionModulo: (id: number, req: Partial<CapacitacionModulo>) =>
      put<CapacitacionModulo>(`/admin/capacitacion-modulos/${id}`, req),
    deleteCapacitacionModulo: (id: number) =>
      del<{ deleted: number }>(`/admin/capacitacion-modulos/${id}`),

    // Capacitaciones — registros del driver
    listDriverCapacitaciones: (driver_id: string) =>
      get<DriverCapacitacion[]>(`/admin/drivers/${encodeURIComponent(driver_id)}/capacitaciones`),
    createDriverCapacitacion: (driver_id: string, req: {
      modulo_id: number;
      fecha_completado: string;       // YYYY-MM-DD
      vence_at?: string | null;
      notas?: string | null;
      doc_id?: number | null;
    }) => post<DriverCapacitacion>(`/admin/drivers/${encodeURIComponent(driver_id)}/capacitaciones`, req),
    updateDriverCapacitacion: (driver_id: string, cap_id: number, req: {
      fecha_completado?: string;
      vence_at?: string | null;
      notas?: string | null;
    }) => put<DriverCapacitacion>(`/admin/drivers/${encodeURIComponent(driver_id)}/capacitaciones/${cap_id}`, req),
    deleteDriverCapacitacion: (driver_id: string, cap_id: number) =>
      del<{ deleted: number }>(`/admin/drivers/${encodeURIComponent(driver_id)}/capacitaciones/${cap_id}`),
    validateDriverCapacitacion: (driver_id: string, cap_id: number) =>
      post<DriverCapacitacion>(`/admin/drivers/${encodeURIComponent(driver_id)}/capacitaciones/${cap_id}/validate`, {}),
    unvalidateDriverCapacitacion: (driver_id: string, cap_id: number) =>
      post<DriverCapacitacion>(`/admin/drivers/${encodeURIComponent(driver_id)}/capacitaciones/${cap_id}/unvalidate`, {}),

    // Document types — catálogo configurable
    listDocTypes: (opts?: { entity_type?: DocEntityType; only_active?: boolean }) => {
      const p: string[] = [];
      if (opts?.entity_type) p.push(`entity_type=${opts.entity_type}`);
      if (opts?.only_active) p.push('only_active=true');
      return get<DocumentType[]>(`/admin/document-types${p.length ? '?' + p.join('&') : ''}`);
    },
    createDocType: (req: Omit<DocumentType, 'doc_type_id'>) =>
      post<DocumentType>('/admin/document-types', req),
    updateDocType: (id: number, req: Partial<DocumentType>) =>
      put<DocumentType>(`/admin/document-types/${id}`, req),
    deleteDocType: (id: number) =>
      del<{ deleted: number }>(`/admin/document-types/${id}`),

    // Empresa documents
    listEmpresaDocs: (empresa_id: number) =>
      get<EntityDocument[]>(`/admin/empresas/${empresa_id}/documents`),
    deleteEmpresaDoc: (empresa_id: number, doc_id: number) =>
      del<{ deleted: number }>(`/admin/empresas/${empresa_id}/documents/${doc_id}`),

    // Vehicle documents
    listVehicleDocs: (vehicle_id: number) =>
      get<EntityDocument[]>(`/admin/vehicles/${vehicle_id}/documents`),
    deleteVehicleDoc: (vehicle_id: number, doc_id: number) =>
      del<{ deleted: number }>(`/admin/vehicles/${vehicle_id}/documents/${doc_id}`),

    // Driver documents
    listDriverDocs: (driver_id: string) =>
      get<DriverDocument[]>(`/admin/drivers/${encodeURIComponent(driver_id)}/documents`),
    deleteDriverDoc: (driver_id: string, doc_id: number) =>
      del<{ deleted: number }>(`/admin/drivers/${encodeURIComponent(driver_id)}/documents/${doc_id}`),
    // upload + download usan paths absolutos: el componente arma el FormData y
    // hace fetch directo (mismo patrón que BulkXlsxButtons) para tener control
    // sobre Content-Type y multipart.

    // Dotación diaria — pool fijo + override por día (estado/motivo)
    listDotacion: (opts: { fecha: string; empresa_id?: number }) => {
      const p = [`fecha=${encodeURIComponent(opts.fecha)}`];
      if (opts.empresa_id != null) p.push(`empresa_id=${opts.empresa_id}`);
      return get<DotacionDiariaRow[]>(`/admin/dotacion-diaria?${p.join('&')}`);
    },
    upsertDotacion: (req: {
      fecha: string;
      empresa_id: number;
      driver_id?: string | null;
      vehicle_id?: number | null;
      estado: DotacionEstado;
      motivo?: string | null;
    }) => put<{ status: string; dotacion_id: number }>('/admin/dotacion-diaria', req),

    // Clients
    listClients: (opts?: {
      limit?: number; offset?: number; search?: string;
      only_recurrent?: boolean; only_problem?: boolean;
    }) => {
      const p: string[] = [];
      if (opts?.limit != null) p.push(`limit=${opts.limit}`);
      if (opts?.offset != null) p.push(`offset=${opts.offset}`);
      if (opts?.search) p.push(`search=${encodeURIComponent(opts.search)}`);
      if (opts?.only_recurrent) p.push('only_recurrent=true');
      if (opts?.only_problem) p.push('only_problem=true');
      const q = p.length ? '?' + p.join('&') : '';
      return get<AdminClientsPage>(`/admin/clients${q}`);
    },
    createClient: (req: AdminClient) => post<AdminClient>('/admin/clients', req),
    updateClient: (id: string, req: Partial<AdminClient>) =>
      put<AdminClient>(`/admin/clients/${id}`, req),
    deleteClient: (id: string) => del<{ deleted: string }>(`/admin/clients/${id}`),
  },

  // Motivos + comentarios del transportista
  motivos: {
    list: () => get<Motivo[]>('/motivos'),
    alertConfig: (empresaId?: number) =>
      get<MotivoAlertConfig[]>(
        `/motivos/alert-config${empresaId != null ? `?empresa_id=${empresaId}` : ''}`,
      ),
    setAlertConfig: (
      motivo: string,
      req: {
        alertable: boolean;
        severity: MotivoSeverity;
        empresa_id?: number | null;
        description?: string | null;
        reset_description?: boolean;
      },
    ) => put<MotivoAlertConfig>(`/motivos/alert-config/${encodeURIComponent(motivo)}`, req),
    classify: (comentario: string) =>
      post<ClassifyResponse>('/motivos/classify', { comentario }),
    systemPrompt: () => get<SystemPromptResponse>('/motivos/system-prompt'),
  },

  commentSim: {
    stats: () => get<CommentSimStats>('/comment-sim/stats'),
    toggle: (enabled: boolean) =>
      post<CommentSimStats>('/comment-sim/toggle', { enabled }),
    config: (req: {
      interval_sec?: number;
      only_alertable?: boolean;
      severity_filter?: MotivoSeverity | null;
    }) => post<CommentSimStats>('/comment-sim/config', req),
    emitNow: () => post<CommentSimStats>('/comment-sim/emit-now', {}),
  },

  comments: {
    add: (tracking_id: string, req: { motivo: string; comentario: string }) =>
      post<VisitComment>(`/visits/${tracking_id}/comment`, req),
    listForVisit: (tracking_id: string) =>
      get<VisitComment[]>(`/visits/${tracking_id}/comments`),
    recent: (opts?: { limit?: number; only_alertable?: boolean }) => {
      const p: string[] = [];
      if (opts?.limit != null) p.push(`limit=${opts.limit}`);
      if (opts?.only_alertable) p.push('only_alertable=true');
      const q = p.length ? '?' + p.join('&') : '';
      return get<VisitComment[]>(`/comments/recent${q}`);
    },
  },

  // Empresa contactos (destinatarios WhatsApp)
  empresaContactos: {
    listEmpresas: () => get<EmpresaSummary[]>('/empresa-contactos/empresas'),
    listContactos: (empresaId: number) =>
      get<Contacto[]>(`/empresa-contactos/empresas/${empresaId}/contactos`),
    create: (empresaId: number, req: ContactoCreate) =>
      post<Contacto>(`/empresa-contactos/empresas/${empresaId}/contactos`, req),
    update: (empresaId: number, contactId: number, req: ContactoUpdate) =>
      put<Contacto>(`/empresa-contactos/empresas/${empresaId}/contactos/${contactId}`, req),
    remove: (empresaId: number, contactId: number) =>
      del<{ deleted: number }>(`/empresa-contactos/empresas/${empresaId}/contactos/${contactId}`),
    optIn: (empresaId: number, contactId: number) =>
      post<Contacto>(`/empresa-contactos/empresas/${empresaId}/contactos/${contactId}/opt-in`, {}),
    csvTemplateUrl: (empresaId: number) =>
      `${BASE}/empresa-contactos/empresas/${empresaId}/contactos/csv-template`,
    downloadCsvTemplate: async (empresaId: number) => {
      const t = getToken();
      const res = await fetch(
        `${BASE}/empresa-contactos/empresas/${empresaId}/contactos/csv-template`,
        { headers: t ? { Authorization: `Bearer ${t}` } : {} },
      );
      if (!res.ok) throw new Error(`csv template -> ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contactos_empresa_${empresaId}_template.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    bulkUploadCSV: async (empresaId: number, file: File): Promise<BulkCSVResult> => {
      const fd = new FormData();
      fd.append('file', file);
      const t = getToken();
      const res = await fetch(
        `${BASE}/empresa-contactos/empresas/${empresaId}/contactos/bulk-csv`,
        {
          method: 'POST',
          headers: t ? { Authorization: `Bearer ${t}` } : {},
          body: fd,
        },
      );
      if (res.status === 401) { setToken(null); throw new AuthError(401, 'sesión expirada'); }
      if (!res.ok) {
        let detail = res.statusText;
        try { const j = await res.json(); if (j?.detail) detail = j.detail; } catch {}
        throw new Error(detail);
      }
      return res.json();
    },
    testBroadcast: (empresaId: number) =>
      post<TestBroadcastResult>(`/empresa-contactos/empresas/${empresaId}/test-broadcast`, {}),
  },

  // Motivo corrections (Sprint 4.A2)
  motivoCorrections: {
    list: (opts?: { status?: CorrectionStatus | 'all'; limit?: number }) => {
      const p: string[] = [];
      if (opts?.status) p.push(`status=${opts.status}`);
      if (opts?.limit != null) p.push(`limit=${opts.limit}`);
      const q = p.length ? '?' + p.join('&') : '';
      return get<MotivoCorrection[]>(`/motivo-corrections${q}`);
    },
    accept: (id: number) =>
      post<MotivoCorrection>(`/motivo-corrections/${id}/accept`, {}),
    reject: (id: number) =>
      post<MotivoCorrection>(`/motivo-corrections/${id}/reject`, {}),
    noAction: (id: number) =>
      post<MotivoCorrection>(`/motivo-corrections/${id}/no-action`, {}),
    renotifyDriver: (id: number) =>
      post<MotivoCorrection>(`/motivo-corrections/${id}/renotify-driver`, {}),
  },

  // Driver scorecard + WhatsApp opt-in (Sprint 4.A1, A3)
  driversExt: {
    scorecard: (opts?: { period_days?: number; empresa_id?: number }) => {
      const p: string[] = [];
      if (opts?.period_days != null) p.push(`period_days=${opts.period_days}`);
      if (opts?.empresa_id != null) p.push(`empresa_id=${opts.empresa_id}`);
      const q = p.length ? '?' + p.join('&') : '';
      return get<DriverScorecardRow[]>(`/drivers/scorecard${q}`);
    },
    updateWhatsApp: (driver_id: string, req: DriverWhatsAppUpdate) =>
      put<DriverWhatsAppOut>(`/mantenedores/drivers/${driver_id}`, req),
  },

  planificacion: {
    importMock: (fecha?: string, force?: boolean) => {
      const params: string[] = [];
      if (fecha) params.push(`fecha=${fecha}`);
      if (force) params.push('force=true');
      const q = params.length ? `?${params.join('&')}` : '';
      return post<{
        ok: boolean;
        count: number;
        fecha: string;
        already_imported: boolean;
        message: string;
        conflicts: DotacionConflict[];
      }>(`/planificacion/import-mock${q}`, {});
    },
    listImports: () =>
      get<Array<{
        fecha: string;
        count: number;
        imported_at: string;
        imported_by_user_id: number | null;
      }>>('/planificacion/imports'),
    dotacionCheck: (fecha: string) =>
      get<DotacionConflict[]>(`/planificacion/dotacion-check?fecha=${fecha}`),
    startDay: (fecha: string, opts?: { reset_status?: boolean }) => {
      const p = [`fecha=${fecha}`];
      if (opts?.reset_status === false) p.push('reset_status=false');
      return post<{
        ok: boolean;
        fecha: string;
        visitas_en_db: number;
        visitas_reset: number;
        live_gen_paused: boolean;
        state_today: string | null;
        snapshot_size: number;
        conflicts: DotacionConflict[];
        message: string;
      }>(`/planificacion/start-day?${p.join('&')}`, {});
    },
    // El upload del xlsx real va via fetch directo (multipart). Solo defino
    // la URL aquí; el componente arma el FormData.
    importXlsxPath: (force?: boolean) =>
      `/planificacion/import-xlsx${force ? '?force=true' : ''}`,
    calendar: (month?: string) => get<Array<{
      fecha: string;
      visitas: number;
      is_today: boolean;
      imported_at: string | null;
      conflicts_count: number;
      failed: number;
      completed: number;
      pending: number;
    }>>(`/planificacion/calendar${month ? `?month=${month}` : ''}`),
    dayStatus: (fecha: string) => get<{
      fecha: string;
      visitas: number;
      completed: number; failed: number; pending: number;
      conflicts_count: number;
      is_state_today: boolean;
      live_gen_running: boolean;
      imported_at: string | null;
      imported_by_user_id: number | null;
      loaded: boolean;
      dotacion_checked: boolean;
      no_conflicts: boolean;
      started: boolean;
      config_issues_count: number;
      driver_issues_count: number;
      vip_count: number;
      prep_ok: boolean;
    }>(`/planificacion/day-status?fecha=${fecha}`),
    clientesDelDia: (fecha: string, opts?: { only_no_vip?: boolean; only_with_notes?: boolean }) => {
      const p = new URLSearchParams({ fecha });
      if (opts?.only_no_vip) p.set('only_no_vip', 'true');
      if (opts?.only_with_notes) p.set('only_with_notes', 'true');
      return get<Array<{
        cliente: string;
        visitas: number;
        comunas: string[];
        rutas: string[];
        is_vip: boolean;
        vip_tier: string | null;
        vip_id: number | null;
        notes: string | null;
        vip_marked_here: boolean;
        priority_set_count: number;
      }>>(`/planificacion/clientes-del-dia?${p.toString()}`);
    },
    upsertClientDayNote: (req: {
      fecha: string; cliente: string;
      notes?: string | null; vip_marked_here?: boolean;
      create_vip?: boolean; vip_tier?: string;
    }) => put<{ ok: boolean; fecha: string; cliente: string; vip_id: number | null }>(
      `/planificacion/client-day-notes`, req,
    ),
    getDayState: (fecha: string) => get<{
      fecha: string;
      state: 'BORRADOR' | 'LISTO' | 'EN_CURSO' | 'PAUSADO' | 'CERRADO';
      visitas: number;
      imported_at: string | null;
      imported_by_user_id: number | null;
      started_at: string | null;
      started_by_user_id: number | null;
      started_by_name: string | null;
      paused_at: string | null;
      closed_at: string | null;
      day_seed: number | null;
      prep_ok: boolean;
      conflicts_count: number;
      config_issues_count: number;
      driver_issues_count: number;
      can_start: boolean;
      can_pause: boolean;
      can_resume: boolean;
      can_close: boolean;
      can_validate: boolean;
      blocked_reason: string | null;
    }>(`/planificacion/day-state?fecha=${fecha}`),
    transitionDayState: (req: { fecha: string; target: 'BORRADOR'|'LISTO'|'EN_CURSO'|'PAUSADO'|'CERRADO'; confirm?: boolean; allow_non_blocking?: boolean }) =>
      post<any>(`/planificacion/day-state/transition`, req),
    getDayConfig: (fecha: string) => get<{
      fecha: string;
      cutoff_time: string | null;
      message_to_drivers: string | null;
      alert_threshold_override: number | null;
      slack_min_override: number | null;
      restricted_vehicle_ids: number[];
      restricted_empresa_ids: number[];
      updated_at: string | null;
    }>(`/planificacion/day-config?fecha=${fecha}`),
    putDayConfig: (fecha: string, body: {
      cutoff_time?: string | null;
      message_to_drivers?: string | null;
      alert_threshold_override?: number | null;
      slack_min_override?: number | null;
      restricted_vehicle_ids?: number[];
      restricted_empresa_ids?: number[];
    }) => put<{
      fecha: string;
      cutoff_time: string | null;
      message_to_drivers: string | null;
      alert_threshold_override: number | null;
      slack_min_override: number | null;
      restricted_vehicle_ids: number[];
      restricted_empresa_ids: number[];
      updated_at: string | null;
    }>(`/planificacion/day-config?fecha=${fecha}`, body),
    dayClients: (fecha: string, q?: string, limit = 50) => {
      const params = new URLSearchParams({ fecha });
      if (q && q.trim()) params.set('q', q.trim());
      params.set('limit', String(limit));
      return get<Array<{
        tracking_id: string;
        cliente: string;
        comuna: string | null;
        ruta_id: string | null;
        driver_name: string | null;
        is_vip: boolean;
      }>>(`/planificacion/day-clients?${params.toString()}`);
    },
    dayPrep: (fecha: string) => get<{
      fecha: string;
      vips: Array<{
        tracking_id: string;
        cliente: string;
        comuna: string | null;
        folio: string | null;
        deadline: string | null;
        ruta_id: string | null;
        driver_name: string | null;
        priority_set: boolean;
      }>;
      config_issues: Array<{
        tracking_id: string;
        cliente: string;
        issue_type: 'no_region' | 'no_comuna' | 'no_ruta' | 'no_ct' | 'vip_sin_prioridad';
        issue_label: string;
      }>;
      driver_issues: Array<{
        driver_id: string | null;
        driver_name: string | null;
        ruta_id: string | null;
        issue_type: 'dotacion' | 'sin_telefono' | 'sin_licencia' | 'driver_inactivo' | 'vehiculo_no_operable';
        issue_label: string;
        affects_visits: number;
      }>;
      all_ok: boolean;
    }>(`/planificacion/day-prep?fecha=${fecha}`),
  },

  // Sprint 7 — buscador global del topbar
  search: {
    global: (q: string) =>
      get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),
  },

  // Seguimiento (datos reales fpoc)
  seg: {
    availableDates: () => get<AvailableDates>('/seguimiento/available-dates'),
    kpis: (planned_date?: string) => get<SeguimientoKPIs>(`/seguimiento/kpis${planned_date ? `?planned_date=${planned_date}` : ''}`),
    slaDistribution: (planned_date?: string) => get<SlaBin[]>(`/seguimiento/sla-distribution${planned_date ? `?planned_date=${planned_date}` : ''}`),
    motivos: (limit = 10) => get<MotivoItem[]>(`/seguimiento/motivos?limit=${limit}`),
    byEmpresa: (planned_date?: string) => get<EmpresaPerf[]>(`/seguimiento/by-empresa${planned_date ? `?planned_date=${planned_date}` : ''}`),
    byLocalidad: (limit = 15) => get<LocalidadPerf[]>(`/seguimiento/by-localidad?limit=${limit}`),
    rutasAnomalas: (planned_date?: string) => get<RutaAnomalaBreakdown[]>(`/seguimiento/rutas-anomalas${planned_date ? `?planned_date=${planned_date}` : ''}`),
    visits: (opts?: {
      limit?: number; offset?: number; status?: string; ruta_anomala?: boolean;
      empresa_id?: number; localidad?: string; search?: string; planned_date?: string;
    }) => {
      const p: string[] = [];
      if (opts?.limit != null) p.push(`limit=${opts.limit}`);
      if (opts?.offset != null) p.push(`offset=${opts.offset}`);
      if (opts?.status) p.push(`status=${encodeURIComponent(opts.status)}`);
      if (opts?.ruta_anomala != null) p.push(`ruta_anomala=${opts.ruta_anomala}`);
      if (opts?.empresa_id != null) p.push(`empresa_id=${opts.empresa_id}`);
      if (opts?.localidad) p.push(`localidad=${encodeURIComponent(opts.localidad)}`);
      if (opts?.search) p.push(`search=${encodeURIComponent(opts.search)}`);
      if (opts?.planned_date) p.push(`planned_date=${opts.planned_date}`);
      const q = p.length ? '?' + p.join('&') : '';
      return get<FpocVisitsPage>(`/seguimiento/visits${q}`);
    },
  },
};
