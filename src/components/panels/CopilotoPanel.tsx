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
import { api } from '../../api';

interface Suggestion {
  id: string;
  emoji: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  features: { label: string; value: string }[];
}

// CR-012 T10: 3 sugerencias mock alineadas al scope v1 (SOLO alertas a
// personas — NO re-routing, NO reasignación, NO reordenamiento). Decisión
// usuario CR-012 §4: tampoco se notifica directo al cliente.
// TODO(ai-integration): cuando exista /api/copiloto/suggestions, reemplazar
// el MOCK por useQuery del endpoint. Las acciones se loggean en backend
// para fine-tuning.
const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    id: 'retraso-vip-platinum',
    emoji: '🔴',
    severity: 'critical',
    title: 'Retraso crítico — VIP Platinum',
    description: 'Folio #14246780 (VIP Platinum, P=68%). Ventana cierra 16:00, ETA 15:18 (slack −48 min). Driver no respondió alerta de las 14:30.',
    features: [
      { label: 'Cliente', value: 'VIP Platinum · SLA 4h' },
      { label: 'P(fallo)', value: '68% (top decil del modelo)' },
      { label: 'Slack actual', value: '−48 min' },
      { label: 'Última alerta driver', value: '14:30 · sin ack hace 12 min' },
    ],
  },
  {
    id: 'patron-motivos',
    emoji: '🟠',
    severity: 'warning',
    title: 'Patrón en motivos de no entrega',
    description: 'Driver Carlos García: "cliente no contesta" en 4 visitas hoy (confidence LLM 87%). Revisar si es patrón real o falso positivo.',
    features: [
      { label: 'Motivos coincidentes', value: '4 visitas / 12 hoy' },
      { label: 'LLM confidence', value: '87%' },
      { label: 'Histórico mismo driver', value: '0.3 / día (baseline)' },
      { label: 'Comunas distintas', value: 'sí (3) → no clúster geográfico' },
    ],
  },
  {
    id: 'driver-sin-respuesta',
    emoji: '🔴',
    severity: 'critical',
    title: 'Driver sin respuesta a alerta',
    description: 'Carlos Pérez no respondió alerta enviada hace 12 min sobre folio #14246812. Escalamiento automático a supervisor sugerido.',
    features: [
      { label: 'Alerta enviada', value: 'WhatsApp · 12 min atrás' },
      { label: 'Última lectura WA', value: '14:18 (hace 27 min)' },
      { label: 'Visita afectada', value: '#14246812 · ETA 15:00 · slack −20' },
    ],
  },
];

interface SuggestionAction {
  label: string;
  primary?: boolean;
  /** Identificador semántico de la acción. Logueado en backend cuando
   *  exista el endpoint. NUNCA contiene "reassign", "reorder", "modify_route". */
  intent: 'escalate_supervisor' | 'retry_driver_alert' | 'review_visits' | 'mark_incident' | 'ignore';
}

const ACTIONS_BY_SUGGESTION: Record<string, SuggestionAction[]> = {
  'retraso-vip-platinum': [
    { label: 'Escalar a supervisor', intent: 'escalate_supervisor', primary: true },
    { label: 'Reintentar alerta driver', intent: 'retry_driver_alert' },
    { label: 'Ignorar', intent: 'ignore' },
  ],
  'patron-motivos': [
    { label: 'Confirmar patrón → escalar', intent: 'escalate_supervisor', primary: true },
    { label: 'Revisar visitas', intent: 'review_visits' },
    { label: 'Ignorar', intent: 'ignore' },
  ],
  'driver-sin-respuesta': [
    { label: 'Escalar ahora', intent: 'escalate_supervisor', primary: true },
    { label: 'Reintentar alerta', intent: 'retry_driver_alert' },
    { label: 'Marcar incidente', intent: 'mark_incident' },
  ],
};

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

  const actions = ACTIONS_BY_SUGGESTION[suggestion.id] ?? [
    { label: 'Ignorar', intent: 'ignore' as const },
  ];

  const handleAction = async (a: SuggestionAction) => {
    // CR-013: persistimos SIEMPRE la decisión del ops para fine-tuning.
    // Optimistic UI: dismiss / warn inmediato, log en background (catch silencioso).
    // Las sugerencias son mock por ahora — no hacemos rollback si la persistencia
    // falla, el card sigue siendo hardcoded del frontend.
    //
    // `tracking_id` — las mocks no tienen un campo formal. Lo extraemos del
    // description con regex /#(\d+)/ (ej. "Folio #14246780 ..."). null si no.
    const trackingMatch = suggestion.description.match(/#(\d+)/);
    const tracking_id = trackingMatch ? trackingMatch[1] : null;

    if (a.intent === 'ignore') {
      setDismissed(true);
    } else {
      // Para escalamiento real va T11 (modal con confirmación). Para
      // retry_driver_alert / review_visits / mark_incident sigue siendo
      // placeholder visual — el log basta para empezar a recolectar señal.
      console.warn(`[copiloto] intent=${a.intent} suggestion=${suggestion.id} (mock UI; backend log enviado)`);
    }

    api.copiloto
      .logDecision({
        suggestion_id: suggestion.id,
        intent: a.intent,
        tracking_id,
        payload: {
          severity: suggestion.severity,
          title: suggestion.title,
          features: suggestion.features,
        } as never,
      })
      .catch(err => {
        // No bloqueamos UI ni hacemos rollback — el card es mock.
        // eslint-disable-next-line no-console
        console.warn('[copiloto] logDecision failed', err);
      });
  };

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
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => handleAction(a)}
              className={a.primary
                ? 'btn-primary text-[10px] !py-1 !px-2'
                : 'btn text-[10px] !py-1 !px-2'}
            >
              {a.label}
            </button>
          ))}
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
