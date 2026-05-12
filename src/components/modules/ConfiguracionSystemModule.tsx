import { useState } from 'react';
import {
  BellRing, Brain, ChevronDown, ChevronRight, MessageCircle, Plug,
} from 'lucide-react';

interface CardDef {
  key: string;
  icon: any;
  title: string;
  status: 'soon' | 'partial' | 'done';
  description: string;
  detail?: string;
}

const CARDS: CardDef[] = [
  {
    key: 'alertas',
    icon: BellRing,
    title: 'Alertas globales',
    status: 'partial',
    description: 'Umbrales y disparadores de alertas de la app.',
    detail:
      'Hoy se gestionan por-motivo en Onboarding → Catálogo de motivos. ' +
      'Próximamente se podrán configurar umbrales globales de p(fallo), slack mínimo ' +
      'y horarios de quietud desde acá.',
  },
  {
    key: 'whatsapp',
    icon: MessageCircle,
    title: 'WhatsApp / Twilio',
    status: 'partial',
    description: 'Proveedor de mensajería y webhooks.',
    detail:
      'Twilio sandbox activo. Provider: twilio. ' +
      'Para producción cambiar TWILIO_WHATSAPP_FROM en .env y registrar templates Meta. ' +
      'El número del sandbox y el código join se ven al onboardear un driver/usuario nuevo.',
  },
  {
    key: 'llm',
    icon: Brain,
    title: 'LLM',
    status: 'partial',
    description: 'Modelo conversacional para clasificación de motivos y asistente IA.',
    detail:
      'Azure OpenAI gpt-4o-mini conectado / fallback keywords. ' +
      'Configurar AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_CHAT_DEPLOYMENT en .env.',
  },
  {
    key: 'integraciones',
    icon: Plug,
    title: 'Integraciones',
    status: 'soon',
    description: 'Conectores con sistemas externos.',
    detail:
      'SimpliRoute (carga vía XLSX hoy), BigQuery, Slack y otros. Próximamente.',
  },
];

const STATUS_PILL: Record<CardDef['status'], { label: string; cls: string }> = {
  soon:    { label: 'Próximamente',    cls: 'bg-amber-500/15 text-amber-400 ring-amber-500/30' },
  partial: { label: 'Parcial',         cls: 'bg-accent-blue/15 text-accent-blue ring-accent-blue/30' },
  done:    { label: 'Configurado',     cls: 'bg-accent-green/15 text-accent-green ring-accent-green/30' },
};

export function ConfiguracionSystemModule(_props: { sub: string | null; setSub: (s: string) => void }) {
  // Consolidado en una sola pantalla con cards expandibles — no más tabs vacías
  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Configuración avanzada</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            Parámetros globales del sistema. Click en cada tarjeta para ver detalle.
          </p>
        </div>
        {CARDS.map(c => <ExpandableCard key={c.key} card={c} />)}
      </div>
    </div>
  );
}

function ExpandableCard({ card }: { card: CardDef }) {
  const [open, setOpen] = useState(false);
  const pill = STATUS_PILL[card.status];
  const Icon = card.icon;
  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-bg-700/30 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-md bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold">{card.title}</span>
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 ${pill.cls}`}>
              {pill.label}
            </span>
          </div>
          <div className="text-[12px] text-text-muted mt-0.5">{card.description}</div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-text-muted shrink-0" />
          : <ChevronRight size={14} className="text-text-muted shrink-0" />}
      </button>
      {open && card.detail && (
        <div className="px-4 pb-4 pt-1 text-[12px] text-text-secondary leading-relaxed border-t border-line/40">
          {card.detail}
        </div>
      )}
    </div>
  );
}
