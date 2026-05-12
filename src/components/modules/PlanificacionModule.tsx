import { useState } from 'react';
import { CalendarDays, ClipboardList, PlayCircle, Sliders, UploadCloud, Users, UsersRound } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { CargaEntregasPanel } from '../panels/CargaEntregasPanel';
import { CalendarioOperativoPanel } from '../panels/CalendarioOperativoPanel';
import { PlanDelDiaSimplePanel } from '../panels/PlanDelDiaSimplePanel';
import { ClientesDelDiaPanel } from '../panels/ClientesDelDiaPanel';
import { ConfigDelDiaPanel } from '../panels/ConfigDelDiaPanel';
import { DiaOperativoPanel } from '../panels/DiaOperativoPanel';
import { DotacionPanel } from '../panels/DotacionPanel';

const SUBS: Record<string, true> = {
  dia: true, calendario: true, carga: true, dotacion: true,
  plan: true, clientes: true, configdia: true,
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function PlanificacionModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const active = sub && SUBS[sub] ? sub : 'dia';
  // Fecha operativa global del módulo: todos los paneles la usan.
  const [fecha, setFecha] = useState(todayISO());
  // Tabs ordenadas: Día como entrada principal, después detalles.
  // Calendario y "Avanzada" se mueven a otros lugares per brief.
  const tabs: SubTabDef[] = [
    { key: 'dia',        label: 'Día operativo',     icon: PlayCircle    },
    { key: 'calendario', label: 'Calendario',        icon: CalendarDays  },
    { key: 'carga',      label: 'Carga de entregas', icon: UploadCloud   },
    { key: 'dotacion',   label: 'Dotación',          icon: Users         },
    { key: 'plan',       label: 'Plan del día',      icon: ClipboardList },
    { key: 'clientes',   label: 'Clientes del día',  icon: UsersRound    },
    { key: 'configdia',  label: 'Config del día',    icon: Sliders       },
  ];
  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto">
        {active === 'dia'        && <DiaOperativoPanel fecha={fecha} onChangeFecha={setFecha} onJumpToTab={setSub} />}
        {active === 'calendario' && <CalendarioOperativoPanel selectedISO={fecha} onSelect={setFecha} />}
        {active === 'carga'      && <CargaEntregasPanel initialFecha={fecha} onFechaChange={setFecha} />}
        {active === 'plan'       && <PlanDelDiaSimplePanel fecha={fecha} />}
        {active === 'clientes'   && <ClientesDelDiaPanel fecha={fecha} />}
        {active === 'configdia'  && <ConfigDelDiaPanel fecha={fecha} />}
        {active === 'dotacion'   && <DotacionPanel initialFecha={fecha} />}
      </div>
    </div>
  );
}
