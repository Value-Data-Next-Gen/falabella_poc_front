import { Building2, Star, Truck, User, Users, AlertTriangle } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { useAuth } from '../../hooks/useAuth';
import {
  AdminGuard, DriversTab, EmpresasTab, UsersTab, VehiclesTab, VipTab,
} from '../MastersPanel';
import { EmpresasTransportistasPanel } from '../EmpresasTransportistasPanel';
import { MotivosConfigPanel } from '../MotivosConfigPanel';

const SUB_DEFAULTS: Record<string, string> = {
  empresas: 'Empresas y contactos',
  vehiculos: 'Vehículos',
  drivers: 'Drivers',
  vips: 'Clientes VIP',
  users: 'Usuarios',
  motivos: 'Catálogo motivos',
};

export function MaestrosModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const { isFalabella } = useAuth();
  const active = sub && SUB_DEFAULTS[sub] ? sub : 'empresas';

  const tabs: SubTabDef[] = [
    { key: 'empresas',  label: 'Empresas y contactos', icon: Building2 },
    { key: 'vehiculos', label: 'Vehículos',            icon: Truck,  hidden: !isFalabella },
    { key: 'drivers',   label: 'Drivers',              icon: User,   hidden: !isFalabella },
    { key: 'vips',      label: 'Clientes VIP',         icon: Star,   hidden: !isFalabella },
    { key: 'users',     label: 'Usuarios',             icon: Users,  hidden: !isFalabella },
    { key: 'motivos',   label: 'Catálogo motivos',     icon: AlertTriangle, hidden: !isFalabella },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'empresas'  && <EmpresasTransportistasPanel />}
        {active === 'vehiculos' && <AdminGuard><VehiclesTab /></AdminGuard>}
        {active === 'drivers'   && <AdminGuard><DriversTab /></AdminGuard>}
        {active === 'vips'      && <AdminGuard><VipTab /></AdminGuard>}
        {active === 'users'     && <AdminGuard><UsersTab /></AdminGuard>}
        {active === 'motivos'   && <MotivosConfigPanel />}
      </div>
    </div>
  );
}
