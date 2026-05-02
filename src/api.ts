import {
  AvailableDates,
  BulkCSVResult,
  Contacto,
  ContactoCreate,
  ContactoUpdate,
  EmpresaSummary,
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
  return t ? { Authorization: `Bearer ${t}` } : {};
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
  if (res.status === 401) {
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

  // Maestros
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
  }) => {
    const p: string[] = [];
    if (params?.empresa_id != null) p.push(`empresa_id=${params.empresa_id}`);
    if (params?.region && params.region !== 'all') p.push(`region=${params.region}`);
    if (params?.only_vip) p.push('only_vip=true');
    if (params?.legacy) p.push('legacy=true');
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

  // Preferences
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
    log: (opts?: { limit?: number; triggered_by?: string; status?: string }) => {
      const limit = opts?.limit ?? 50;
      const parts = [`limit=${limit}`];
      if (opts?.triggered_by) parts.push(`triggered_by=${encodeURIComponent(opts.triggered_by)}`);
      if (opts?.status) parts.push(`status=${encodeURIComponent(opts.status)}`);
      return get<NotificationLogRow[]>(`/notifications/log?${parts.join('&')}`);
    },
    byTrackings: (ids: string[]) => {
      if (!ids.length) return Promise.resolve({} as Record<string, TrackingNotifSummary>);
      return get<Record<string, TrackingNotifSummary>>(`/notifications/by-trackings?ids=${encodeURIComponent(ids.join(','))}`);
    },
  },

  // VIP
  vip: {
    list: (opts?: { q?: string }) => {
      const q = opts?.q ? `?q=${encodeURIComponent(opts.q)}` : '';
      return get<VipClient[]>(`/vip-clients${q}`);
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
    createEmpresa: (req: { empresa_id: number; nombre: string; activo?: boolean }) =>
      post<AdminEmpresa>('/admin/empresas', req),
    updateEmpresa: (id: number, req: { nombre?: string; activo?: boolean }) =>
      put<AdminEmpresa>(`/admin/empresas/${id}`, req),
    deleteEmpresa: (id: number) => del<{ deleted: number }>(`/admin/empresas/${id}`),

    // Users
    listUsers: () => get<AdminUser[]>('/admin/users'),
    createUser: (req: {
      email: string; password: string; display_name: string; role: string;
      empresa_id?: number | null; activo?: boolean; phone_e164?: string;
      notify_whatsapp?: boolean;
    }) => post<AdminUser>('/admin/users', req),
    updateUser: (id: number, req: Partial<{
      email: string; display_name: string; role: string; empresa_id: number | null;
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
    importMock: () =>
      post<{ ok: boolean; count: number; fecha: string }>('/planificacion/import-mock', {}),
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
