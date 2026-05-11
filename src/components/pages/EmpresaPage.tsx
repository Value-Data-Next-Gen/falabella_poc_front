import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Pencil, Phone } from 'lucide-react';
import { api } from '../../api';
import {
  ContactosTab, CSVTab, BroadcastTab, DriversForEmpresaTab, VehiclesForEmpresaTab,
} from '../EmpresasTransportistasPanel';
import { Modal } from '../shared/Modal';
import { EntityDocumentsTab } from '../shared/EntityDocumentsTab';
import { useAuth } from '../../hooks/useAuth';

type TabKey = 'drivers' | 'vehiculos' | 'documentos' | 'contactos' | 'csv' | 'broadcast';

interface EmpresaPageProps {
  empresaId: number;
  onBack: () => void;
  onOpenDriver: (driverId: string) => void;
}

export function EmpresaPage({ empresaId, onBack, onOpenDriver }: EmpresaPageProps) {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TabKey>('drivers');
  const [editing, setEditing] = useState(false);
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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Building2 size={18} className="text-accent-blue" />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold tracking-tight">
              {empresa?.nombre ?? `Empresa #${empresaId}`}
            </div>
            <div className="text-[11px] text-text-muted flex items-center gap-2 flex-wrap">
              <span>ID #{empresaId}</span>
              {empresa && (
                <>
                  <span>·</span>
                  <span>{empresa.contactos_count} contactos · {empresa.opted_in_count} opt-in</span>
                </>
              )}
              {empresa?.central_phone && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Phone size={10} /> Central <span className="font-mono">{empresa.central_phone}</span>
                  </span>
                </>
              )}
            </div>
          </div>
          {isAdmin && (
            <button onClick={() => setEditing(true)}
                    className="btn !py-1 !px-2 text-[11px] flex items-center gap-1">
              <Pencil size={11} /> Editar empresa
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line">
        {([
          { key: 'drivers',    label: 'Drivers' },
          { key: 'vehiculos',  label: 'Vehículos' },
          { key: 'documentos', label: 'Documentos' },
          { key: 'contactos',  label: 'Contactos' },
          { key: 'csv',        label: 'CSV (contactos)' },
          { key: 'broadcast',  label: 'Broadcast' },
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
        {tab === 'drivers'    && <DriversForEmpresaTab empresaId={empresaId} onOpenDriver={onOpenDriver} />}
        {tab === 'vehiculos'  && <VehiclesForEmpresaTab empresaId={empresaId} />}
        {tab === 'documentos' && <EntityDocumentsTab entityType="empresa" entityId={empresaId} label="esta empresa" />}
        {tab === 'contactos'  && <ContactosTab empresaId={empresaId} />}
        {tab === 'csv'        && <CSVTab empresaId={empresaId} />}
        {tab === 'broadcast'  && empresa && <BroadcastTab empresa={empresa} />}
      </div>

      {editing && empresa && (
        <EmpresaEditModal
          empresaId={empresaId}
          initial={empresa}
          onClose={() => setEditing(false)}
          onSaved={() => setEditing(false)}
        />
      )}
    </div>
  );
}


function EmpresaEditModal({ empresaId, initial, onClose, onSaved }: {
  empresaId: number;
  initial: { nombre: string; activo: boolean; central_phone: string | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(initial.nombre);
  const [activo, setActivo] = useState(initial.activo);
  const [centralPhone, setCentralPhone] = useState(initial.central_phone ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await api.admin.updateEmpresa(empresaId, {
        nombre,
        activo,
        central_phone: centralPhone.trim() || '',
      });
      qc.invalidateQueries({ queryKey: ['empresa-contactos-list'] });
      qc.invalidateQueries({ queryKey: ['admin-empresas'] });
      onSaved();
    } catch (ex: any) {
      setErr(ex?.message ?? 'error');
      setSaving(false);
    }
  };

  return (
    <Modal title={`Editar empresa #${empresaId}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 text-[12px]">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Nombre</span>
          <input className="input" required value={nombre}
                 onChange={e => setNombre(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
            <Phone size={10} /> Teléfono central / despachador (opcional)
          </span>
          <input className="input font-mono" value={centralPhone}
                 placeholder="+56..."
                 onChange={e => setCentralPhone(e.target.value)} />
          <span className="text-[10px] text-text-muted">
            Si la empresa tiene un número central de dispatch, ponelo acá. Los mensajes WhatsApp
            entrantes desde este número se tratan como del despachador (puede enviar/recibir
            mensajes hacia/desde sus drivers).
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={activo}
                 onChange={e => setActivo(e.target.checked)} />
          Activa
        </label>
        {err && <div className="text-accent-red text-[11px]">{err}</div>}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </Modal>
  );
}
