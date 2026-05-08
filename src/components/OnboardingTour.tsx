import { useEffect, useState } from 'react';
import {
  Activity, BarChart3, Bot, Building2, ChevronLeft, ChevronRight,
  ClipboardList, MapPin, MessageCircle, Settings, Sparkles, X,
} from 'lucide-react';

const TOUR_KEY = 'fpoc.tour.completed.v1';

interface TourStep {
  title: string;
  icon: any;
  body: React.ReactNode;
  navigate?: { module: string; sub?: string };
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
  },
  {
    title: 'Planificación — preparar el día',
    icon: ClipboardList,
    body: (
      <>
        <p>Acá importas el plan de SimpliRoute (botón "Carga de entregas"), congelás el día a las 09:00 para configurar prioridades VIP, y arrancás el reloj.</p>
        <p className="mt-2 text-text-muted">El histórico de cargas queda persistido — podés re-importar con "force" si necesitás.</p>
      </>
    ),
    navigate: { module: 'planificacion' },
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
    navigate: { module: 'seguimiento_ia' },
  },
  {
    title: 'Maestros — drivers, clientes, empresas',
    icon: Building2,
    body: (
      <>
        <p>CRUD de drivers, vehículos, empresas de transporte y clientes VIP. Los onboardeados via WhatsApp aparecen acá automáticamente.</p>
      </>
    ),
    navigate: { module: 'maestros' },
  },
  {
    title: 'WhatsApp Agent',
    icon: MessageCircle,
    body: (
      <>
        <p>Conductores, jefes y clientes interactúan por WhatsApp con un agente conversacional que detecta el rol del número (driver / manager / contacto).</p>
        <p className="mt-2 text-text-muted">Comandos clave: <code className="px-1 bg-bg-700 rounded text-[10px]">hola</code> (entra al menú), <code className="px-1 bg-bg-700 rounded text-[10px]">3</code> (reportar incidente con IA), <code className="px-1 bg-bg-700 rounded text-[10px]">stop</code> (opt-out).</p>
        <p className="mt-2 text-text-muted">El log inbound/outbound queda en el panel "Notificaciones".</p>
      </>
    ),
    navigate: { module: 'configuracion', sub: 'notifications' },
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
    navigate: { module: 'analitica' },
  },
  {
    title: 'Configuración — admin runtime',
    icon: Settings,
    body: (
      <>
        <p>Ajustes en vivo: ventana de anticipación (eta_window_hours), umbral del modelo (alert_threshold), CRUD de motivos alertables, y notificaciones (on/off + dry-run).</p>
        <p className="mt-2 text-text-muted">Los cambios afectan al snapshot ML inmediatamente, sin reiniciar.</p>
      </>
    ),
    navigate: { module: 'configuracion' },
  },
  {
    title: '🎯 Listo. Te dejo en marcha.',
    icon: MapPin,
    body: (
      <>
        <p>Si querés volver a ver este tour, está en el botón <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-bg-700 rounded text-[10px]"><Sparkles size={10} /> Tour</span> del topbar.</p>
        <p className="mt-2 text-text-muted">Y si tenés dudas, el manual está en <code className="px-1 bg-bg-700 rounded text-[10px]">docs/manual/ONBOARDING.md</code> del repo.</p>
      </>
    ),
  },
];

export interface OnboardingTourProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (module: string, sub?: string) => void;
}

export function OnboardingTour({ open, onClose, onNavigate }: OnboardingTourProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  const goNext = () => {
    if (isLast) {
      finish();
      return;
    }
    const next = STEPS[step + 1];
    if (next.navigate && onNavigate) onNavigate(next.navigate.module, next.navigate.sub);
    setStep(step + 1);
  };

  const goPrev = () => {
    if (step === 0) return;
    setStep(step - 1);
    const prev = STEPS[step - 1];
    if (prev.navigate && onNavigate) onNavigate(prev.navigate.module, prev.navigate.sub);
  };

  const finish = () => {
    try {
      localStorage.setItem(TOUR_KEY, '1');
    } catch {}
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-bg-800 border border-line rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand/15 flex items-center justify-center">
            <Icon size={20} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-text-muted">
              Paso {step + 1} de {STEPS.length}
            </div>
            <h2 className="text-[15px] font-semibold truncate">{s.title}</h2>
          </div>
          <button
            onClick={finish}
            className="text-text-muted hover:text-text-primary transition-colors"
            title="Cerrar tour"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 text-[13px] leading-relaxed min-h-[120px]">
          {s.body}
        </div>

        {/* Progress bar */}
        <div className="px-5">
          <div className="w-full h-1 bg-bg-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between border-t border-line mt-4">
          <button
            onClick={finish}
            className="text-[12px] text-text-muted hover:text-text-primary"
          >
            Saltar tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              disabled={step === 0}
              className="btn flex items-center gap-1 text-[12px] !px-3 !py-1.5 disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              onClick={goNext}
              className="btn-primary flex items-center gap-1 text-[12px] !px-3 !py-1.5"
            >
              {isLast ? 'Empezar' : 'Siguiente'}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
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
