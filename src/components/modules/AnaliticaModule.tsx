import { BarChart3, Bell, Brain, Trophy } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { SeguimientoPanel } from '../SeguimientoPanel';
import { NotificationsPanel } from '../NotificationsPanel';
import { ModelPanel } from '../ModelPanel';
import { DriverScorecardPanel } from '../panels/DriverScorecardPanel';

const SUBS: Record<string, true> = { kpis: true, scorecard: true, notifs: true, modelo: true };

export function AnaliticaModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const active = sub && SUBS[sub] ? sub : 'kpis';
  const tabs: SubTabDef[] = [
    { key: 'kpis',      label: 'KPIs',              icon: BarChart3 },
    { key: 'scorecard', label: 'Driver scorecard',  icon: Trophy },
    { key: 'notifs',    label: 'Notificaciones log', icon: Bell },
    { key: 'modelo',    label: 'Modelo XGB',        icon: Brain },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'kpis' && <SeguimientoPanel />}
        {active === 'scorecard' && <DriverScorecardPanel />}
        {active === 'notifs' && <NotificationsPanel />}
        {active === 'modelo' && <ModelPanel />}
      </div>
    </div>
  );
}
