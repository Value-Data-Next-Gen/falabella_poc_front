import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2 } from 'lucide-react';
import { api } from '../../api';
import {
  ContactosTab, CSVTab, BroadcastTab, DriversForEmpresaTab, VehiclesForEmpresaTab,
} from '../EmpresasTransportistasPanel';

type TabKey = 'drivers' | 'vehiculos' | 'contactos' | 'csv' | 'broadcast';

interface EmpresaPageProps {
  empresaId: number;
  onBack: () => void;
  onOpenDriver: (driverId: string) => void;
}

export function EmpresaPage({ empresaId, onBack, onOpenDriver }: EmpresaPageProps) {
  const [tab, setTab] = useState<TabKey>('drivers');
  const empresasQ = useQuery({
    queryKey: ['empresa-contactos-list'],
    queryFn: api.empresaContactos.listEmpresas,
  });
  const empresa = (empresasQ.data ?? []).find(e => e.empresa_id === empresaId);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header con breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
                className="btn !py-1 !px-2 text-[11px] flex items-center gap-1">
          <ArrowLeft size={12} /> Empresas
        </button>
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-accent-blue" />
          <div>
            <div className="text-[15px] font-semibold tracking-tight">
              {empresa?.nombre ?? `Empresa #${empresaId}`}
            </div>
            <div className="text-[11px] text-text-muted">
              ID #{empresaId}
              {empresa && ` · ${empresa.contactos_count} contactos · ${empresa.opted_in_count} opt-in`}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line">
        {([
          { key: 'drivers',   label: 'Drivers' },
          { key: 'vehiculos', label: 'Vehículos' },
          { key: 'contactos', label: 'Contactos' },
          { key: 'csv',       label: 'CSV (contactos)' },
          { key: 'broadcast', label: 'Broadcast' },
        ] as { key: TabKey; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-[12px] uppercase tracking-wider border-b-2 ${
              tab === t.key
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'drivers'   && <DriversForEmpresaTab empresaId={empresaId} onOpenDriver={onOpenDriver} />}
        {tab === 'vehiculos' && <VehiclesForEmpresaTab empresaId={empresaId} />}
        {tab === 'contactos' && <ContactosTab empresaId={empresaId} />}
        {tab === 'csv'       && <CSVTab empresaId={empresaId} />}
        {tab === 'broadcast' && empresa && <BroadcastTab empresa={empresa} />}
      </div>
    </div>
  );
}
