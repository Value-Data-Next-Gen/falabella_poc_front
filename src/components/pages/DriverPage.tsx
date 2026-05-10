import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, GraduationCap, Truck, User } from 'lucide-react';
import { api } from '../../api';

type TabKey = 'datos' | 'documentos' | 'capacitaciones';

interface DriverPageProps {
  empresaId: number;
  driverId: string;
  onBack: () => void;
}

export function DriverPage({ empresaId, driverId, onBack }: DriverPageProps) {
  const [tab, setTab] = useState<TabKey>('datos');
  const driversQ = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: api.admin.listDrivers,
  });
  const driver = (driversQ.data ?? []).find(d => d.driver_id === driverId);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header con breadcrumb */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
                className="btn !py-1 !px-2 text-[11px] flex items-center gap-1">
          <ArrowLeft size={12} /> Empresa #{empresaId}
        </button>
        <div className="flex items-center gap-2">
          <User size={18} className="text-accent-violet" />
          <div>
            <div className="text-[15px] font-semibold tracking-tight">
              {driver?.name ?? driverId}
            </div>
            <div className="text-[11px] text-text-muted font-mono">
              {driverId}
              {driver && (
                <>
                  {' · '}
                  <Truck size={10} className="inline mb-0.5" /> {driver.vehicle_name} #{driver.vehicle_id}
                  {' · '}
                  <span className={driver.active ? 'text-accent-green' : 'text-accent-red'}>
                    {driver.active ? 'Activo' : 'Inactivo'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line">
        {([
          { key: 'datos',          label: 'Datos',          icon: User         },
          { key: 'documentos',     label: 'Documentos',     icon: FileText     },
          { key: 'capacitaciones', label: 'Capacitaciones', icon: GraduationCap },
        ] as { key: TabKey; label: string; icon: any }[]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[12px] uppercase tracking-wider border-b-2 ${
                tab === t.key
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'datos' && <DatosTab driverId={driverId} />}
        {tab === 'documentos' && <DocumentosTabPlaceholder />}
        {tab === 'capacitaciones' && <CapacitacionesTabPlaceholder />}
      </div>
    </div>
  );
}

function DatosTab({ driverId }: { driverId: string }) {
  const driversQ = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: api.admin.listDrivers,
  });
  const d = (driversQ.data ?? []).find(x => x.driver_id === driverId);
  if (!d) return <div className="panel p-6 text-text-muted text-xs">Cargando…</div>;

  return (
    <div className="panel p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
      <KV label="ID"             value={d.driver_id} mono />
      <KV label="Nombre"         value={d.name} />
      <KV label="Teléfono"       value={d.phone ?? '—'} mono />
      <KV label="Licencia"       value={d.license ?? '—'} />
      <KV label="Empresa"        value={`${d.empresa_nombre ?? '—'} (#${d.empresa_id ?? '—'})`} />
      <KV label="Vehículo"       value={`${d.vehicle_name} #${d.vehicle_id}`} />
      <KV label="Rating"         value={d.rating?.toFixed(2) ?? '—'} />
      <KV label="Entregas 30d"   value={String(d.deliveries_30d ?? 0)} />
      <KV label="Fail rate 30d"  value={`${((d.fail_rate_30d ?? 0) * 100).toFixed(1)}%`} />
      <KV label="Activo desde"   value={d.joined_at ?? '—'} />
      <KV label="Estado"         value={d.active ? 'Activo' : 'Inactivo'}
          tone={d.active ? 'green' : 'red'} />
    </div>
  );
}

function KV({ label, value, mono, tone }: {
  label: string; value: string; mono?: boolean;
  tone?: 'green' | 'red';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className={`${mono ? 'font-mono' : ''} ${
        tone === 'green' ? 'text-accent-green' : tone === 'red' ? 'text-accent-red' : ''
      }`}>{value}</span>
    </div>
  );
}

function DocumentosTabPlaceholder() {
  return (
    <div className="panel p-8 text-center text-text-muted text-xs">
      <FileText size={32} className="mx-auto mb-2 text-text-muted/40" />
      <div>Subida de documentos del driver — Sprint 2</div>
      <div className="text-[10px] mt-1">
        Próximamente: licencia de conducir, antecedentes, póliza, contrato. Storage en Azure Blob.
      </div>
    </div>
  );
}

function CapacitacionesTabPlaceholder() {
  return (
    <div className="panel p-8 text-center text-text-muted text-xs">
      <GraduationCap size={32} className="mx-auto mb-2 text-text-muted/40" />
      <div>Capacitaciones del driver — Sprint 3</div>
      <div className="text-[10px] mt-1">
        Próximamente: catálogo de módulos (manejo defensivo, carga peligrosa…) con fecha completada y vencimiento.
      </div>
    </div>
  );
}
