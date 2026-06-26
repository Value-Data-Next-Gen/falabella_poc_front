import { useAuthStore } from '@/lib/auth-store'
import { Badge } from '@/components/Badge'
import { Radio, Database, MessageCircle, Cloud } from 'lucide-react'

export function SettingsPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div>
      <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-6">Configuracion</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform info */}
        <div className="bg-bg-800 rounded-md border border-line p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-4 h-4 text-brand-500" />
            <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">Plataforma</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-text-muted">Version</span><span className="text-text-primary">v2.0.0</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Usuario</span><span className="text-text-primary">{user?.display_name}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Email</span><span className="text-text-primary">{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Rol</span><Badge variant="blue">{user?.role}</Badge></div>
          </div>
        </div>

        {/* Integrations */}
        <div className="bg-bg-800 rounded-md border border-line p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-brand-500" />
            <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">WhatsApp / Twilio</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-text-muted">Sender</span><span className="text-text-primary">+56957018982</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Modo</span><Badge variant="yellow">Dry Run</Badge></div>
            <div className="flex justify-between"><span className="text-text-muted">Webhook</span><span className="text-text-secondary text-[11px]">/api/v1/twilio/webhook</span></div>
          </div>
        </div>

        {/* Database */}
        <div className="bg-bg-800 rounded-md border border-line p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-brand-500" />
            <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">Base de Datos</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-text-muted">Servidor</span><span className="text-text-primary">Azure SQL</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Schema</span><span className="text-text-primary">td</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Migraciones</span><Badge variant="green">13 aplicadas</Badge></div>
          </div>
        </div>

        {/* Storage */}
        <div className="bg-bg-800 rounded-md border border-line p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Cloud className="w-4 h-4 text-brand-500" />
            <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">Almacenamiento</h2>
          </div>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between"><span className="text-text-muted">Backend</span><Badge variant="yellow">Filesystem local</Badge></div>
            <div className="flex justify-between"><span className="text-text-muted">Container</span><span className="text-text-secondary">td-documents</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Max archivo</span><span className="text-text-primary">25 MB</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
