import { BarChart3, Bell, Table2, Trophy } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { SeguimientoPanel } from '../SeguimientoPanel';
import { NotificationsPanel } from '../NotificationsPanel';
import { DriverScorecardPanel } from '../panels/DriverScorecardPanel';
import { TablaVisitas } from '../panels/TablaVisitas';
// Nota: ModelPanel se movió a IAModule (módulo IA / Modelo) en R3.

// Sub-slugs en español kebab. 'notifs' y 'scorecard' tienen alias en SUBS para
// no romper bookmarks viejos; el slug canónico es el español.
const SUBS: Record<string, true> = {
  kpis: true,
  visitas: true,
  'scorecard-drivers': true, scorecard: true,
  'log-notificaciones': true, notifs: true, log: true,
};

export function AnaliticaModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  // Redirect legacy sub-slugs a su canónico
  const canonical: Record<string, string> = {
    scorecard: 'scorecard-drivers',
    notifs: 'log-notificaciones',
    log: 'log-notificaciones',
  };
  // 'modelo' viejo: si llegó acá vía link viejo, fallback a kpis (la ruta
  // canónica nueva es /ia/modelo, manejada por IAModule).
  const activeRaw = sub && SUBS[sub] ? sub : 'kpis';
  const active = canonical[activeRaw] ?? activeRaw;
  const tabs: SubTabDef[] = [
    { key: 'kpis',                label: 'KPIs',                  icon: BarChart3 },
    { key: 'visitas',             label: 'Visitas',               icon: Table2 },
    { key: 'scorecard-drivers',   label: 'Scorecard de drivers',  icon: Trophy },
    { key: 'log-notificaciones',  label: 'Log de notificaciones', icon: Bell },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'kpis' && <SeguimientoPanel />}
        {active === 'visitas' && <TablaVisitas />}
        {active === 'scorecard-drivers' && <DriverScorecardPanel />}
        {active === 'log-notificaciones' && <NotificationsPanel />}
      </div>
    </div>
  );
}
