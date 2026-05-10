import { Building2, Star, Users, AlertTriangle } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { useAuth } from '../../hooks/useAuth';
import {
  AdminGuard, UsersTab, VipTab,
} from '../MastersPanel';
import { EmpresasTransportistasPanel } from '../EmpresasTransportistasPanel';
import { EmpresaPage } from '../pages/EmpresaPage';
import { DriverPage } from '../pages/DriverPage';
import { MotivosConfigPanel } from '../MotivosConfigPanel';

// Drivers y Vehículos no son tabs separadas: viven dentro de cada empresa.
// Sub-rutas:
//   empresas                          → listado con búsqueda
//   empresas/:id                      → página de empresa (drivers + vehículos)
//   empresas/:id/drivers/:driver_id   → página de driver (datos + docs + capacitaciones)
const TOP_TABS = ['empresas', 'vips', 'users', 'motivos'] as const;

export function MaestrosModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const { isFalabella } = useAuth();

  // Parse sub: "empresas/22/drivers/DRV-001" → ["empresas", "22", "drivers", "DRV-001"]
  const parts = (sub ?? '').split('/').filter(Boolean);
  const topKey = (TOP_TABS as readonly string[]).includes(parts[0] ?? '') ? parts[0]! : 'empresas';
  const empresaId = topKey === 'empresas' && parts[1] ? Number(parts[1]) : null;
  const driverId = topKey === 'empresas' && parts[2] === 'drivers' && parts[3] ? parts[3] : null;

  const tabs: SubTabDef[] = [
    { key: 'empresas',  label: 'Empresas (drivers + vehículos)', icon: Building2 },
    { key: 'vips',      label: 'Clientes VIP',                   icon: Star,         hidden: !isFalabella },
    { key: 'users',     label: 'Usuarios',                       icon: Users,        hidden: !isFalabella },
    { key: 'motivos',   label: 'Catálogo motivos',               icon: AlertTriangle, hidden: !isFalabella },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={topKey} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {topKey === 'empresas' && !empresaId && <EmpresasTransportistasPanel onOpen={id => setSub(`empresas/${id}`)} />}
        {topKey === 'empresas' && empresaId && !driverId && (
          <EmpresaPage
            empresaId={empresaId}
            onBack={() => setSub('empresas')}
            onOpenDriver={did => setSub(`empresas/${empresaId}/drivers/${did}`)}
          />
        )}
        {topKey === 'empresas' && empresaId && driverId && (
          <DriverPage
            empresaId={empresaId}
            driverId={driverId}
            onBack={() => setSub(`empresas/${empresaId}`)}
          />
        )}
        {topKey === 'vips'    && <AdminGuard><VipTab /></AdminGuard>}
        {topKey === 'users'   && <AdminGuard><UsersTab /></AdminGuard>}
        {topKey === 'motivos' && <MotivosConfigPanel />}
      </div>
    </div>
  );
}
