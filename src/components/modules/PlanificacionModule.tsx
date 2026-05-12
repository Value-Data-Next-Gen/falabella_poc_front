import { useState } from 'react';
import { CalendarDays, ClipboardList, Settings2, Sliders, UploadCloud, Users, UsersRound } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { CargaEntregasPanel } from '../panels/CargaEntregasPanel';
import { CalendarioOperativoPanel } from '../panels/CalendarioOperativoPanel';
import { PlanDelDiaSimplePanel } from '../panels/PlanDelDiaSimplePanel';
import { ClientesDelDiaPanel } from '../panels/ClientesDelDiaPanel';
import { ConfigDelDiaPanel } from '../panels/ConfigDelDiaPanel';
import { DayConfigPanel } from '../DayConfigPanel';
import { DotacionPanel } from '../panels/DotacionPanel';
import { WizardDelDia } from '../panels/WizardDelDia';

const SUBS: Record<string, true> = {
  calendario: true, carga: true, dotacion: true, plan: true,
  clientes: true, configdia: true, dia: true,
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function PlanificacionModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const active = sub && SUBS[sub] ? sub : 'calendario';
  // Fecha operativa global del módulo: todos los paneles la usan.
  const [fecha, setFecha] = useState(todayISO());
  const tabs: SubTabDef[] = [
    { key: 'calendario', label: '1. Calendario',           icon: CalendarDays  },
    { key: 'carga',      label: '2. Carga de entregas',    icon: UploadCloud   },
    { key: 'dotacion',   label: '3. Dotación del día',     icon: Users         },
    { key: 'plan',       label: '4. Plan del día',         icon: ClipboardList },
    { key: 'clientes',   label: '5. Clientes del día',     icon: UsersRound    },
    { key: 'configdia',  label: '6. Config del día',       icon: Sliders       },
    { key: 'dia',        label: 'Avanzada',                icon: Settings2     },
  ];
  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        <WizardDelDia
          fecha={fecha}
          onChangeFecha={setFecha}
          onJumpToTab={setSub}
        />
        {active === 'carga'      && <CargaEntregasPanel initialFecha={fecha} onFechaChange={setFecha} />}
        {active === 'calendario' && <CalendarioOperativoPanel selectedISO={fecha} onSelect={setFecha} />}
        {active === 'plan'       && <PlanDelDiaSimplePanel fecha={fecha} />}
        {active === 'clientes'   && <ClientesDelDiaPanel fecha={fecha} />}
        {active === 'configdia'  && <ConfigDelDiaPanel fecha={fecha} />}
        {active === 'dotacion'   && <DotacionPanel initialFecha={fecha} />}
        {active === 'dia'        && <DayConfigPanel />}
      </div>
    </div>
  );
}
