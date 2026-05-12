import { useState } from 'react';
import { CalendarDays, PlayCircle } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { CalendarioOperativoPanel } from '../panels/CalendarioOperativoPanel';
import { DiaOperativoPanel } from '../panels/DiaOperativoPanel';
import { ErrorBoundary } from '../ui/ErrorBoundary';

// Ronda 3: 2 tabs en Planificación. Las antiguas (Carga / Dotación / Plan /
// Clientes / Config) se mueven a cards expandibles DENTRO de DiaOperativoPanel.
// Legacy slugs siguen aceptados como entrypoints: vienen via setSub desde
// links/breadcrumbs viejos, y se redirigen a 'dia'.
const SUBS: Record<string, true> = { dia: true, calendario: true };
const LEGACY_PLAN_SUBS = new Set([
  'carga', 'dotacion', 'plan', 'clientes', 'configdia',
]);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function PlanificacionModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  // Las sub-rutas viejas redirigen a 'dia' y la card correspondiente se abre
  // por default dentro del panel (vía openCard).
  const subRaw = sub ?? 'dia';
  const isLegacy = LEGACY_PLAN_SUBS.has(subRaw);
  const active = SUBS[subRaw] ? subRaw : (isLegacy ? 'dia' : 'dia');
  const openCard = isLegacy ? subRaw : null;
  const [fecha, setFecha] = useState(todayISO());
  const tabs: SubTabDef[] = [
    { key: 'dia',        label: 'Día operativo', icon: PlayCircle   },
    { key: 'calendario', label: 'Calendario',    icon: CalendarDays },
  ];
  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto">
        {active === 'dia'        && (
          <ErrorBoundary resetKey={fecha}>
            <DiaOperativoPanel fecha={fecha} onChangeFecha={setFecha} onJumpToTab={setSub} openCard={openCard} />
          </ErrorBoundary>
        )}
        {active === 'calendario' && <CalendarioOperativoPanel selectedISO={fecha} onSelect={setFecha} />}
      </div>
    </div>
  );
}
