/**
 * CR-013 — Tests del agregado `lastDriverAckByVid` y `urgencyScore` con
 * la categoría SIN_RESPUESTA (score 2000).
 *
 * Lógica extraída a `lib/operacionUrgency.ts` para testear sin renderizar
 * el componente (deck.gl + react-map-gl no funcionan en jsdom).
 */
import { describe, it, expect } from 'vitest';
import {
  computeUrgencyAggregates,
  urgencyScore,
  isSinRespuesta,
} from '../src/lib/operacionUrgency';
import type { Empresa, Visita, Ruta, AlertEvent } from '../src/types/operacion';
import { SIN_RESPUESTA_THRESHOLD_MIN } from '../src/types/operacion';

const NOW_MS = Date.parse('2026-05-14T12:00:00Z');

function mkAlert(opts: {
  minutesAgo: number;
  target?: AlertEvent['target'];
  acked?: boolean;
}): AlertEvent {
  const sent = new Date(NOW_MS - opts.minutesAgo * 60 * 1000).toISOString();
  return {
    timestamp: sent,
    type: 'driver_sin_respuesta',
    channel: 'whatsapp',
    target: opts.target ?? 'driver',
    acknowledged_at: opts.acked ? new Date(NOW_MS - 60 * 1000).toISOString() : null,
  };
}

function mkVisita(overrides: Partial<Visita> = {}): Visita {
  return {
    tracking_id: 'T1',
    order: 1,
    title: 'Visita',
    cliente_nombre: 'Cliente',
    address: 'Av Falsa 123',
    comuna: 'Santiago',
    region: 'RM',
    latitude: -33.4,
    longitude: -70.6,
    lat: -33.4,
    lon: -70.6,
    window_start: '09:00',
    window_end: '17:00',
    planned_arrival_time: '10:00',
    estimated_time_arrival: '10:05',
    current_eta_cl: '2026-05-14T13:00:00Z',
    slack_min: 30,
    alert_slack: 'GREEN',
    p_fallo: 0.1,
    status: 'pending',
    priority: 'normal',
    priority_reason: null,
    is_vip: false,
    vip_tier: null,
    vip_deadline_time: null,
    alert_valuedata: false,
    folio: null,
    motivo_reportado: null,
    severity: null,
    alert_history: [],
    ...overrides,
  };
}

function mkRuta(vehicle_id: number, visitas: Visita[]): Ruta {
  return {
    ruta_id: `R${vehicle_id}`,
    vehicle_id,
    vehicle_name: `V${vehicle_id}`,
    plate: 'AB-1234',
    patente: 'AB-1234',
    driver_name: `Driver ${vehicle_id}`,
    dotacion_estado: null,
    dotacion_motivo: null,
    operable: true,
    region: 'RM',
    ct: null,
    next_stop_order: 1,
    orden_actual: 1,
    total_visitas: visitas.length,
    completadas: 0,
    pendientes: visitas.length,
    fallidas: 0,
    en_riesgo: 0,
    progreso_pct: 0,
    red_visitas: 0,
    vip_visitas: 0,
    high_priority: 0,
    visitas,
    driver_phone: '+56999999999',
    driver_phone_is_mock: false,
  };
}

function mkEmpresa(rutas: Ruta[]): Empresa {
  return {
    empresa_id: 1,
    empresa_nombre: 'Empresa Test',
    total_visitas: rutas.reduce((s, r) => s + r.total_visitas, 0),
    completadas: 0,
    pendientes: 0,
    fallidas: 0,
    en_riesgo: 0,
    red_visitas: 0,
    vip_visitas: 0,
    high_priority: 0,
    rutas,
    supervisor_phone: '+56988888888',
    supervisor_phone_is_mock: false,
  };
}

describe('computeUrgencyAggregates → lastDriverAckByVid', () => {
  it('reconoce alerta target=driver sin ack hace 15 min como SIN_RESPUESTA', () => {
    const empresas = [
      mkEmpresa([
        mkRuta(10, [
          mkVisita({
            alert_history: [mkAlert({ minutesAgo: 15, target: 'driver', acked: false })],
          }),
        ]),
      ]),
    ];
    const agg = computeUrgencyAggregates(empresas);
    expect(agg.lastDriverAckByVid[10]).not.toBeNull();
    expect(isSinRespuesta(10, agg, NOW_MS)).toBe(true);
    expect(urgencyScore(10, 'en_ruta', agg, NOW_MS)).toBe(2000);
  });

  it('ignora alertas con acknowledged_at presente (driver respondió)', () => {
    const empresas = [
      mkEmpresa([
        mkRuta(20, [
          mkVisita({
            alert_history: [mkAlert({ minutesAgo: 15, target: 'driver', acked: true })],
          }),
        ]),
      ]),
    ];
    const agg = computeUrgencyAggregates(empresas);
    expect(agg.lastDriverAckByVid[20]).toBeNull();
    expect(isSinRespuesta(20, agg, NOW_MS)).toBe(false);
    expect(urgencyScore(20, 'en_ruta', agg, NOW_MS)).not.toBe(2000);
  });

  it('ignora alertas target=cliente o target=supervisor (no son al driver)', () => {
    const empresas = [
      mkEmpresa([
        mkRuta(30, [
          mkVisita({
            alert_history: [
              mkAlert({ minutesAgo: 15, target: 'cliente', acked: false }),
              mkAlert({ minutesAgo: 15, target: 'supervisor', acked: false }),
            ],
          }),
        ]),
      ]),
    ];
    const agg = computeUrgencyAggregates(empresas);
    expect(agg.lastDriverAckByVid[30]).toBeNull();
    expect(isSinRespuesta(30, agg, NOW_MS)).toBe(false);
  });

  it('alerta dentro del umbral (5 min < 10 min) NO califica como SIN_RESPUESTA', () => {
    const empresas = [
      mkEmpresa([
        mkRuta(40, [
          mkVisita({
            alert_history: [mkAlert({ minutesAgo: 5, target: 'driver', acked: false })],
          }),
        ]),
      ]),
    ];
    const agg = computeUrgencyAggregates(empresas);
    // El timestamp se guarda, pero no supera el umbral.
    expect(agg.lastDriverAckByVid[40]).not.toBeNull();
    expect(isSinRespuesta(40, agg, NOW_MS)).toBe(false);
  });

  it('SIN_RESPUESTA gana sobre VIP+RED (2000 > 1000)', () => {
    const empresas = [
      mkEmpresa([
        mkRuta(50, [
          mkVisita({
            is_vip: true,
            vip_tier: 'platinum',
            alert_slack: 'RED',
            alert_history: [mkAlert({ minutesAgo: 15, target: 'driver', acked: false })],
          }),
        ]),
      ]),
    ];
    const agg = computeUrgencyAggregates(empresas);
    expect(agg.vipRiskByVid[50]).toBe(1);
    expect(urgencyScore(50, 'en_ruta', agg, NOW_MS)).toBe(2000);
  });

  it('umbral exacto = SIN_RESPUESTA_THRESHOLD_MIN no califica (regla > estricta)', () => {
    const empresas = [
      mkEmpresa([
        mkRuta(60, [
          mkVisita({
            alert_history: [
              mkAlert({ minutesAgo: SIN_RESPUESTA_THRESHOLD_MIN, target: 'driver', acked: false }),
            ],
          }),
        ]),
      ]),
    ];
    const agg = computeUrgencyAggregates(empresas);
    // exactamente 10 min no es > 10 min
    expect(isSinRespuesta(60, agg, NOW_MS)).toBe(false);
  });
});
