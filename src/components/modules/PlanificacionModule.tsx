import { CalendarDays, PlayCircle } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { CalendarioOperativoPanel } from '../panels/CalendarioOperativoPanel';
import { DiaOperativoPanel } from '../panels/DiaOperativoPanel';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useDiaActivo } from '../../hooks/useDiaActivo';

// Ronda 3: 2 tabs en Planificación. Las antiguas (Carga / Dotación / Plan /
// Clientes / Config) se mueven a cards expandibles DENTRO de DiaOperativoPanel.
// Legacy slugs siguen aceptados como entrypoints: vienen via setSub desde
// links/breadcrumbs viejos, y se redirigen a 'dia'.
const SUBS: Record<string, true> = { dia: true, calendario: true };
const LEGACY_PLAN_SUBS = new Set([
  'carga', 'dotacion', 'plan', 'clientes', 'configdia',
]);

export function PlanificacionModule({ sub, setSub, onNavigate }: {
  sub: string | null;
  setSub: (s: string) => void;
  // Navegación cross-módulo (vino de AppShell). Necesaria para los botones
  // contextuales "Ir a Operación" / "Ver resumen" del header del día.
  onNavigate: (module: string, sub?: string) => void;
}) {
  const subRaw = sub ?? 'dia';
  const isLegacy = LEGACY_PLAN_SUBS.has(subRaw);
  const active = SUBS[subRaw] ? subRaw : (isLegacy ? 'dia' : 'dia');
  const openCard = isLegacy ? subRaw : null;
  // R7-P4: la fecha activa la administra el selector global del Topbar.
  const { fecha, setFecha } = useDiaActivo();
  const tabs: SubTabDef[] = [
    { key: 'dia',        label: 'Día operativo', icon: PlayCircle   },
    { key: 'calendario', label: 'Calendario',    icon: CalendarDays },
  ];

  // Maneja los 2 strings especiales que dispara DiaOperativoPanel desde el
  // ContextualButton. Antes esos strings llegaban a setSub() y se ignoraban
  // (Operación es otro módulo, no un sub-tab de Planificación) — el botón
  // de "Ir a Operación" / "Ver resumen" no hacía nada.
  const handleJumpToTab = (key: string) => {
    if (key === 'operacion-jump') {
      onNavigate('operacion');   // ir al módulo Operación, sub default = 'mapa'
      return;
    }
    if (key === 'summary-jump') {
      // Mostrar el "Plan en ejecución" del módulo Operación con la data del
      // día CERRADO (es el drawer existente con todas las visitas + stats).
      onNavigate('operacion', 'plan');
      return;
    }
    setSub(key);
  };
  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto">
        {active === 'dia'        && (
          <ErrorBoundary resetKey={fecha}>
            <DiaOperativoPanel fecha={fecha} onChangeFecha={setFecha} onJumpToTab={handleJumpToTab} openCard={openCard} />
          </ErrorBoundary>
        )}
        {active === 'calendario' && <CalendarioOperativoPanel selectedISO={fecha} onSelect={setFecha} />}
      </div>
    </div>
  );
}
