import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BulkXlsxButtons } from './shared/BulkXlsxButtons';
import { Modal } from './shared/Modal';
import {
  Building2, CheckCircle2, Clock, Download, FileWarning, Pencil, Plus, Send,
  ShieldAlert, Trash2, Upload, UserCheck, X,
} from 'lucide-react';
import { api } from '../api';
import {
  AdminDriver, AdminVehicle, BulkCSVResult, Contacto, ContactoCreate,
  ContactoRegion, ContactoRol, EmpresaSummary, MotivoSeverity, TestBroadcastResult,
} from '../types';
import { useAuth } from '../hooks/useAuth';

const ROL_META: Record<ContactoRol, { label: string; cls: string }> = {
  jefe:        { label: 'Jefe',         cls: 'pill-violet' },
  coordinador: { label: 'Coordinador',  cls: 'pill-blue' },
  dispatcher:  { label: 'Dispatcher',   cls: 'pill-blue' },
  driver:      { label: 'Driver',       cls: 'pill-green' },
  otro:        { label: 'Otro',         cls: 'bg-bg-700 text-text-secondary border border-line px-2 py-0.5 rounded text-[10px]' },
};

const REGION_META: Record<ContactoRegion, string> = {
  RM: 'Solo RM',
  regiones: 'Solo regiones',
  all: 'Todas',
};

const SEVERITY_OPTIONS: MotivoSeverity[] = ['low', 'medium', 'high', 'critical'];
const ROL_OPTIONS: ContactoRol[] = ['jefe', 'coordinador', 'dispatcher', 'driver', 'otro'];

// Lista oficial de motivos (espejo del backend MOTIVOS_CATALOGO).
const MOTIVOS_CATALOGO = [
  'SIN MORADORES',
  'NO CONOCEN A CLIENTE',
  'PROBLEMA DE DIRECCIÓN/ SIN INFORMACIÓN',
  'NO DESPACHA A LOCALIDAD',
  'FUERA DE COBERTURA/ FRECUENCIA',
  'PROD NO ENTREGADO POR TIEMPO',
  'PRODUCTO NO CARGADO',
  'CLIENTE RECHAZA',
  'SINIESTRO EN CALLE',
  'PRODUCTO CON PROBLEMAS',
  'NO CUMPLE CONDICIONES RETIRO',
  'PRODUCTO ROBADO',
];


export function EmpresasTransportistasPanel({ onOpen }: { onOpen?: (empresaId: number) => void } = {}) {
  const { isFalabella } = useAuth();
  const empresasQ = useQuery({
    queryKey: ['empresa-contactos-list'],
    queryFn: api.empresaContactos.listEmpresas,
    enabled: isFalabella,
  });
  const [search, setSearch] = useState('');

  if (!isFalabella) {
    return (
      <div className="panel p-6 text-center text-text-muted">
        <ShieldAlert size={32} className="mx-auto mb-2 text-accent-yellow" />
        <div>
          Esta sección requiere rol{' '}
          <span className="text-accent-yellow">falabella_admin</span> o{' '}
          <span className="text-accent-yellow">falabella_ops</span>.
        </div>
      </div>
    );
  }

  const downloadGlobalTemplate = () => {
    api.empresaContactos.downloadCsvTemplate(0).catch(() => void 0);
  };

  const all = empresasQ.data ?? [];
  const filtered = search.trim()
    ? all.filter(e => {
        const q = search.trim().toLowerCase();
        return e.nombre.toLowerCase().includes(q) || String(e.empresa_id).includes(q);
      })
    : all;

  const open = (id: number) => {
    if (onOpen) onOpen(id);
    else window.location.hash = `#/maestros/empresas/${id}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Building2 size={16} /> Empresas transportistas
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Click en una empresa para gestionar sus drivers, vehículos, contactos y alertas WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="search"
            placeholder="Buscar por nombre o ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !py-1.5 !text-[12px] w-64"
          />
          <button onClick={downloadGlobalTemplate}
                  className="btn text-xs flex items-center gap-1">
            <Download size={12} /> CSV template
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title flex items-center justify-between">
          <span>{filtered.length}{search ? ` / ${all.length}` : ''} empresas</span>
        </div>
        {empresasQ.isLoading || !empresasQ.data ? (
          <div className="p-4 text-text-muted text-xs">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-text-muted text-xs italic text-center">
            {search ? `Sin resultados para "${search}"` : 'No hay empresas. Creá una desde el panel de admin.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-line">
              <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Contactos</th>
                <th className="px-3 py-2 text-left">Con opt-in</th>
                <th className="px-3 py-2 text-left">Última alerta</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr
                  key={e.empresa_id}
                  className="border-b border-line/50 hover:bg-bg-700/30 cursor-pointer"
                  onClick={() => open(e.empresa_id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-semibold">{e.nombre}</div>
                    <div className="text-text-muted text-[10px]">#{e.empresa_id}</div>
                  </td>
                  <td className="px-3 py-2">{e.contactos_count}</td>
                  <td className="px-3 py-2">
                    <span className={`pill ${e.opted_in_count > 0 ? 'pill-green' : 'pill-red'}`}>
                      {e.opted_in_count}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {e.last_alert_at
                      ? new Date(e.last_alert_at).toLocaleString('es-CL')
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={ev => { ev.stopPropagation(); open(e.empresa_id); }}
                      className="text-accent-blue hover:underline text-xs"
                    >
                      Abrir →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


// =============================================================================
// Drawer lateral
// =============================================================================
type DrawerTab = 'contactos' | 'drivers' | 'vehiculos' | 'csv' | 'broadcast';

function EmpresaDrawer({ empresa, onClose }: { empresa: EmpresaSummary; onClose: () => void }) {
  const [tab, setTab] = useState<DrawerTab>('contactos');

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <aside
        onClick={e => e.stopPropagation()}
        className="relative bg-bg-800 border-l border-line w-[640px] max-w-full h-full overflow-auto flex flex-col"
      >
        <header className="px-4 py-3 border-b border-line flex items-center justify-between sticky top-0 bg-bg-800 z-10">
          <div>
            <div className="text-sm font-semibold">{empresa.nombre}</div>
            <div className="text-[10px] text-text-muted">
              empresa #{empresa.empresa_id} · {empresa.contactos_count} contactos · {empresa.opted_in_count} con opt-in
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </header>

        <div className="flex border-b border-line">
          {[
            { key: 'contactos' as const, label: 'Contactos' },
            { key: 'drivers' as const,   label: 'Drivers' },
            { key: 'vehiculos' as const, label: 'Vehículos' },
            { key: 'csv' as const,       label: 'CSV' },
            { key: 'broadcast' as const, label: 'Broadcast' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-2 py-2 text-[11px] uppercase tracking-wider border-b-2 ${
                tab === t.key
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-auto">
          {tab === 'contactos' && <ContactosTab empresaId={empresa.empresa_id} />}
          {tab === 'drivers' && <DriversForEmpresaTab empresaId={empresa.empresa_id} />}
          {tab === 'vehiculos' && <VehiclesForEmpresaTab empresaId={empresa.empresa_id} />}
          {tab === 'csv' && <CSVTab empresaId={empresa.empresa_id} />}
          {tab === 'broadcast' && <BroadcastTab empresa={empresa} />}
        </div>
      </aside>
    </div>
  );
}


// =============================================================================
// Tab: Drivers de la empresa (con bulk Excel)
// =============================================================================
export function DriversForEmpresaTab({ empresaId, onOpenDriver }: {
  empresaId: number;
  onOpenDriver?: (driverId: string) => void;
}) {
  const qc = useQueryClient();
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<AdminDriver | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const driversQ = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: api.admin.listDrivers,
  });
  const vehiclesQ = useQuery({
    queryKey: ['admin-vehicles'],
    queryFn: api.admin.listVehicles,
  });
  const allOfEmpresa = (driversQ.data ?? [])
    .filter(d => d.empresa_id === empresaId)
    .filter(d => !onlyActive || d.active);
  const drivers = search.trim()
    ? allOfEmpresa.filter(d => {
        const q = search.trim().toLowerCase();
        return d.driver_id.toLowerCase().includes(q)
            || d.name.toLowerCase().includes(q)
            || (d.phone ?? '').toLowerCase().includes(q);
      })
    : allOfEmpresa;
  const vehiclesOfEmpresa = (vehiclesQ.data ?? []).filter(v => v.empresa_id === empresaId);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-drivers'] });

  const delMut = useMutation({
    mutationFn: (id: string) => api.admin.deleteDriver(id),
    onSuccess: refresh,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-xs text-text-muted">
            {drivers.length}{search ? ` / ${allOfEmpresa.length}` : ''} drivers
          </div>
          <label className="flex items-center gap-1 text-[11px] cursor-pointer">
            <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />
            Solo activos
          </label>
          <input
            type="search"
            placeholder="Buscar driver..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !py-1 !text-[11px] w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreating(true)} className="btn-primary text-[11px] flex items-center gap-1">
            <Plus size={11} /> Agregar driver
          </button>
          <BulkXlsxButtons
            downloadPath={`/admin/drivers/template?empresa_id=${empresaId}`}
            filename={`drivers_${empresaId}.xlsx`}
            uploadPath={`/admin/drivers/upload?empresa_id=${empresaId}`}
            onUploaded={refresh}
          />
        </div>
      </div>
      {driversQ.isLoading ? (
        <div className="text-text-muted text-xs">Cargando…</div>
      ) : drivers.length === 0 ? (
        <div className="text-text-muted text-xs italic py-6 text-center">
          Sin drivers en esta empresa. Agregá uno con el botón de arriba o subí un XLSX en bulk.
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-2 py-1.5 text-left">ID</th>
              <th className="px-2 py-1.5 text-left">Nombre</th>
              <th className="px-2 py-1.5 text-left">Vehículo</th>
              <th className="px-2 py-1.5 text-center">Activo</th>
              <th className="px-2 py-1.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map(d => (
              <tr
                key={d.driver_id}
                className={`border-b border-line/50 ${onOpenDriver ? 'hover:bg-bg-700/30 cursor-pointer' : ''}`}
                onClick={onOpenDriver ? () => onOpenDriver(d.driver_id) : undefined}
              >
                <td className="px-2 py-1.5 font-mono text-[10px] text-text-muted">{d.driver_id}</td>
                <td className="px-2 py-1.5">{d.name}</td>
                <td className="px-2 py-1.5">{d.vehicle_name} <span className="text-text-muted">#{d.vehicle_id}</span></td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`pill ${d.active ? 'pill-green' : 'pill-red'}`}>
                    {d.active ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={ev => { ev.stopPropagation(); setEditing(d); }} className="text-accent-blue hover:underline">
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={ev => {
                        ev.stopPropagation();
                        if (confirm(`Eliminar driver ${d.name} (${d.driver_id})?`)) delMut.mutate(d.driver_id);
                      }}
                      className="text-accent-red hover:underline"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <DriverFormModal
          empresaId={empresaId}
          vehicles={vehiclesOfEmpresa}
          onClose={() => setCreating(false)}
          onSaved={() => { refresh(); setCreating(false); }}
        />
      )}
      {editing && (
        <DriverFormModal
          empresaId={empresaId}
          vehicles={vehiclesOfEmpresa}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); setEditing(null); }}
        />
      )}
    </div>
  );
}


function DriverFormModal({ empresaId, vehicles, initial, onClose, onSaved }: {
  empresaId: number;
  vehicles: AdminVehicle[];
  initial?: AdminDriver;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [driver_id, setDriverId] = useState(initial?.driver_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [license, setLicense] = useState(initial?.license ?? '');
  const [vehicle_id, setVehicleId] = useState<number>(initial?.vehicle_id ?? (vehicles[0]?.vehicle_id ?? 0));
  const [active, setActive] = useState(initial?.active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      const v = vehicles.find(x => x.vehicle_id === vehicle_id);
      if (isEdit) {
        await api.admin.updateDriver(initial!.driver_id, {
          name, phone, license, empresa_id: empresaId,
          vehicle_id, vehicle_name: v?.name ?? '',
          active,
        });
      } else {
        await api.admin.createDriver({
          driver_id, name, phone: phone || null, license: license || null,
          empresa_id: empresaId, vehicle_id, vehicle_name: v?.name ?? '',
          rating: 0, deliveries_30d: 0, fail_rate_30d: 0,
          joined_at: null, active, is_problem_hidden: false,
          empresa_nombre: null,
        });
      }
      onSaved();
    } catch (ex: any) {
      setErr(ex?.message ?? 'error guardando');
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Editar driver ${initial!.driver_id}` : 'Nuevo driver'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 text-[12px]">
        {!isEdit && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">ID (único, ej: DRV-005)</span>
            <input className="input" required value={driver_id}
                   onChange={e => setDriverId(e.target.value)} />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Nombre</span>
          <input className="input" required value={name} onChange={e => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Teléfono</span>
            <input className="input" value={phone ?? ''} onChange={e => setPhone(e.target.value)}
                   placeholder="+56..." />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Licencia</span>
            <input className="input" value={license ?? ''} onChange={e => setLicense(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Vehículo asignado</span>
          <select className="input" value={vehicle_id}
                  onChange={e => setVehicleId(Number(e.target.value))} required>
            {vehicles.length === 0 && <option value={0}>— sin vehículos en esta empresa —</option>}
            {vehicles.map(v => (
              <option key={v.vehicle_id} value={v.vehicle_id}>
                #{v.vehicle_id} — {v.name} ({v.plate})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          <span>Activo</span>
        </label>
        {err && <div className="text-accent-red text-[11px]">{err}</div>}
        <button type="submit" className="btn-primary" disabled={saving || vehicles.length === 0}>
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear driver'}
        </button>
      </form>
    </Modal>
  );
}


// =============================================================================
// Tab: Vehículos de la empresa (con bulk Excel)
// =============================================================================
export function VehiclesForEmpresaTab({ empresaId }: { empresaId: number }) {
  const qc = useQueryClient();
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<AdminVehicle | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const vehiclesQ = useQuery({
    queryKey: ['admin-vehicles'],
    queryFn: api.admin.listVehicles,
  });
  const allOfEmpresa = (vehiclesQ.data ?? [])
    .filter(v => v.empresa_id === empresaId)
    .filter(v => !onlyActive || v.active);
  const vehicles = search.trim()
    ? allOfEmpresa.filter(v => {
        const q = search.trim().toLowerCase();
        return String(v.vehicle_id).includes(q)
            || v.name.toLowerCase().includes(q)
            || (v.plate ?? '').toLowerCase().includes(q);
      })
    : allOfEmpresa;

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-vehicles'] });
  const delMut = useMutation({
    mutationFn: (id: number) => api.admin.deleteVehicle(id),
    onSuccess: refresh,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-xs text-text-muted">
            {vehicles.length}{search ? ` / ${allOfEmpresa.length}` : ''} vehículos
          </div>
          <label className="flex items-center gap-1 text-[11px] cursor-pointer">
            <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />
            Solo activos
          </label>
          <input
            type="search"
            placeholder="Buscar vehículo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input !py-1 !text-[11px] w-48"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreating(true)} className="btn-primary text-[11px] flex items-center gap-1">
            <Plus size={11} /> Agregar vehículo
          </button>
          <BulkXlsxButtons
            downloadPath={`/admin/vehicles/template?empresa_id=${empresaId}`}
            filename={`vehicles_${empresaId}.xlsx`}
            uploadPath={`/admin/vehicles/upload?empresa_id=${empresaId}`}
            onUploaded={refresh}
          />
        </div>
      </div>
      {vehiclesQ.isLoading ? (
        <div className="text-text-muted text-xs">Cargando…</div>
      ) : vehicles.length === 0 ? (
        <div className="text-text-muted text-xs italic py-6 text-center">
          Sin vehículos en esta empresa. Agregá uno o subí un XLSX en bulk.
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-2 py-1.5 text-left">ID</th>
              <th className="px-2 py-1.5 text-left">Nombre</th>
              <th className="px-2 py-1.5 text-left">Patente</th>
              <th className="px-2 py-1.5 text-left">Tipo</th>
              <th className="px-2 py-1.5 text-center">Activo</th>
              <th className="px-2 py-1.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.vehicle_id} className="border-b border-line/50">
                <td className="px-2 py-1.5 font-mono text-[10px] text-text-muted">#{v.vehicle_id}</td>
                <td className="px-2 py-1.5">{v.name}</td>
                <td className="px-2 py-1.5 font-mono">{v.plate}</td>
                <td className="px-2 py-1.5">{v.type}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className={`pill ${v.active ? 'pill-green' : 'pill-red'}`}>
                    {v.active ? 'Sí' : 'No'}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => setEditing(v)} className="text-accent-blue hover:underline">
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Eliminar vehículo ${v.name} (${v.plate})?`)) delMut.mutate(v.vehicle_id);
                      }}
                      className="text-accent-red hover:underline"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <VehicleFormModal
          empresaId={empresaId}
          onClose={() => setCreating(false)}
          onSaved={() => { refresh(); setCreating(false); }}
        />
      )}
      {editing && (
        <VehicleFormModal
          empresaId={empresaId}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); setEditing(null); }}
        />
      )}
    </div>
  );
}


function VehicleFormModal({ empresaId, initial, onClose, onSaved }: {
  empresaId: number;
  initial?: AdminVehicle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [vehicle_id, setVehicleId] = useState<number>(initial?.vehicle_id ?? 0);
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'truck');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [capacity_m3, setCapacity] = useState<number>(initial?.capacity_m3 ?? 10);
  const [year, setYear] = useState<string>(initial?.year ? String(initial.year) : '');
  const [active, setActive] = useState(initial?.active ?? true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      if (isEdit) {
        await api.admin.updateVehicle(initial!.vehicle_id, {
          empresa_id: empresaId, name, type, plate, capacity_m3,
          year: year ? Number(year) : null,
          active,
        });
      } else {
        await api.admin.createVehicle({
          vehicle_id, empresa_id: empresaId, name, type, plate,
          capacity_m3,
          driver_id: null, driver_name: null,
          depot_lat: -33.45, depot_lon: -70.66,
          year: year ? Number(year) : null,
          active, is_problem_hidden: false,
          empresa_nombre: null,
        });
      }
      onSaved();
    } catch (ex: any) {
      setErr(ex?.message ?? 'error guardando');
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? `Editar vehículo #${initial!.vehicle_id}` : 'Nuevo vehículo'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 text-[12px]">
        {!isEdit && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">ID (entero único)</span>
            <input className="input" type="number" required min={1}
                   value={vehicle_id || ''} onChange={e => setVehicleId(Number(e.target.value))} />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Nombre</span>
            <input className="input" required value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Tipo</span>
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="truck">Camión</option>
              <option value="van">Van</option>
              <option value="moto">Moto</option>
              <option value="auto">Auto</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Patente</span>
            <input className="input font-mono uppercase" required value={plate}
                   onChange={e => setPlate(e.target.value.toUpperCase())} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Capacidad (m³)</span>
            <input className="input" type="number" min={0} value={capacity_m3}
                   onChange={e => setCapacity(Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-text-muted">Año</span>
            <input className="input" type="number" min={1990} max={2100}
                   value={year} onChange={e => setYear(e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
          <span>Activo</span>
        </label>
        {err && <div className="text-accent-red text-[11px]">{err}</div>}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear vehículo'}
        </button>
      </form>
    </Modal>
  );
}


// =============================================================================
// Tab: contactos (CRUD)
// =============================================================================
export function ContactosTab({ empresaId }: { empresaId: number }) {
  const qc = useQueryClient();
  const contactosQ = useQuery({
    queryKey: ['contactos', empresaId],
    queryFn: () => api.empresaContactos.listContactos(empresaId),
  });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Contacto | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['contactos', empresaId] });
    qc.invalidateQueries({ queryKey: ['empresa-contactos-list'] });
  };

  const delMut = useMutation({
    mutationFn: (id: number) => api.empresaContactos.remove(empresaId, id),
    onSuccess: refresh,
  });

  const optInMut = useMutation({
    mutationFn: (id: number) => api.empresaContactos.optIn(empresaId, id),
    onSuccess: refresh,
  });

  const contactos = contactosQ.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-muted">{contactos.length} contactos activos</div>
        <button onClick={() => setCreating(true)}
                className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Agregar contacto
        </button>
      </div>

      {contactosQ.isLoading ? (
        <div className="text-text-muted text-xs">Cargando…</div>
      ) : contactos.length === 0 ? (
        <div className="text-text-muted text-xs italic py-6 text-center">
          Sin contactos. Agregá uno o importá vía CSV.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contactos.map(c => (
            <ContactoCard
              key={c.contact_id}
              contacto={c}
              onEdit={() => setEditing(c)}
              onDelete={() => delMut.mutate(c.contact_id)}
              onOptIn={() => optInMut.mutate(c.contact_id)}
            />
          ))}
        </div>
      )}

      {creating && (
        <ContactoFormModal
          title="Nuevo contacto"
          empresaId={empresaId}
          onClose={() => setCreating(false)}
          onSaved={() => { refresh(); setCreating(false); }}
        />
      )}
      {editing && (
        <ContactoFormModal
          title={`Editar ${editing.nombre}`}
          empresaId={empresaId}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { refresh(); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ContactoCard({
  contacto, onEdit, onDelete, onOptIn,
}: {
  contacto: Contacto;
  onEdit: () => void;
  onDelete: () => void;
  onOptIn: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const rol = ROL_META[contacto.rol];

  return (
    <div className="border border-line rounded-md bg-bg-700/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{contacto.nombre}</span>
            <span className={`pill ${rol.cls}`}>{rol.label}</span>
            {contacto.opted_in_at ? (
              <span className="pill pill-green flex items-center gap-1">
                <CheckCircle2 size={10} /> opt-in
              </span>
            ) : (
              <span className="pill pill-yellow flex items-center gap-1">
                <Clock size={10} /> pendiente
              </span>
            )}
          </div>
          <div className="text-xs text-text-secondary mt-1 font-mono">
            {contacto.phone_e164}
          </div>
          {contacto.email && (
            <div className="text-xs text-text-muted">{contacto.email}</div>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] text-text-muted">
              {REGION_META[contacto.region_filter]}
            </span>
            {contacto.severities_in && contacto.severities_in.length > 0 && (
              <span className="text-[10px] text-text-muted">
                · severidades: {contacto.severities_in.join(', ')}
              </span>
            )}
            {contacto.motivos_in && contacto.motivos_in.length > 0 && (
              <span className="text-[10px] text-text-muted">
                · {contacto.motivos_in.length} motivos
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <button onClick={onEdit}
                  className="text-accent-blue text-xs hover:underline flex items-center gap-1">
            <Pencil size={11} /> editar
          </button>
          {!contacto.opted_in_at && (
            <button onClick={onOptIn}
                    className="text-accent-green text-xs hover:underline flex items-center gap-1">
              <UserCheck size={11} /> marcar opt-in
            </button>
          )}
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
                    className="text-accent-red text-xs hover:underline flex items-center gap-1">
              <Trash2 size={11} /> eliminar
            </button>
          ) : (
            <button onClick={onDelete}
                    className="btn-danger text-[10px] px-2 py-1">
              confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// =============================================================================
// Modal: form contacto
// =============================================================================
function ContactoFormModal({
  title, empresaId, initial, onClose, onSaved,
}: {
  title: string;
  empresaId: number;
  initial?: Contacto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [rol, setRol] = useState<ContactoRol>(initial?.rol ?? 'coordinador');
  const [phone, setPhone] = useState(initial?.phone_e164 ?? '+56');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [region, setRegion] = useState<ContactoRegion>(initial?.region_filter ?? 'all');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [severities, setSeverities] = useState<MotivoSeverity[]>(initial?.severities_in ?? []);
  const [motivos, setMotivos] = useState<string[]>(initial?.motivos_in ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const phoneOk = useMemo(() => /^\+\d{8,15}$/.test(phone), [phone]);
  const canSubmit = nombre.trim().length > 0 && phoneOk && !submitting;

  const toggleSeverity = (s: MotivoSeverity) => {
    setSeverities(curr => curr.includes(s) ? curr.filter(x => x !== s) : [...curr, s]);
  };
  const toggleMotivo = (m: string) => {
    setMotivos(curr => curr.includes(m) ? curr.filter(x => x !== m) : [...curr, m]);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setErr(null);
    const body: ContactoCreate = {
      nombre: nombre.trim(),
      rol,
      phone_e164: phone.trim(),
      email: email.trim() || null,
      region_filter: region,
      severities_in: severities.length > 0 ? severities : null,
      motivos_in: motivos.length > 0 ? motivos : null,
      notes: notes.trim() || null,
    };
    try {
      if (initial) {
        await api.empresaContactos.update(empresaId, initial.contact_id, body);
      } else {
        await api.empresaContactos.create(empresaId, body);
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
         onClick={onClose}>
      <div className="bg-bg-800 border border-line rounded-md w-full max-w-lg max-h-[90vh] overflow-auto"
           onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-line flex items-center justify-between sticky top-0 bg-bg-800">
          <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">×</button>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <FormRow label="Nombre">
            <input className="input w-full" value={nombre}
                   onChange={e => setNombre(e.target.value)} required />
          </FormRow>
          <FormRow label="Rol">
            <select className="input w-full" value={rol}
                    onChange={e => setRol(e.target.value as ContactoRol)}>
              {ROL_OPTIONS.map(r => (
                <option key={r} value={r}>{ROL_META[r].label}</option>
              ))}
            </select>
          </FormRow>
          <FormRow label="Teléfono E.164 (ej: +56939568904)">
            <input className={`input w-full font-mono ${phoneOk ? '' : 'border-accent-red'}`}
                   value={phone}
                   onChange={e => setPhone(e.target.value)} />
            {!phoneOk && phone && (
              <div className="text-[10px] text-accent-red mt-1">
                Formato esperado: + seguido de 8-15 dígitos
              </div>
            )}
          </FormRow>
          <FormRow label="Email (opcional)">
            <input type="email" className="input w-full" value={email}
                   onChange={e => setEmail(e.target.value)} />
          </FormRow>
          <FormRow label="Severidades (vacío = todas)">
            <div className="flex flex-wrap gap-2">
              {SEVERITY_OPTIONS.map(s => (
                <ChipToggle key={s}
                            label={s}
                            active={severities.includes(s)}
                            onToggle={() => toggleSeverity(s)} />
              ))}
            </div>
          </FormRow>
          <FormRow label="Motivos (vacío = todos)">
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto p-1 border border-line rounded">
              {MOTIVOS_CATALOGO.map(m => (
                <ChipToggle key={m}
                            label={m}
                            active={motivos.includes(m)}
                            onToggle={() => toggleMotivo(m)}
                            small />
              ))}
            </div>
          </FormRow>
          <FormRow label="Región">
            <div className="flex gap-3">
              {(['RM', 'regiones', 'all'] as ContactoRegion[]).map(r => (
                <label key={r} className="flex items-center gap-1.5 text-xs">
                  <input type="radio" checked={region === r}
                         onChange={() => setRegion(r)} />
                  {REGION_META[r]}
                </label>
              ))}
            </div>
          </FormRow>
          <FormRow label="Notas (opcional)">
            <textarea className="input w-full" rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)} />
          </FormRow>

          {err && <div className="text-accent-red text-xs">{err}</div>}
          <button onClick={submit} disabled={!canSubmit}
                  className="btn-primary w-full">
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{label}</div>
      {children}
    </div>
  );
}

function ChipToggle({
  label, active, onToggle, small = false,
}: { label: string; active: boolean; onToggle: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`px-2 py-0.5 ${small ? 'text-[10px]' : 'text-[11px]'} rounded border transition-colors ${
        active
          ? 'bg-accent-blue/20 border-accent-blue text-accent-blue'
          : 'bg-bg-700 border-line text-text-secondary hover:text-text-primary'
      }`}
    >
      {label}
    </button>
  );
}


// =============================================================================
// Tab: import CSV
// =============================================================================
export function CSVTab({ empresaId }: { empresaId: number }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkCSVResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setErr(null);
  };

  const upload = async () => {
    if (!file) return;
    setSubmitting(true); setErr(null);
    try {
      const r = await api.empresaContactos.bulkUploadCSV(empresaId, file);
      setResult(r);
      qc.invalidateQueries({ queryKey: ['contactos', empresaId] });
      qc.invalidateQueries({ queryKey: ['empresa-contactos-list'] });
    } catch (e: any) {
      setErr(e?.message ?? 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () =>
    api.empresaContactos.downloadCsvTemplate(empresaId).catch(e => setErr(e?.message ?? 'error'));

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-text-secondary leading-relaxed">
        Subí un CSV con las columnas <code className="font-mono">nombre, rol, phone_e164, email, severities, motivos, region</code>.
        Severidades y motivos se separan por <code className="font-mono">;</code>.
        Las filas con phones duplicados se saltan; las inválidas se reportan.
      </div>
      <div className="flex items-center gap-2">
        <button onClick={downloadTemplate}
                className="btn text-xs flex items-center gap-1">
          <Download size={12} /> Descargar template
        </button>
      </div>
      <div className="border border-dashed border-line rounded-md p-4 flex flex-col items-center gap-2">
        <input ref={inputRef} type="file" accept=".csv,text/csv"
               onChange={onFile} className="hidden" />
        <button onClick={() => inputRef.current?.click()}
                className="btn text-xs flex items-center gap-1">
          <Upload size={12} /> {file ? file.name : 'Seleccionar archivo CSV'}
        </button>
        {file && (
          <button onClick={upload} disabled={submitting}
                  className="btn-primary text-xs">
            {submitting ? 'Importando…' : 'Importar contactos'}
          </button>
        )}
      </div>

      {err && <div className="text-accent-red text-xs">{err}</div>}

      {result && (
        <div className="border border-line rounded-md p-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="pill pill-green">+{result.added} agregados</span>
            <span className="pill pill-yellow">{result.skipped.length} saltados</span>
            <span className="pill pill-red">{result.errors.length} errores</span>
          </div>
          {result.skipped.length > 0 && (
            <div>
              <div className="text-text-muted text-[10px] uppercase mb-1">Saltados (duplicados)</div>
              {result.skipped.map((s, i) => (
                <div key={i} className="text-text-secondary">
                  · fila {s.row}: {s.reason}
                </div>
              ))}
            </div>
          )}
          {result.errors.length > 0 && (
            <div>
              <div className="text-text-muted text-[10px] uppercase mb-1 flex items-center gap-1">
                <FileWarning size={11} /> Errores
              </div>
              {result.errors.map((e, i) => (
                <div key={i} className="text-accent-red">
                  · fila {e.row}: {e.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// =============================================================================
// Tab: test broadcast
// =============================================================================
export function BroadcastTab({ empresa }: { empresa: EmpresaSummary }) {
  const [result, setResult] = useState<TestBroadcastResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const optInCount = empresa.opted_in_count;

  const send = async () => {
    setSubmitting(true); setErr(null);
    try {
      const r = await api.empresaContactos.testBroadcast(empresa.empresa_id);
      setResult(r);
    } catch (e: any) {
      setErr(e?.message ?? 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs text-text-secondary leading-relaxed">
        Esto envía un mensaje real a <span className="text-accent-yellow font-semibold">todos los contactos opt-in</span>{' '}
        de <span className="font-semibold">{empresa.nombre}</span>. Útil para validar que el
        join al sandbox funciona y los números están bien.
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={send}
          disabled={submitting || optInCount === 0}
          className="btn-primary text-xs flex items-center gap-1"
          title={optInCount === 0 ? 'No hay contactos con opt-in' : ''}
        >
          <Send size={12} /> {submitting ? 'Enviando…' : `Enviar test (${optInCount} destinatarios)`}
        </button>
      </div>
      {err && <div className="text-accent-red text-xs">{err}</div>}

      {result && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-wider text-text-muted">Resumen</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="pill pill-green">{result.sent} enviados</span>
            <span className="pill pill-red">{result.failed} fallos</span>
            <span className="text-text-muted">{result.results.length} total</span>
          </div>
          <div className="border border-line rounded-md bg-bg-700/30 p-2 text-[11px] font-mono whitespace-pre-wrap">
            {result.body}
          </div>
          <div className="flex flex-col gap-1">
            {result.results.map(r => (
              <div key={r.contact_id} className="flex items-center gap-2 text-xs border-b border-line/40 py-1">
                <span className={`pill ${
                  r.status === 'sent' ? 'pill-green' :
                  r.status === 'dry_run' ? 'pill-blue' :
                  r.status === 'disabled' ? 'pill-yellow' :
                  'pill-red'
                }`}>{r.status}</span>
                <span className="font-semibold">{r.nombre}</span>
                <span className="text-text-muted font-mono">{r.phone}</span>
                {r.error && <span className="text-accent-red text-[10px] truncate">{r.error}</span>}
                {r.twilio_sid && <span className="text-text-muted text-[10px] font-mono ml-auto">{r.twilio_sid.slice(0, 14)}…</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
