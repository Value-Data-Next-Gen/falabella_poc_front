import {
  AnticipatedAlert,
  AppState,
  AuthUser,
  ClientMaster,
  Driver,
  Empresa,
  EmpresaPerf,
  FeatureImportance,
  FpocVisitsPage,
  KPIs,
  LocalidadPerf,
  LoginResponse,
  ModelMetrics,
  MotivoItem,
  NotificationLogRow,
  NotificationsConfig,
  PlanDiarioResponse,
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
  Visit,
  VisitExplanation,
  WhatsAppResponse,
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

export const api = {
  // Auth
  login: (email: string, password: string) =>
    post<LoginResponse>('/auth/login', { email, password }),
  authMe: () => get<AuthUser>('/auth/me'),
  empresas: () => get<Empresa[]>('/empresas'),

  // Datos
  state: () => get<AppState>('/state'),
  kpis: (vehicleIds?: number[]) => {
    const q = vehicleIds && vehicleIds.length
      ? '?' + vehicleIds.map(v => `vehicle_id=${v}`).join('&')
      : '';
    return get<KPIs>(`/kpis${q}`);
  },
  visits: (params?: { vehicle_ids?: number[]; status?: string; only_alerts?: boolean }) => {
    const parts: string[] = [];
    if (params?.vehicle_ids?.length) {
      params.vehicle_ids.forEach(v => parts.push(`vehicle_id=${v}`));
    }
    if (params?.status) parts.push(`status=${params.status}`);
    if (params?.only_alerts) parts.push('only_alerts=true');
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
  postReset: () => post<{ status: string; day_seed: number; sim_clock: string }>('/control/reset', {}),
  postClock: (body: { sim_clock?: string; offset_minutes?: number; auto_advance?: boolean }) =>
    post<{ status: string; sim_clock: string; auto_advance: boolean }>('/control/clock', body),

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
  planDiario: (empresaId?: number) =>
    get<PlanDiarioResponse>(`/plan-diario${empresaId != null ? `?empresa_id=${empresaId}` : ''}`),

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
    log: (limit = 50) => get<NotificationLogRow[]>(`/notifications/log?limit=${limit}`),
  },

  // VIP
  vip: {
    list: () => get<VipClient[]>('/vip-clients'),
    create: (req: { match_type: string; match_value: string; empresa_id?: number | null; tier?: string; notes?: string }) =>
      post<VipClient>('/vip-clients', req),
    remove: (vip_id: number) => {
      const t = getToken();
      return fetch(`${BASE}/vip-clients/${vip_id}`, {
        method: 'DELETE',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      }).then(r => {
        if (!r.ok) throw new Error(`DELETE -> ${r.status}`);
        return r.json();
      });
    },
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
