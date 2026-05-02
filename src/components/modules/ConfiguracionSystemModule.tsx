import { Bell, BellRing, Brain, MessageCircle, Plug } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';

const SUBS: Record<string, true> = { alertas: true, whatsapp: true, llm: true, integraciones: true };

export function ConfiguracionSystemModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const active = sub && SUBS[sub] ? sub : 'alertas';
  const tabs: SubTabDef[] = [
    { key: 'alertas',       label: 'Alertas',           icon: BellRing },
    { key: 'whatsapp',      label: 'WhatsApp / Twilio', icon: MessageCircle },
    { key: 'llm',           label: 'LLM',               icon: Brain },
    { key: 'integraciones', label: 'Integraciones',     icon: Plug },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-6 max-w-3xl">
        {active === 'alertas' && (
          <PlaceholderCard
            icon={BellRing}
            title="Configuración global de alertas"
            description="Por ahora se gestiona en cada motivo dentro de Maestros → Catálogo motivos."
          />
        )}
        {active === 'whatsapp' && (
          <PlaceholderCard
            icon={MessageCircle}
            title="WhatsApp / Twilio"
            description="Twilio sandbox activo. Provider: twilio. Para producción cambiar TWILIO_WHATSAPP_FROM en .env y registrar templates Meta."
          />
        )}
        {active === 'llm' && (
          <PlaceholderCard
            icon={Brain}
            title="LLM"
            description="Azure OpenAI gpt-4o-mini conectado / fallback keywords. Configura AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_CHAT_DEPLOYMENT en .env."
          />
        )}
        {active === 'integraciones' && (
          <PlaceholderCard
            icon={Plug}
            title="Integraciones"
            description="Conectores SimpliRoute, BigQuery, Slack y otros. Próximamente."
          />
        )}
      </div>
    </div>
  );
}

function PlaceholderCard({
  icon: Icon, title, description,
}: { icon: any; title: string; description: string }) {
  return (
    <div className="panel p-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-md bg-brand/10 text-brand flex items-center justify-center shrink-0">
          <Icon size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              Próximamente
            </span>
          </div>
          <p className="text-[12px] text-text-muted mt-1.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}
