import { BarChart3, Bell, Brain, Trophy } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { SeguimientoPanel } from '../SeguimientoPanel';
import { NotificationsPanel } from '../NotificationsPanel';
import { ModelPanel } from '../ModelPanel';
import { DriverScorecardPanel } from '../panels/DriverScorecardPanel';

// Sub-slugs en español kebab. 'notifs' y 'scorecard' tienen alias en SUBS para
// no romper bookmarks viejos; el slug canónico es el español.
const SUBS: Record<string, true> = {
  kpis: true,
  'scorecard-drivers': true, scorecard: true,
  'log-notificaciones': true, notifs: true,
  'modelo-xgb': true, modelo: true,
};

export function AnaliticaModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  // Redirect legacy sub-slugs a su canónico
  const canonical: Record<string, string> = {
    scorecard: 'scorecard-drivers',
    notifs: 'log-notificaciones',
    modelo: 'modelo-xgb',
  };
  const activeRaw = sub && SUBS[sub] ? sub : 'kpis';
  const active = canonical[activeRaw] ?? activeRaw;
  const tabs: SubTabDef[] = [
    { key: 'kpis',                label: 'KPIs',                icon: BarChart3 },
    { key: 'scorecard-drivers',   label: 'Scorecard de drivers', icon: Trophy },
    { key: 'log-notificaciones',  label: 'Log de notificaciones', icon: Bell },
    { key: 'modelo-xgb',          label: 'Modelo XGB',          icon: Brain },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'kpis' && <SeguimientoPanel />}
        {active === 'scorecard-drivers' && <DriverScorecardPanel />}
        {active === 'log-notificaciones' && <NotificationsPanel />}
        {active === 'modelo-xgb' && <ModelPanel />}
      </div>
    </div>
  );
}
