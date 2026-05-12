import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Activity, BarChart3, Bot, Building2, ChevronLeft, ChevronRight,
  ClipboardList, MapPin, MessageCircle, Settings, Sparkles, X,
} from 'lucide-react';

const TOUR_KEY = 'fpoc.tour.completed.v1';

interface TourStep {
  title: string;
  icon: any;
  body: React.ReactNode;
  /** Si está set, navegamos a (module, sub) ANTES de mostrar el paso. */
  navigate?: { module: string; sub?: string };
  /** CSS selector del elemento real a destacar. Si no se encuentra, paso queda
   *  centrado (modal clásico). */
  target?: string;
}

const STEPS: TourStep[] = [
  {
    title: '👋 Bienvenido a ValueData × Falabella',
    icon: Sparkles,
    body: (
      <>
        <p>Esta es la torre de control logística que combina IA, ML predictivo y WhatsApp en tiempo real.</p>
        <p className="mt-2 text-text-muted">En 2 minutos te muestro las áreas principales. Podés saltar el tour en cualquier momento.</p>
      </>
    ),
  },
  {
    title: 'Operación — la vista del día',
    icon: Activity,
    body: (
      <>
        <p>Mapa con las visitas reales del día (5,000+ puntos en RM y regiones), alertas anticipadas con SHAP, KPIs en vivo.</p>
        <p className="mt-2 text-text-muted">El reloj simulado avanza solo (cada 3s real = 3 min simulados). Podés pausarlo en "Plan diario".</p>
      </>
    ),
    navigate: { module: 'operacion' },
    target: '[data-tour-id="sidebar-operacion"]',
  },
  {
    title: 'Planificación — preparar el día',
    icon: ClipboardList,
    body: (
      <>
        <p>Acá importás el plan de SimpliRoute, configurás dotación del día (drivers ausentes/baja), y arrancás el reloj.</p>
        <p className="mt-2 text-text-muted">Si un driver de la carga está bloqueado, el sistema te avisa antes de iniciar.</p>
      </>
    ),
    navigate: { module: 'planificacion' },
    target: '[data-tour-id="sidebar-planificacion"]',
  },
  {
    title: 'Seguimiento IA — auditoría LLM',
    icon: Bot,
    body: (
      <>
        <p>El motor de IA (Azure OpenAI gpt-4o-mini) clasifica los motivos de no-entrega usando un catálogo de 14 motivos del cliente.</p>
        <p className="mt-2 text-text-muted">Las correcciones de drivers entran como dataset de mejora continua.</p>
      </>
    ),
    navigate: { module: 'auditoria-ia' },
    target: '[data-tour-id="sidebar-auditoria-ia"]',
  },
  {
    title: 'Onboarding — empresas con drivers y vehículos',
    icon: Building2,
    body: (
      <>
        <p>Click en una empresa abre su página completa con tabs: Drivers, Vehículos, Contactos, CSV, Broadcast.</p>
        <p className="mt-2 text-text-muted">Cada driver tiene su propia página con datos, documentos (Azure Blob) y capacitaciones con vencimiento.</p>
      </>
    ),
    navigate: { module: 'onboarding' },
    target: '[data-tour-id="sidebar-onboarding"]',
  },
  {
    title: 'WhatsApp Agent',
    icon: MessageCircle,
    body: (
      <>
        <p>Conductores, jefes y clientes interactúan por WhatsApp con un agente conversacional que detecta el rol del número (driver / manager / contacto).</p>
        <p className="mt-2 text-text-muted">El log inbound/outbound queda en el panel "Notificaciones".</p>
      </>
    ),
    navigate: { module: 'configuracion', sub: 'notifications' },
    target: '[data-tour-id="sidebar-configuracion"]',
  },
  {
    title: 'Analítica — métricas históricas',
    icon: BarChart3,
    body: (
      <>
        <p>KPIs por período, distribución SLA, performance por driver, splits por región (RM vs regiones).</p>
        <p className="mt-2 text-text-muted">Datos directos de la BD real (~160k visitas histórico).</p>
      </>
    ),
    navigate: { module: 'control' },
    target: '[data-tour-id="sidebar-analitica"]',
  },
  {
    title: 'Configuración — admin runtime',
    icon: Settings,
    body: (
      <>
        <p>Ajustes en vivo: ventana de anticipación, umbral del modelo, CRUD de motivos alertables, y notificaciones (on/off + dry-run).</p>
        <p className="mt-2 text-text-muted">Los cambios afectan al snapshot ML inmediatamente, sin reiniciar.</p>
      </>
    ),
    navigate: { module: 'configuracion' },
    target: '[data-tour-id="sidebar-configuracion"]',
  },
  {
    title: '🎯 Listo. Te dejo en marcha.',
    icon: MapPin,
    body: (
      <>
        <p>Si querés volver a ver este tour, está en el botón <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-bg-700 rounded text-[10px]"><Sparkles size={10} /> Tour</span> del topbar.</p>
        <p className="mt-2 text-text-muted">Cualquier duda, el manual está en <code className="px-1 bg-bg-700 rounded text-[10px]">docs/manual/ONBOARDING.md</code> del repo.</p>
      </>
    ),
  },
];

export interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (module: string, sub?: string) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;     // px de margen alrededor del target en el spotlight
const TOOLTIP_W = 360; // ancho del tooltip
const TOOLTIP_GAP = 12;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function findTargetRect(selector: string | undefined): Rect | null {
  if (!selector) return null;
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function OnboardingTour({ open, onClose, onNavigate }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [waiting, setWaiting] = useState(false);  // true mientras esperamos el target post-nav
  const stepRef = useRef(step);

  useEffect(() => { stepRef.current = step; }, [step]);

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  // Re-localizar el target en cada cambio de step + en resize/scroll
  useLayoutEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s.target) {
      setRect(null); setWaiting(false);
      return;
    }
    // Si recién navegamos, el elemento puede no existir aún. Polleamos hasta 2s.
    let cancelled = false;
    setWaiting(true);
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      const r = findTargetRect(s.target);
      if (r) {
        setRect(r); setWaiting(false);
      } else if (Date.now() - start < 2000) {
        requestAnimationFrame(tick);
      } else {
        setRect(null); setWaiting(false);
      }
    };
    tick();
    return () => { cancelled = true; };
  }, [open, step]);

  // Re-medir en resize/scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => {
      const s = STEPS[stepRef.current];
      if (s.target) {
        const r = findTargetRect(s.target);
        if (r) setRect(r);
      }
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open]);

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  const goToStep = (next: number) => {
    const target = STEPS[next];
    if (target.navigate && onNavigate) onNavigate(target.navigate.module, target.navigate.sub);
    setStep(next);
  };

  const goNext = () => {
    if (isLast) { finish(); return; }
    goToStep(step + 1);
  };

  const goPrev = () => {
    if (step === 0) return;
    goToStep(step - 1);
  };

  const finish = () => {
    try { localStorage.setItem(TOUR_KEY, '1'); } catch {}
    onClose();
  };

  // Calcular posición del tooltip relativa al target (o centrar si no hay)
  let tooltipStyle: React.CSSProperties;
  let hasSpotlight = false;
  if (rect) {
    hasSpotlight = true;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Preferir lado derecho del target si hay espacio; sino abajo; sino arriba
    const rightSpace = vw - (rect.left + rect.width) - TOOLTIP_GAP;
    const belowSpace = vh - (rect.top + rect.height) - TOOLTIP_GAP;
    if (rightSpace >= TOOLTIP_W) {
      tooltipStyle = {
        left: rect.left + rect.width + TOOLTIP_GAP,
        top: clamp(rect.top, 16, vh - 200),
        width: TOOLTIP_W,
      };
    } else if (belowSpace >= 200) {
      tooltipStyle = {
        left: clamp(rect.left, 16, vw - TOOLTIP_W - 16),
        top: rect.top + rect.height + TOOLTIP_GAP,
        width: TOOLTIP_W,
      };
    } else {
      tooltipStyle = {
        left: clamp(rect.left, 16, vw - TOOLTIP_W - 16),
        top: Math.max(16, rect.top - 200 - TOOLTIP_GAP),
        width: TOOLTIP_W,
      };
    }
  } else {
    tooltipStyle = {
      left: '50%',
      top: '50%',
      width: TOOLTIP_W,
      transform: 'translate(-50%, -50%)',
    };
  }

  return (
    <>
      {/* Spotlight overlay */}
      {hasSpotlight && rect ? (
        <svg
          className="fixed inset-0 z-50 pointer-events-none"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={rect.left - PADDING}
                y={rect.top - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                fill="black"
                rx="6"
              />
            </mask>
          </defs>
          <rect
            x="0" y="0" width="100%" height="100%"
            fill="rgba(0,0,0,0.65)"
            mask="url(#spotlight-mask)"
          />
          {/* Borde animado del target */}
          <rect
            x={rect.left - PADDING}
            y={rect.top - PADDING}
            width={rect.width + PADDING * 2}
            height={rect.height + PADDING * 2}
            fill="none"
            stroke="currentColor"
            className="text-brand"
            strokeWidth="2"
            rx="6"
          >
            <animate attributeName="stroke-opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
          </rect>
        </svg>
      ) : (
        // Sin target: backdrop oscuro pleno (modal clásico)
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
      )}

      {/* Tooltip / step card */}
      <div
        className="fixed z-[51] bg-bg-800 border border-line rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        style={tooltipStyle}
      >
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-brand/15 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Paso {step + 1} de {STEPS.length}
            </div>
            <h2 className="text-[13px] font-semibold truncate">{s.title}</h2>
          </div>
          <button
            onClick={finish}
            className="text-text-muted hover:text-text-primary transition-colors"
            title="Cerrar tour"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 text-[12px] leading-relaxed min-h-[80px]">
          {waiting ? (
            <span className="text-text-muted">Cargando módulo…</span>
          ) : s.body}
        </div>

        <div className="px-4">
          <div className="w-full h-1 bg-bg-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-t border-line mt-3">
          <button
            onClick={finish}
            className="text-[11px] text-text-muted hover:text-text-primary"
          >
            Saltar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={step === 0}
              className="btn flex items-center gap-1 text-[11px] !px-2.5 !py-1 disabled:opacity-40"
            >
              <ChevronLeft size={12} /> Atrás
            </button>
            <button
              onClick={goNext}
              className="btn-primary flex items-center gap-1 text-[11px] !px-2.5 !py-1"
            >
              {isLast ? 'Empezar' : 'Siguiente'}
              {!isLast && <ChevronRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function shouldShowTour(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) !== '1';
  } catch {
    return false;
  }
}

export function resetTour(): void {
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {}
}
