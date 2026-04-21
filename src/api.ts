import {
  AnticipatedAlert,
  AppState,
  ClientMaster,
  Driver,
  FeatureImportance,
  KPIs,
  ModelMetrics,
  StreamEvent,
  VehicleExtended,
  VehicleSummary,
  Visit,
  VisitExplanation,
} from './types';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return res.json();
}

export const api = {
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
};
