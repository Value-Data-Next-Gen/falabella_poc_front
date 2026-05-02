import { CalendarDays, ClipboardList, Settings2, UploadCloud } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { CargaEntregasPanel } from '../panels/CargaEntregasPanel';
import { PlanDiarioPanel } from '../PlanDiarioPanel';
import { DayConfigPanel } from '../DayConfigPanel';

const SUBS: Record<string, true> = { carga: true, plan: true, dia: true };

export function PlanificacionModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const active = sub && SUBS[sub] ? sub : 'carga';
  const tabs: SubTabDef[] = [
    { key: 'carga', label: 'Carga de entregas', icon: UploadCloud },
    { key: 'plan',  label: 'Plan del día (preparación)', icon: ClipboardList },
    { key: 'dia',   label: 'Configuración del día', icon: Settings2 },
  ];
  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'carga' && <CargaEntregasPanel />}
        {active === 'plan' && <PlanDiarioPanel mode="planning" />}
        {active === 'dia' && <DayConfigPanel />}
      </div>
    </div>
  );
}
