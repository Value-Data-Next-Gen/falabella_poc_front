import { Building2, Star, Users, AlertTriangle } from 'lucide-react';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { useAuth } from '../../hooks/useAuth';
import {
  AdminGuard, EmpresasTab, UsersTab, VipTab,
} from '../MastersPanel';
import { EmpresasTransportistasPanel } from '../EmpresasTransportistasPanel';
import { MotivosConfigPanel } from '../MotivosConfigPanel';

// Drivers y Vehículos no son tabs separadas: viven dentro del drawer de Empresa
// (jerarquía empresa → fleet hijos). Ver EmpresasTransportistasPanel.
const SUB_DEFAULTS: Record<string, string> = {
  empresas: 'Empresas y contactos',
  vips: 'Clientes VIP',
  users: 'Usuarios',
  motivos: 'Catálogo motivos',
};

export function MaestrosModule({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const { isFalabella } = useAuth();
  const active = sub && SUB_DEFAULTS[sub] ? sub : 'empresas';

  const tabs: SubTabDef[] = [
    { key: 'empresas',  label: 'Empresas (drivers + vehículos)', icon: Building2 },
    { key: 'vips',      label: 'Clientes VIP',                   icon: Star,         hidden: !isFalabella },
    { key: 'users',     label: 'Usuarios',                       icon: Users,        hidden: !isFalabella },
    { key: 'motivos',   label: 'Catálogo motivos',               icon: AlertTriangle, hidden: !isFalabella },
  ];

  return (
    <div className="h-full flex flex-col">
      <SubTabs tabs={tabs} active={active} onChange={setSub} />
      <div className="flex-1 overflow-auto p-4">
        {active === 'empresas'  && <EmpresasTransportistasPanel />}
        {active === 'vips'      && <AdminGuard><VipTab /></AdminGuard>}
        {active === 'users'     && <AdminGuard><UsersTab /></AdminGuard>}
        {active === 'motivos'   && <MotivosConfigPanel />}
      </div>
    </div>
  );
}
