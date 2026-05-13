/**
 * Copiloto operativo — placeholder visual con 3 sugerencias mock.
 *
 * TODO(ai-integration): este componente NO está conectado a un LLM real.
 * Las sugerencias son hardcoded para mostrar el diferencial AI en demos.
 *
 * Diseño final esperado:
 *   - Backend: endpoint /api/copiloto/suggestions?fecha=X que cruza
 *     plan-diario + driver-positions + comments_simulator + alert_config
 *     y devuelve sugerencias accionables (reasignar, notificar VIP, verificar
 *     driver parado, etc.).
 *   - Cada sugerencia tiene `id`, `severity`, `title`, `description`,
 *     `action_url` (qué hacer al [Aplicar]), `features[]` (qué entró al modelo).
 *   - El usuario aplica/ignora → backend logea decisión para fine-tuning.
 *
 * Por ahora: 3 cards estáticas + popovers de "Por qué?" con features mock.
 */
import { useState } from 'react';
import { Sparkles, ChevronRight, X } from 'lucide-react';

interface Suggestion {
  id: string;
  emoji: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  features: { label: string; value: string }[];
}

const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    id: 'reasignar-1245',
    emoji: '🔴',
    severity: 'critical',
    title: 'Reasignar visita #1245',
    description: 'VIP, P(fallo)=68%. Driver más cercano: Pérez (15 min)',
    features: [
      { label: 'Ventana horaria', value: 'cerrando en 42 min' },
      { label: 'P(fallo) histórico cliente', value: '45%' },
      { label: 'Driver actual', value: '4 visitas pendientes (sobrecarga)' },
    ],
  },
  {
    id: 'whatsapp-vips',
    emoji: '📞',
    severity: 'warning',
    title: 'Enviar WhatsApp manual a 3 clientes VIP',
    description: 'Ventana cerrando <30 min y ETA > slack mínimo',
    features: [
      { label: 'Clientes afectados', value: '3 VIPs (tier oro)' },
      { label: 'Slack promedio', value: '−12 min' },
      { label: 'Tasa de respuesta WhatsApp', value: '78% últimos 30d' },
    ],
  },
  {
    id: 'driver-garcia-parado',
    emoji: '⚠️',
    severity: 'warning',
    title: 'Driver García parado hace 25 min',
    description: 'Sin movimiento GPS. Verificar — última entrega OK',
    features: [
      { label: 'Última ubicación', value: 'Av. Vitacura 4500, Vitacura' },
      { label: 'Velocidad últimos 15 min', value: '0 km/h' },
      { label: 'Próximo stop', value: 'a 2.3 km · ETA 14:35' },
    ],
  },
];

export function CopilotoPanel({
  collapsed, onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="self-stretch w-10 bg-bg-800/60 border-l border-line/40 flex flex-col items-center justify-start gap-2 py-3 hover:bg-bg-700/60 transition-colors"
        title="Abrir Copiloto operativo"
      >
        <Sparkles size={16} className="text-brand" />
        <span className="text-[9px] uppercase tracking-wider text-text-muted [writing-mode:vertical-rl]">
          Copiloto
        </span>
        <span className="bg-accent-red text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
          {MOCK_SUGGESTIONS.length}
        </span>
      </button>
    );
  }
  return (
    <aside className="w-[340px] shrink-0 flex flex-col bg-bg-800/40 border-l border-line/40 overflow-y-auto">
      <header className="px-3 py-2 border-b border-line/40 flex items-center justify-between sticky top-0 bg-bg-800/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-brand" />
          <span className="text-[12px] font-semibold tracking-wide">Copiloto operativo</span>
          <span className="text-[9px] uppercase tracking-wider text-text-muted bg-bg-700 px-1.5 py-0.5 rounded">
            mock
          </span>
        </div>
        <button onClick={onToggle} className="text-text-muted hover:text-text-primary" title="Colapsar">
          <X size={14} />
        </button>
      </header>
      <div className="flex flex-col gap-2 p-2">
        {MOCK_SUGGESTIONS.map(s => <SuggestionCard key={s.id} suggestion={s} />)}
      </div>
      <footer className="px-3 py-2 mt-auto border-t border-line/40 text-[9px] text-text-muted text-center">
        💡 TODO(ai-integration): sugerencias hardcoded para demo.<br />
        Integración LLM real en ROADMAP.
      </footer>
    </aside>
  );
}

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const [showWhy, setShowWhy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const sevBorder =
    suggestion.severity === 'critical' ? 'border-l-4 border-l-red-500' :
    suggestion.severity === 'warning' ? 'border-l-4 border-l-amber-500' :
    'border-l-4 border-l-blue-500';

  return (
    <div className={`bg-bg-900 border border-line/60 rounded-md ${sevBorder} relative`}>
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2 mb-1">
          <span className="text-[14px] leading-none mt-0.5">{suggestion.emoji}</span>
          <div className="flex-1 min-w-0">
            <h4 className="text-[12px] font-semibold leading-tight">{suggestion.title}</h4>
            <p className="text-[11px] text-text-muted leading-snug mt-0.5">
              {suggestion.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <button
            onClick={() => alert(`TODO(ai-integration): aplicar acción "${suggestion.id}"`)}
            className="btn-primary text-[10px] !py-1 !px-2"
          >
            Aplicar
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="btn text-[10px] !py-1 !px-2"
          >
            Ignorar
          </button>
          <button
            onClick={() => setShowWhy(v => !v)}
            className="text-[10px] text-text-muted hover:text-brand ml-auto flex items-center gap-0.5"
            title="Por qué la IA sugiere esto"
          >
            ¿Por qué?
            <ChevronRight size={11} className={`transition-transform ${showWhy ? 'rotate-90' : ''}`} />
          </button>
        </div>
      </div>
      {showWhy && (
        <div className="px-3 pb-2.5 pt-1 border-t border-line/40 bg-bg-800/60">
          <div className="text-[9px] uppercase tracking-wider text-text-muted mb-1.5">
            Features que dispararon la sugerencia
          </div>
          <ul className="flex flex-col gap-1">
            {suggestion.features.map((f, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-[10px]">
                <span className="text-text-secondary">{f.label}</span>
                <span className="text-text-primary font-mono text-right truncate">{f.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
