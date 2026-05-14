/**
 * CR-012 T9 — Gantt por parada (SVG + d3-scale).
 *
 * Una fila por ruta activa. Eje X: 07:00–22:00 fijo (OPERATION_WINDOW).
 * Background bar = ventana operativa. Bar verde = avance real. Círculos =
 * visitas posicionadas por current_eta_cl. Color por alert_slack+status,
 * tamaño por p_fallo, borde violeta si VIP, naranjo si alert_valuedata.
 * Línea "now" vertical en sim_clock, actualizada cada 30s.
 *
 * Click en círculo → setSelectedVisita → abre slide-over (T8).
 *
 * NO usa D3 completo, solo `d3-scale` + `d3-time` (mínimas).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { scaleTime } from 'd3-scale';
import { api } from '../../api';
import { useOperacionStore } from '../../stores/useOperacionStore';
import { OPERATION_WINDOW } from '../../types/operacion';
import type { Visita, Ruta, Empresa } from '../../types/operacion';

interface Props {
  fecha: string | null;
  empresaId: number | null;
  /** CR-012 Fix V2: region/onlyVip propagados desde el módulo para que el
   *  queryKey de plan-diario coincida con el resto de consumidores y se
   *  dedupee (1 fetch). */
  region: string;
  onlyVip: boolean;
}

const ROW_HEIGHT = 36;
const LEFT_LABEL_W = 140;
const RIGHT_LABEL_W = 60;
const X_PADDING = 8;

/** Convierte "07:00" → Date del día base. */
function timeOf(base: string, hhmm: string): Date {
  return new Date(`${base}T${hhmm}:00`);
}

/** Parsea "YYYY-MM-DD HH:MM:SS" o ISO. Devuelve null si no parsea. */
function parseEta(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

export function GanttPorParada({ fecha, empresaId, region, onlyVip }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(800);
  const [now, setNow] = useState(() => Date.now());
  const setSelectedVisita = useOperacionStore(s => s.setSelectedVisita);
  const hoveredVisitaId = useOperacionStore(s => s.hoveredVisitaId);

  // CR-012 Fix V2: queryKey CANÓNICO. Comparte cache con el resto del módulo.
  const planQ = useQuery({
    queryKey: ['plan-diario', fecha, empresaId, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaId ?? undefined,
      region,
      only_vip: onlyVip,
      source: 'real',
      planned_date: fecha ?? undefined,
    }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    staleTime: 8_000,
    enabled: !!fecha,
  });

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect?.width ?? 800;
      setWidth(Math.max(400, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tick "now" cada 30s (brief). El reloj real viene de sim_clock, pero
  // este tick fuerza re-render para que la línea avance sin esperar el
  // próximo polling de plan-diario.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const baseDate = fecha ?? new Date().toISOString().slice(0, 10);
  const xScale = useMemo(() => scaleTime()
    .domain([timeOf(baseDate, OPERATION_WINDOW.start), timeOf(baseDate, OPERATION_WINDOW.end)])
    .range([LEFT_LABEL_W + X_PADDING, width - RIGHT_LABEL_W - X_PADDING]),
    [baseDate, width],
  );

  // Filas: una por ruta con al menos una visita pendiente.
  const rows = useMemo(() => {
    const out: { ruta: Ruta; empresa: Empresa }[] = [];
    (planQ.data?.empresas ?? []).forEach(emp => {
      (emp.rutas ?? []).forEach(r => {
        if ((r.visitas ?? []).length > 0) {
          out.push({ ruta: r as Ruta, empresa: emp as Empresa });
        }
      });
    });
    // Ordenar por urgencia: rutas con red_visitas arriba.
    return out.sort((a, b) => (b.ruta.red_visitas ?? 0) - (a.ruta.red_visitas ?? 0));
  }, [planQ.data]);

  const simClock = planQ.data?.sim_clock ? new Date(planQ.data.sim_clock) : null;
  const nowX = simClock ? xScale(simClock) : null;
  const totalHeight = rows.length * ROW_HEIGHT + 32;

  if (!fecha) {
    return <div className="p-4 text-[11px] text-text-muted">Sin fecha activa.</div>;
  }
  if (rows.length === 0) {
    return <div className="p-4 text-[11px] text-text-muted">Sin rutas para mostrar.</div>;
  }

  // Eje X ticks cada hora
  const hourTicks: { x: number; label: string }[] = [];
  const startH = parseInt(OPERATION_WINDOW.start.slice(0, 2), 10);
  const endH = parseInt(OPERATION_WINDOW.end.slice(0, 2), 10);
  for (let h = startH; h <= endH; h++) {
    const t = timeOf(baseDate, `${h.toString().padStart(2, '0')}:00`);
    hourTicks.push({ x: xScale(t), label: `${h}h` });
  }

  return (
    <div ref={containerRef} className="h-full w-full overflow-y-auto" data-now={now}>
      <svg width={width} height={totalHeight} className="block">
        {/* Eje X superior */}
        <g>
          {hourTicks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1={16} x2={t.x} y2={totalHeight - 8}
                    stroke="currentColor" className="text-line/30" strokeWidth={0.5} />
              <text x={t.x} y={11} textAnchor="middle"
                    className="fill-text-muted text-[9px]">{t.label}</text>
            </g>
          ))}
        </g>

        {/* Filas */}
        {rows.map(({ ruta, empresa }, rowIdx) => {
          const y = 24 + rowIdx * ROW_HEIGHT;
          const progressPct = (ruta.progreso_pct ?? 0) / 100;
          const operableX0 = xScale(timeOf(baseDate, OPERATION_WINDOW.start));
          const operableX1 = xScale(timeOf(baseDate, OPERATION_WINDOW.end));
          const operableW = operableX1 - operableX0;
          const peorSlack = Math.min(...(ruta.visitas?.map(v => v.slack_min ?? 0) ?? [0]));
          return (
            <g key={ruta.ruta_id}>
              {/* Label izquierdo */}
              <text x={4} y={y + 18} className="fill-text-primary text-[10px] font-medium">
                {(ruta.driver_name ?? '—').slice(0, 16)}
              </text>
              <text x={4} y={y + 28} className="fill-text-muted text-[9px] font-mono">
                {ruta.ruta_id}
              </text>

              {/* Fila background (ventana operativa) */}
              <rect x={operableX0} y={y + 8} width={operableW} height={ROW_HEIGHT - 16}
                    rx={3} className="fill-bg-700/40" />

              {/* Avance real verde */}
              <rect x={operableX0} y={y + 8}
                    width={operableW * progressPct} height={ROW_HEIGHT - 16}
                    rx={3} className="fill-emerald-500/20" />

              {/* Círculos por visita */}
              {ruta.visitas?.map((v: Visita) => {
                const eta = parseEta(v.current_eta_cl) || parseEta(v.planned_arrival_time
                  ? `${baseDate} ${v.planned_arrival_time}:00` : null);
                if (!eta) return null;
                const cx = xScale(eta);
                if (cx < operableX0 - 8 || cx > operableX1 + 8) return null;
                const cy = y + ROW_HEIGHT / 2;
                const r = 4 + Math.min(7, v.p_fallo * 8); // 4..11 px
                let fillCls = 'fill-slate-400';
                if (v.status === 'completed') fillCls = 'fill-emerald-500';
                else if (v.alert_slack === 'RED') fillCls = 'fill-red-500';
                else if (v.alert_slack === 'YELLOW') fillCls = 'fill-amber-500';
                const stroke = v.is_vip
                  ? '#a78bfa' // violet-400
                  : v.alert_valuedata
                  ? '#fb923c' // orange-400
                  : 'transparent';
                const isHovered = hoveredVisitaId === v.tracking_id;
                return (
                  <g key={v.tracking_id}>
                    {v.alert_slack === 'RED' && (
                      <circle cx={cx} cy={cy} r={r + 4} className="fill-red-500/20" />
                    )}
                    <circle
                      cx={cx} cy={cy} r={r}
                      className={`${fillCls} cursor-pointer`}
                      stroke={stroke} strokeWidth={stroke === 'transparent' ? 0 : 2}
                      style={{ opacity: isHovered ? 1 : 0.92 }}
                      onClick={() => setSelectedVisita(v.tracking_id)}
                    >
                      <title>{`${v.folio ?? v.tracking_id}\n${v.address}\nETA ${v.estimated_time_arrival || '—'} · slack ${v.slack_min.toFixed(0)}min · P${(v.p_fallo * 100).toFixed(0)}%`}</title>
                    </circle>
                  </g>
                );
              })}

              {/* Label derecho: % cumplimiento + delta minutos */}
              <text x={width - 6} y={y + 18} textAnchor="end"
                    className="fill-text-primary text-[10px] tabular-nums">
                {Math.round(ruta.progreso_pct ?? 0)}%
              </text>
              <text x={width - 6} y={y + 28} textAnchor="end"
                    className={`text-[9px] tabular-nums ${
                      peorSlack < -10 ? 'fill-red-500' :
                      peorSlack < 30 ? 'fill-amber-500' : 'fill-text-muted'
                    }`}>
                {peorSlack >= 0 ? '+' : ''}{peorSlack.toFixed(0)}m
              </text>
            </g>
          );
        })}

        {/* Línea "now" vertical (sim_clock) */}
        {nowX != null && nowX > LEFT_LABEL_W && nowX < width - RIGHT_LABEL_W && (
          <g>
            <line x1={nowX} y1={16} x2={nowX} y2={totalHeight - 8}
                  stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3,2" />
            <rect x={nowX - 16} y={2} width={32} height={12} rx={2}
                  className="fill-red-500" />
            <text x={nowX} y={11} textAnchor="middle"
                  className="fill-white text-[9px] font-bold">NOW</text>
          </g>
        )}
      </svg>
    </div>
  );
}
