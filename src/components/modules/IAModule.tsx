import { Brain } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { ModelPanel } from '../ModelPanel';

const SUBS: Record<string, true> = { modelo: true, 'modelo-xgb': true };

export function IAModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const activeRaw = sub && SUBS[sub] ? sub : 'modelo';
  // Canonical slug
  const active = activeRaw === 'modelo-xgb' ? 'modelo' : activeRaw;

  const tabs: SubTabDef[] = [
    { key: 'modelo', label: 'Modelo XGB', icon: Brain },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'modelo' && <ModelPanel />}
      </div>
    </div>
  );
}
