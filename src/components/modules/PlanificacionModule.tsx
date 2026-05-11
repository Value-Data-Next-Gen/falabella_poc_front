import { CalendarDays, ClipboardList, Settings2, UploadCloud, Users } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { CargaEntregasPanel } from '../panels/CargaEntregasPanel';
import { CalendarioOperativoPanel } from '../panels/CalendarioOperativoPanel';
import { PlanDiarioPanel } from '../PlanDiarioPanel';
import { DayConfigPanel } from '../DayConfigPanel';
import { DotacionPanel } from '../panels/DotacionPanel';

const SUBS: Record<string, true> = { carga: true, calendario: true, plan: true, dotacion: true, dia: true };

export function PlanificacionModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const active = sub && SUBS[sub] ? sub : 'carga';
  const tabs: SubTabDef[] = [
    { key: 'carga',      label: 'Carga de entregas',          icon: UploadCloud   },
    { key: 'calendario', label: 'Calendario operativo',       icon: CalendarDays  },
    { key: 'plan',       label: 'Plan del día (preparación)', icon: ClipboardList },
    { key: 'dotacion',   label: 'Dotación del día',           icon: Users         },
    { key: 'dia',        label: 'Configuración del día',      icon: Settings2     },
  ];
  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'carga'      && <CargaEntregasPanel />}
        {active === 'calendario' && <CalendarioOperativoPanel />}
        {active === 'plan'       && <PlanDiarioPanel mode="planning" />}
        {active === 'dotacion'   && <DotacionPanel />}
        {active === 'dia'        && <DayConfigPanel />}
      </div>
    </div>
  );
}
