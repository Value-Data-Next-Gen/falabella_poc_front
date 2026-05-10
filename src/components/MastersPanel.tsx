import { ReactNode, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Building2, Clock, KeyRound, Loader2, Pencil, Plus, ShieldAlert, Sparkles,
  Star, Trash2, Truck, User, Users,
} from 'lucide-react';
import { api } from '../api';
import {
  AdminClient, AdminDriver, AdminEmpresa, AdminUser, AdminVehicle, MatchType, VipClient,
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { MotivosConfigPanel } from './MotivosConfigPanel';

type Sub = 'empresas' | 'users' | 'drivers' | 'vehicles' | 'clients' | 'vip' | 'motivos';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'falabella_admin') {
    return (
      <div className="panel p-6 text-center text-text-muted">
        <ShieldAlert size={32} className="mx-auto mb-2 text-accent-yellow" />
        <div>Esta sección requiere rol <span className="text-accent-yellow">falabella_admin</span>.</div>
      </div>
    );
  }
  return <>{children}</>;
}

export function MastersPanel() {
  const { user } = useAuth();
  const [sub, setSub] = useState<Sub>('empresas');

  if (user?.role !== 'falabella_admin') {
    return (
      <div className="panel p-6 text-center text-text-muted">
        <ShieldAlert size={32} className="mx-auto mb-2 text-accent-yellow" />
        <div>Esta sección requiere rol <span className="text-accent-yellow">falabella_admin</span>.</div>
      </div>
    );
  }

  const subs: { key: Sub; label: string; icon: any }[] = [
    { key: 'empresas', label: 'Empresas', icon: Building2 },
    { key: 'users', label: 'Usuarios', icon: Users },
    { key: 'drivers', label: 'Conductores', icon: User },
    { key: 'vehicles', label: 'Vehículos', icon: Truck },
    { key: 'clients', label: 'Clientes', icon: Star },
    { key: 'vip', label: 'Clientes VIP', icon: Star },
    { key: 'motivos', label: 'Motivos / Alertas', icon: AlertTriangle },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-line">
        {subs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors ${
              sub === key
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {sub === 'empresas' && <EmpresasTab />}
      {sub === 'users' && <UsersTab />}
      {sub === 'drivers' && <DriversTab />}
      {sub === 'vehicles' && <VehiclesTab />}
      {sub === 'clients' && <ClientsTab />}
      {sub === 'vip' && <VipTab />}
      {sub === 'motivos' && <MotivosConfigPanel />}
    </div>
  );
}

// =============================================================================
// VIP Tab — CRUD con deadline + parse-notes via LLM
// =============================================================================
export function VipTab({ highlightVipId, searchQ }: { highlightVipId?: number | null; searchQ?: string } = {}) {
  const qc = useQueryClient();
  const empresasQ = useQuery({ queryKey: ['admin-empresas'], queryFn: api.admin.listEmpresas });
  const [editing, setEditing] = useState<VipClient | null>(null);
  const [creating, setCreating] = useState(false);

  // Filtros
  const [soloDelDia, setSoloDelDia] = useState(false);
  const [filterEmpresa, setFilterEmpresa] = useState<string>('');  // '', '-1' (global), o id
  const [filterTier, setFilterTier] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');   // '', 'true', 'false'

  const filterParams = {
    q: searchQ || undefined,
    solo_del_dia: soloDelDia || undefined,
    empresa_id: filterEmpresa === '' ? undefined : Number(filterEmpresa),
    tier: filterTier || undefined,
    active: filterActive === '' ? undefined : filterActive === 'true',
  };

  const { data, isLoading } = useQuery<VipClient[]>({
    queryKey: ['admin-vip', filterParams],
    queryFn: () => api.vip.list(filterParams),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-vip'] });
  const delMut = useMutation({ mutationFn: api.vip.remove, onSuccess: refresh });

  const clearFilters = () => {
    setSoloDelDia(false);
    setFilterEmpresa('');
    setFilterTier('');
    setFilterActive('');
  };
  const anyFilterActive = soloDelDia || filterEmpresa !== '' || filterTier !== '' || filterActive !== '';

  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>{data?.length ?? 0} clientes VIP</span>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Nuevo VIP
        </button>
      </div>
      <div className="px-3 py-2 border-b border-line/50 flex flex-wrap items-center gap-2 text-[11px]">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={soloDelDia} onChange={e => setSoloDelDia(e.target.checked)} />
          <span>Solo del día</span>
        </label>
        <select className="input !py-1 !text-[11px]" value={filterEmpresa}
                onChange={e => setFilterEmpresa(e.target.value)}>
          <option value="">Todas las empresas</option>
          <option value="-1">Solo globales</option>
          {empresasQ.data?.map(em => (
            <option key={em.empresa_id} value={em.empresa_id}>#{em.empresa_id} — {em.nombre}</option>
          ))}
        </select>
        <input className="input !py-1 !text-[11px] w-24" placeholder="Tier"
               value={filterTier} onChange={e => setFilterTier(e.target.value)} />
        <select className="input !py-1 !text-[11px]" value={filterActive}
                onChange={e => setFilterActive(e.target.value)}>
          <option value="">Activos e inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
        </select>
        {anyFilterActive && (
          <button onClick={clearFilters} className="text-text-muted hover:text-text-primary underline">
            Limpiar
          </button>
        )}
      </div>
      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="border-b border-line">
            <tr className="text-text-muted uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Match</th>
              <th className="px-3 py-2 text-left">Tier</th>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-left">Deadline</th>
              <th className="px-3 py-2 text-right">Antelación</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map(v => (
              <tr key={v.vip_id} className={`border-b border-line/50 hover:bg-bg-700/30 ${highlightVipId === v.vip_id ? 'bg-cmr/10 ring-1 ring-cmr/40' : ''}`}>
                <td className="px-3 py-2 text-text-muted">#{v.vip_id}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold truncate max-w-[260px]" title={v.match_value}>{v.match_value}</div>
                  <div className="text-[10px] text-text-muted">{v.match_type}</div>
                </td>
                <td className="px-3 py-2">
                  <span className="pill bg-cmr/15 text-cmr border-cmr/40 border">{v.tier}</span>
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {v.empresa_id != null
                    ? empresasQ.data?.find(em => em.empresa_id === v.empresa_id)?.nombre ?? `#${v.empresa_id}`
                    : <span className="text-text-muted">global</span>}
                </td>
                <td className="px-3 py-2 font-mono">
                  {v.deadline_time
                    ? <span className="text-accent-red flex items-center gap-1"><Clock size={10} />{v.deadline_time}</span>
                    : <span className="text-text-muted">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{v.alert_minutes_before} min</td>
                <td className="px-3 py-2">
                  <span className={`pill ${v.active ? 'pill-green' : 'pill-red'}`}>{v.active ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => setEditing(v)} className="text-accent-blue hover:underline text-xs flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <ConfirmDelete what={v.match_value} onConfirm={() => delMut.mutate(v.vip_id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <Modal title="Nuevo cliente VIP" onClose={() => setCreating(false)}>
          <VipForm
            empresas={empresasQ.data ?? []}
            onSubmit={async data => {
              await api.vip.create(data);
              refresh();
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar VIP #${editing.vip_id}`} onClose={() => setEditing(null)}>
          <VipForm
            empresas={empresasQ.data ?? []}
            initial={editing}
            isEdit
            onSubmit={async data => {
              await api.vip.update(editing.vip_id, {
                tier: data.tier,
                notes: data.notes,
                deadline_time: data.deadline_time,
                alert_minutes_before: data.alert_minutes_before,
                active: data.active,
              });
              refresh();
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function VipForm({ initial, isEdit, empresas, onSubmit }: {
  initial?: VipClient;
  isEdit?: boolean;
  empresas: AdminEmpresa[];
  onSubmit: (data: any) => Promise<void>;
}) {
  const [matchType, setMatchType] = useState<MatchType>(initial?.match_type ?? 'title');
  const [matchValue, setMatchValue] = useState(initial?.match_value ?? '');
  const [empresaId, setEmpresaId] = useState<number | null>(initial?.empresa_id ?? null);
  const [tier, setTier] = useState(initial?.tier ?? 'VIP');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [deadlineTime, setDeadlineTime] = useState(initial?.deadline_time ?? '');
  const [alertMin, setAlertMin] = useState<number>(initial?.alert_minutes_before ?? 60);
  const [active, setActive] = useState(initial?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseRazon, setParseRazon] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onParse = async () => {
    if (!notes.trim()) return;
    setParseLoading(true);
    setParseRazon(null);
    setErr(null);
    try {
      const r = await api.vip.parseNotes(notes);
      if (r.deadline_time) setDeadlineTime(r.deadline_time);
      if (r.alert_minutes_before) setAlertMin(r.alert_minutes_before);
      setParseRazon(r.razonamiento + (r.fallback ? ' (fallback regex)' : ''));
    } catch (ex: any) {
      setErr(ex.message);
    } finally {
      setParseLoading(false);
    }
  };

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true); setErr(null);
      if (alertMin < 5 || alertMin > 720) {
        setErr('alert_minutes_before debe estar entre 5 y 720');
        setSubmitting(false);
        return;
      }
      try {
        await onSubmit({
          match_type: matchType,
          match_value: matchValue,
          empresa_id: empresaId,
          tier,
          notes: notes || null,
          deadline_time: deadlineTime || null,
          alert_minutes_before: alertMin,
          active,
        });
      } catch (ex: any) { setErr(ex.message); setSubmitting(false); }
    }}>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Tipo de match">
          <select className="input w-full" value={matchType}
                  disabled={isEdit}
                  onChange={e => setMatchType(e.target.value as MatchType)}>
            <option value="title">Razón social</option>
            <option value="customer_id">Customer ID</option>
            <option value="reference">Referencia</option>
          </select>
        </FormRow>
        <FormRow label="Tier">
          <input className="input w-full" value={tier} onChange={e => setTier(e.target.value)} />
        </FormRow>
      </div>
      <FormRow label="Valor del match (exacto)">
        <input className="input w-full" value={matchValue}
               disabled={isEdit}
               onChange={e => setMatchValue(e.target.value)} required />
      </FormRow>
      <FormRow label="Empresa (opcional, vacío = global)">
        <select className="input w-full" value={empresaId ?? ''}
                onChange={e => setEmpresaId(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">— Global (todas las empresas) —</option>
          {empresas.map(em => (
            <option key={em.empresa_id} value={em.empresa_id}>
              #{em.empresa_id} — {em.nombre}
            </option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Notas (puede contener instrucciones de horario)">
        <textarea className="input w-full" rows={3} value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ej: Cliente VIP, entregar antes de las 4 PM con 1 hora de aviso." />
        <button
          type="button"
          onClick={onParse}
          disabled={!notes.trim() || parseLoading}
          className="btn mt-1 text-[11px] flex items-center gap-1"
        >
          {parseLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} className="text-accent-violet" />}
          Sugerir desde notas
        </button>
        {parseRazon && (
          <div className="mt-1 text-[11px] text-text-secondary border-l-2 border-accent-violet/40 pl-2">
            <span className="text-text-muted">IA:</span> {parseRazon}
          </div>
        )}
      </FormRow>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Hora límite (HH:MM)">
          <input type="time" className="input w-full font-mono" value={deadlineTime}
                 onChange={e => setDeadlineTime(e.target.value)} />
        </FormRow>
        <FormRow label="Alertar minutos antes (5 - 720)">
          <input type="number" min={5} max={720} className="input w-full" value={alertMin}
                 onChange={e => setAlertMin(Number(e.target.value))} />
        </FormRow>
      </div>
      <label className="flex items-center gap-2 mb-3 text-xs">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        Activo
      </label>
      {err && <div className="text-accent-red text-xs mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear VIP'}
      </button>
    </form>
  );
}

// =============================================================================
// Modal (genérico)
// =============================================================================
function Modal({ title, onClose, children }:
  { title: string; onClose: () => void; children: ReactNode }) {
  // Cerrar solo si el mousedown Y el mouseup ocurrieron sobre el backdrop.
  // Evita el bug "se abre y cierra solo" cuando React 18 commitea entre
  // mousedown y mouseup del clic original (mouseup termina cayendo en el
  // backdrop recién montado y dispara onClick → onClose).
  const downOnBackdrop = useRef(false);
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
         onMouseDown={e => { downOnBackdrop.current = e.target === e.currentTarget; }}
         onMouseUp={e => {
           if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
           downOnBackdrop.current = false;
         }}>
      <div className="bg-bg-800 border border-line rounded-md w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{label}</div>
      {children}
    </label>
  );
}

function ConfirmDelete({ what, onConfirm }: { what: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button onClick={() => setArmed(true)} className="text-accent-red hover:underline text-xs flex items-center gap-1">
        <Trash2 size={12} /> Eliminar
      </button>
    );
  }
  return (
    <button onClick={onConfirm} className="btn-danger text-[10px] px-2 py-1">
      Confirmar borrado de {what}
    </button>
  );
}

// =============================================================================
// Empresas
// =============================================================================
export function EmpresasTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-empresas'],
    queryFn: api.admin.listEmpresas,
  });
  const [editing, setEditing] = useState<AdminEmpresa | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-empresas'] });
  const refreshAll = () => qc.invalidateQueries();

  const delMut = useMutation({
    mutationFn: api.admin.deleteEmpresa,
    onSuccess: refreshAll,
  });

  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>{data?.length ?? 0} empresas</span>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Nueva empresa
        </button>
      </div>
      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="border-b border-line">
            <tr className="text-text-muted uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Creado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map(e => (
              <tr key={e.empresa_id} className="border-b border-line/50 hover:bg-bg-700/30">
                <td className="px-3 py-2 text-text-muted">#{e.empresa_id}</td>
                <td className="px-3 py-2 font-semibold">{e.nombre}</td>
                <td className="px-3 py-2">
                  <span className={`pill ${e.activo ? 'pill-green' : 'pill-red'}`}>
                    {e.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-muted">{e.created_at?.slice(0, 10) ?? '—'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => setEditing(e)} className="text-accent-blue hover:underline text-xs flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <ConfirmDelete what={`#${e.empresa_id}`} onConfirm={() => delMut.mutate(e.empresa_id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <Modal title="Nueva empresa" onClose={() => setCreating(false)}>
          <EmpresaForm
            onSubmit={async data => {
              await api.admin.createEmpresa(data);
              refresh();
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar empresa #${editing.empresa_id}`} onClose={() => setEditing(null)}>
          <EmpresaForm
            initial={editing}
            isEdit
            onSubmit={async data => {
              await api.admin.updateEmpresa(editing.empresa_id, {
                nombre: data.nombre,
                activo: data.activo,
              });
              refresh();
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function EmpresaForm({ initial, isEdit, onSubmit }: {
  initial?: AdminEmpresa;
  isEdit?: boolean;
  onSubmit: (data: { empresa_id: number; nombre: string; activo: boolean }) => Promise<void>;
}) {
  const [empresaId, setEmpresaId] = useState(initial?.empresa_id ?? 100);
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true); setErr(null);
      try { await onSubmit({ empresa_id: empresaId, nombre, activo }); }
      catch (ex: any) { setErr(ex.message); setSubmitting(false); }
    }}>
      <FormRow label="Empresa ID">
        <input type="number" className="input w-full" value={empresaId}
               disabled={isEdit}
               onChange={e => setEmpresaId(Number(e.target.value))} required />
      </FormRow>
      <FormRow label="Nombre">
        <input className="input w-full" value={nombre}
               onChange={e => setNombre(e.target.value)} required />
      </FormRow>
      <label className="flex items-center gap-2 mb-3 text-xs">
        <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
        Activa
      </label>
      {err && <div className="text-accent-red text-xs mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

// =============================================================================
// Usuarios
// =============================================================================
export function UsersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.admin.listUsers,
  });
  const empresasQ = useQuery({
    queryKey: ['admin-empresas'],
    queryFn: api.admin.listEmpresas,
  });
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<AdminUser | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-users'] });
  const delMut = useMutation({ mutationFn: api.admin.deleteUser, onSuccess: refresh });

  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>{data?.length ?? 0} usuarios</span>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Nuevo usuario
        </button>
      </div>
      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="border-b border-line">
            <tr className="text-text-muted uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Rol</th>
              <th className="px-3 py-2 text-left">Empresa</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Último login</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map(u => (
              <tr key={u.user_id} className="border-b border-line/50 hover:bg-bg-700/30">
                <td className="px-3 py-2 text-text-muted">#{u.user_id}</td>
                <td className="px-3 py-2 font-mono">{u.email}</td>
                <td className="px-3 py-2">{u.display_name}</td>
                <td className="px-3 py-2">
                  <span className={`pill ${u.role === 'falabella_admin' ? 'pill-violet' : u.role === 'falabella_ops' ? 'pill-blue' : 'pill-green'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-secondary">{u.empresa_nombre ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className={`pill ${u.activo ? 'pill-green' : 'pill-red'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-muted text-[10px]">
                  {u.last_login ? u.last_login.slice(0, 16).replace('T', ' ') : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => setEditing(u)} className="text-accent-blue hover:underline text-xs flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => setResetting(u)} className="text-accent-yellow hover:underline text-xs flex items-center gap-1">
                      <KeyRound size={12} /> Pwd
                    </button>
                    <ConfirmDelete what={u.email} onConfirm={() => delMut.mutate(u.user_id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <Modal title="Nuevo usuario" onClose={() => setCreating(false)}>
          <UserForm
            empresas={empresasQ.data ?? []}
            onSubmit={async data => {
              await api.admin.createUser(data);
              refresh();
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar #${editing.user_id} — ${editing.email}`} onClose={() => setEditing(null)}>
          <UserForm
            empresas={empresasQ.data ?? []}
            initial={editing}
            isEdit
            onSubmit={async data => {
              await api.admin.updateUser(editing.user_id, {
                email: data.email,
                display_name: data.display_name,
                role: data.role,
                empresa_id: data.empresa_id,
                activo: data.activo,
                phone_e164: data.phone_e164 || undefined,
                notify_whatsapp: data.notify_whatsapp,
              });
              refresh();
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {resetting && (
        <Modal title={`Resetear password — ${resetting.email}`} onClose={() => setResetting(null)}>
          <PasswordResetForm
            onSubmit={async pwd => {
              await api.admin.resetPassword(resetting.user_id, pwd);
              setResetting(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function UserForm({ initial, isEdit, empresas, onSubmit }: {
  initial?: AdminUser;
  isEdit?: boolean;
  empresas: AdminEmpresa[];
  onSubmit: (data: any) => Promise<void>;
}) {
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(initial?.display_name ?? '');
  const [role, setRole] = useState(initial?.role ?? 'transport_manager');
  const [empresaId, setEmpresaId] = useState<number | null>(initial?.empresa_id ?? null);
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [phone, setPhone] = useState(initial?.phone_e164 ?? '');
  const [notifyWa, setNotifyWa] = useState(initial?.notify_whatsapp ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true); setErr(null);
      try {
        const payload: any = {
          email, display_name: displayName, role,
          empresa_id: role === 'transport_manager' ? empresaId : null,
          activo, phone_e164: phone || undefined, notify_whatsapp: notifyWa,
        };
        if (!isEdit) payload.password = password;
        await onSubmit(payload);
      } catch (ex: any) { setErr(ex.message); setSubmitting(false); }
    }}>
      <FormRow label="Email">
        <input type="email" className="input w-full" value={email}
               onChange={e => setEmail(e.target.value)} required />
      </FormRow>
      {!isEdit && (
        <FormRow label="Password">
          <input type="text" className="input w-full" value={password}
                 onChange={e => setPassword(e.target.value)} required minLength={4} />
        </FormRow>
      )}
      <FormRow label="Nombre">
        <input className="input w-full" value={displayName}
               onChange={e => setDisplayName(e.target.value)} required />
      </FormRow>
      <FormRow label="Rol">
        <select className="input w-full" value={role}
                onChange={e => setRole(e.target.value as any)}>
          <option value="transport_manager">transport_manager</option>
          <option value="falabella_ops">falabella_ops</option>
          <option value="falabella_admin">falabella_admin</option>
        </select>
      </FormRow>
      {role === 'transport_manager' && (
        <FormRow label="Empresa">
          <select className="input w-full" value={empresaId ?? ''}
                  onChange={e => setEmpresaId(Number(e.target.value) || null)} required>
            <option value="">— elegir —</option>
            {empresas.map(em => (
              <option key={em.empresa_id} value={em.empresa_id}>
                #{em.empresa_id} — {em.nombre}
              </option>
            ))}
          </select>
        </FormRow>
      )}
      <FormRow label="Teléfono (E.164, ej +56912345678)">
        <input className="input w-full" value={phone} onChange={e => setPhone(e.target.value)} />
      </FormRow>
      <div className="flex gap-4 mb-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} />
          Activo
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={notifyWa} onChange={e => setNotifyWa(e.target.checked)} />
          Notify WhatsApp
        </label>
      </div>
      {err && <div className="text-accent-red text-xs mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

function PasswordResetForm({ onSubmit }: { onSubmit: (pwd: string) => Promise<void> }) {
  const [pwd, setPwd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true);
      await onSubmit(pwd);
    }}>
      <FormRow label="Nuevo password">
        <input type="text" className="input w-full" value={pwd} onChange={e => setPwd(e.target.value)}
               required minLength={4} />
      </FormRow>
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Resetear'}
      </button>
    </form>
  );
}

// =============================================================================
// Drivers
// =============================================================================
export function DriversTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: api.admin.listDrivers,
  });
  const [editing, setEditing] = useState<AdminDriver | null>(null);
  const [creating, setCreating] = useState(false);
  const [waEditing, setWaEditing] = useState<AdminDriver | null>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-drivers'] }); qc.invalidateQueries({ queryKey: ['drivers'] }); };
  const delMut = useMutation({ mutationFn: api.admin.deleteDriver, onSuccess: refresh });

  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>{data?.length ?? 0} conductores</span>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Nuevo conductor
        </button>
      </div>
      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: 600 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-800 border-b border-line">
              <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Teléfono</th>
                <th className="px-3 py-2 text-left">Vehículo</th>
                <th className="px-3 py-2 text-right">Rating</th>
                <th className="px-3 py-2 text-right">Entregas 30d</th>
                <th className="px-3 py-2 text-right">% fallo 30d</th>
                <th className="px-3 py-2 text-left">WhatsApp</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.driver_id} className="border-b border-line/50 hover:bg-bg-700/30">
                  <td className="px-3 py-2 text-text-muted font-mono">{d.driver_id}</td>
                  <td className="px-3 py-2 font-semibold">{d.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{d.phone}</td>
                  <td className="px-3 py-2">{d.vehicle_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.rating.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{d.deliveries_30d}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${
                    d.fail_rate_30d > 0.18 ? 'text-accent-red' : d.fail_rate_30d > 0.12 ? 'text-accent-yellow' : 'text-accent-green'
                  }`}>{(d.fail_rate_30d * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setWaEditing(d)}
                      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ring-1 bg-slate-500/15 text-slate-400 ring-slate-500/30 hover:bg-slate-500/25"
                      title="Configurar opt-in WhatsApp"
                    >
                      Configurar
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`pill ${d.active ? 'pill-green' : 'pill-red'}`}>
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setEditing(d)} className="text-accent-blue hover:underline text-xs flex items-center gap-1">
                        <Pencil size={12} /> Editar
                      </button>
                      <ConfirmDelete what={d.driver_id} onConfirm={() => delMut.mutate(d.driver_id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal title="Nuevo conductor" onClose={() => setCreating(false)}>
          <DriverForm
            onSubmit={async data => {
              await api.admin.createDriver(data);
              refresh();
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar conductor ${editing.driver_id}`} onClose={() => setEditing(null)}>
          <DriverForm
            initial={editing}
            isEdit
            onSubmit={async data => {
              await api.admin.updateDriver(editing.driver_id, data);
              refresh();
              setEditing(null);
            }}
          />
        </Modal>
      )}
      {waEditing && (
        <Modal title={`WhatsApp · ${waEditing.driver_id}`} onClose={() => setWaEditing(null)}>
          <DriverWhatsAppForm driver={waEditing} onClose={() => { setWaEditing(null); refresh(); }} />
        </Modal>
      )}
    </div>
  );
}

function DriverWhatsAppForm({ driver, onClose }: { driver: AdminDriver; onClose: () => void }) {
  const [phoneE164, setPhoneE164] = useState<string>('');
  const [notify, setNotify] = useState<boolean>(false);
  const [optedIn, setOptedIn] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      onSubmit={async e => {
        e.preventDefault();
        setSubmitting(true); setErr(null);
        try {
          await api.driversExt.updateWhatsApp(driver.driver_id, {
            phone_e164: phoneE164 || null,
            notify_whatsapp: notify,
            set_opted_in_now: optedIn,
            clear_opted_in: !optedIn,
          });
          onClose();
        } catch (ex: any) {
          setErr(ex.message || 'error');
          setSubmitting(false);
        }
      }}
    >
      <div className="text-[12px] text-text-muted mb-3">
        Driver: <span className="text-text-primary font-medium">{driver.name}</span> ·{' '}
        Teléfono libre actual: <span className="font-mono">{driver.phone || '—'}</span>
      </div>

      <FormRow label="Phone E.164 (ej: +56912345678)">
        <input
          type="text"
          className="input w-full"
          placeholder="+56912345678"
          value={phoneE164}
          onChange={e => setPhoneE164(e.target.value)}
        />
      </FormRow>
      <label className="flex items-center gap-2 mb-2 text-[12px]">
        <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
        Notificar por WhatsApp (notify_whatsapp = 1)
      </label>
      <label className="flex items-center gap-2 mb-3 text-[12px]">
        <input type="checkbox" checked={optedIn} onChange={e => setOptedIn(e.target.checked)} />
        Set opted_in_at = NOW (compliance ToS)
      </label>
      <div className="text-[10px] text-text-muted mb-3 leading-relaxed">
        Recordatorio: incluso seteando notify=1 y opted_in, los envíos siguen restringidos al sandbox Twilio
        a menos que ENABLE_AUTO_NOTIFY=true en .env.
      </div>
      {err && <div className="text-accent-red text-[11px] mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

function DriverForm({ initial, isEdit, onSubmit }: {
  initial?: AdminDriver; isEdit?: boolean;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [driverId, setDriverId] = useState(initial?.driver_id ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [license, setLicense] = useState(initial?.license ?? 'A-3 Profesional');
  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ?? 1);
  const [vehicleName, setVehicleName] = useState(initial?.vehicle_name ?? '');
  const [rating, setRating] = useState(initial?.rating ?? 4.5);
  const [deliveries, setDeliveries] = useState(initial?.deliveries_30d ?? 0);
  const [failRate, setFailRate] = useState(initial?.fail_rate_30d ?? 0.10);
  const [active, setActive] = useState(initial?.active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true); setErr(null);
      try {
        await onSubmit({
          driver_id: driverId, name, phone, license,
          vehicle_id: vehicleId, vehicle_name: vehicleName,
          rating, deliveries_30d: deliveries, fail_rate_30d: failRate, active,
        });
      } catch (ex: any) { setErr(ex.message); setSubmitting(false); }
    }}>
      <FormRow label="Driver ID">
        <input className="input w-full" value={driverId}
               disabled={isEdit}
               onChange={e => setDriverId(e.target.value)} required />
      </FormRow>
      <FormRow label="Nombre">
        <input className="input w-full" value={name} onChange={e => setName(e.target.value)} required />
      </FormRow>
      <FormRow label="Teléfono">
        <input className="input w-full" value={phone} onChange={e => setPhone(e.target.value)} />
      </FormRow>
      <FormRow label="Licencia">
        <input className="input w-full" value={license} onChange={e => setLicense(e.target.value)} />
      </FormRow>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Vehicle ID">
          <input type="number" className="input w-full" value={vehicleId}
                 onChange={e => setVehicleId(Number(e.target.value))} required />
        </FormRow>
        <FormRow label="Vehicle name">
          <input className="input w-full" value={vehicleName}
                 onChange={e => setVehicleName(e.target.value)} required />
        </FormRow>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <FormRow label="Rating (0-5)">
          <input type="number" step="0.1" min={0} max={5} className="input w-full" value={rating}
                 onChange={e => setRating(Number(e.target.value))} />
        </FormRow>
        <FormRow label="Entregas 30d">
          <input type="number" min={0} className="input w-full" value={deliveries}
                 onChange={e => setDeliveries(Number(e.target.value))} />
        </FormRow>
        <FormRow label="% fallo 30d (0-1)">
          <input type="number" step="0.01" min={0} max={1} className="input w-full" value={failRate}
                 onChange={e => setFailRate(Number(e.target.value))} />
        </FormRow>
      </div>
      <label className="flex items-center gap-2 mb-3 text-xs">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        Activo
      </label>
      {err && <div className="text-accent-red text-xs mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

// =============================================================================
// Vehicles
// =============================================================================
export function VehiclesTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicles'],
    queryFn: api.admin.listVehicles,
  });
  const [editing, setEditing] = useState<AdminVehicle | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-vehicles'] }); qc.invalidateQueries({ queryKey: ['fleet-vehicles'] }); };
  const delMut = useMutation({ mutationFn: api.admin.deleteVehicle, onSuccess: refresh });

  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>{data?.length ?? 0} vehículos</span>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Nuevo vehículo
        </button>
      </div>
      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <table className="w-full text-xs">
          <thead className="border-b border-line">
            <tr className="text-text-muted uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Patente</th>
              <th className="px-3 py-2 text-right">Cap m³</th>
              <th className="px-3 py-2 text-left">Año</th>
              <th className="px-3 py-2 text-left">Conductor</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map(v => (
              <tr key={v.vehicle_id} className="border-b border-line/50 hover:bg-bg-700/30">
                <td className="px-3 py-2 text-text-muted">#{v.vehicle_id}</td>
                <td className="px-3 py-2 font-semibold">{v.name}</td>
                <td className="px-3 py-2">{v.type}</td>
                <td className="px-3 py-2 font-mono text-accent-blue">{v.plate}</td>
                <td className="px-3 py-2 text-right tabular-nums">{v.capacity_m3}</td>
                <td className="px-3 py-2 text-text-secondary">{v.year ?? '—'}</td>
                <td className="px-3 py-2">
                  <div>{v.driver_name ?? '—'}</div>
                  <div className="text-[10px] text-text-muted">{v.driver_id ?? ''}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={`pill ${v.active ? 'pill-green' : 'pill-red'}`}>
                    {v.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center gap-3 justify-end">
                    <button onClick={() => setEditing(v)} className="text-accent-blue hover:underline text-xs flex items-center gap-1">
                      <Pencil size={12} /> Editar
                    </button>
                    <ConfirmDelete what={`#${v.vehicle_id}`} onConfirm={() => delMut.mutate(v.vehicle_id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <Modal title="Nuevo vehículo" onClose={() => setCreating(false)}>
          <VehicleForm
            onSubmit={async data => {
              await api.admin.createVehicle(data);
              refresh();
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar vehículo #${editing.vehicle_id}`} onClose={() => setEditing(null)}>
          <VehicleForm
            initial={editing}
            isEdit
            onSubmit={async data => {
              await api.admin.updateVehicle(editing.vehicle_id, data);
              refresh();
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function VehicleForm({ initial, isEdit, onSubmit }: {
  initial?: AdminVehicle; isEdit?: boolean;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ?? 100);
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'Furgon 3.5t');
  const [plate, setPlate] = useState(initial?.plate ?? '');
  const [capacity, setCapacity] = useState(initial?.capacity_m3 ?? 30);
  const [driverId, setDriverId] = useState(initial?.driver_id ?? '');
  const [driverName, setDriverName] = useState(initial?.driver_name ?? '');
  const [year, setYear] = useState(initial?.year ?? 2024);
  const [active, setActive] = useState(initial?.active ?? true);
  const [depotLat] = useState(initial?.depot_lat ?? -33.45);
  const [depotLon] = useState(initial?.depot_lon ?? -70.66);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true); setErr(null);
      try {
        await onSubmit({
          vehicle_id: vehicleId, name, type, plate, capacity_m3: capacity,
          driver_id: driverId || null, driver_name: driverName || null,
          depot_lat: depotLat, depot_lon: depotLon, year, active,
        });
      } catch (ex: any) { setErr(ex.message); setSubmitting(false); }
    }}>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Vehicle ID">
          <input type="number" className="input w-full" value={vehicleId}
                 disabled={isEdit}
                 onChange={e => setVehicleId(Number(e.target.value))} required />
        </FormRow>
        <FormRow label="Nombre (ej FAL-1010)">
          <input className="input w-full" value={name}
                 onChange={e => setName(e.target.value)} required />
        </FormRow>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Tipo">
          <select className="input w-full" value={type} onChange={e => setType(e.target.value)}>
            <option>Furgon 3.5t</option>
            <option>Camion 8t</option>
            <option>Camioneta</option>
            <option>Moto</option>
          </select>
        </FormRow>
        <FormRow label="Patente">
          <input className="input w-full" value={plate}
                 onChange={e => setPlate(e.target.value)} required />
        </FormRow>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Capacidad m³">
          <input type="number" min={0} className="input w-full" value={capacity}
                 onChange={e => setCapacity(Number(e.target.value))} required />
        </FormRow>
        <FormRow label="Año">
          <input type="number" min={1990} max={2100} className="input w-full" value={year}
                 onChange={e => setYear(Number(e.target.value))} />
        </FormRow>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Driver ID asignado">
          <input className="input w-full" value={driverId} onChange={e => setDriverId(e.target.value)} />
        </FormRow>
        <FormRow label="Driver name">
          <input className="input w-full" value={driverName} onChange={e => setDriverName(e.target.value)} />
        </FormRow>
      </div>
      <label className="flex items-center gap-2 mb-3 text-xs">
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
        Activo
      </label>
      {err && <div className="text-accent-red text-xs mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}

// =============================================================================
// Clients
// =============================================================================
export function ClientsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyRecurrent, setOnlyRecurrent] = useState(false);
  const [onlyProblem, setOnlyProblem] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-clients', search, onlyRecurrent, onlyProblem, offset],
    queryFn: () => api.admin.listClients({
      limit, offset,
      search: search || undefined,
      only_recurrent: onlyRecurrent,
      only_problem: onlyProblem,
    }),
  });
  const [editing, setEditing] = useState<AdminClient | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-clients'] }); qc.invalidateQueries({ queryKey: ['clients'] }); };
  const delMut = useMutation({ mutationFn: api.admin.deleteClient, onSuccess: refresh });

  return (
    <div className="panel">
      <div className="panel-title flex items-center justify-between">
        <span>{data?.total ?? 0} clientes (mostrando {data?.rows.length ?? 0})</span>
        <button onClick={() => setCreating(true)} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={12} /> Nuevo cliente
        </button>
      </div>
      <div className="px-3 py-2 border-b border-line flex items-center gap-3 flex-wrap">
        <input
          className="input flex-1 min-w-[200px]"
          placeholder="Buscar por nombre, ID o dirección..."
          value={search}
          onChange={e => { setSearch(e.target.value); setOffset(0); }}
        />
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input type="checkbox" checked={onlyRecurrent}
                 onChange={e => { setOnlyRecurrent(e.target.checked); setOffset(0); }} />
          Solo recurrentes
        </label>
        <label className="flex items-center gap-1 text-xs text-text-secondary">
          <input type="checkbox" checked={onlyProblem}
                 onChange={e => { setOnlyProblem(e.target.checked); setOffset(0); }} />
          Solo zona problema
        </label>
      </div>

      {isLoading || !data ? (
        <div className="p-4 text-text-muted text-xs">Cargando...</div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: 600 }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-800 border-b border-line">
              <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-right">Lat / Lon</th>
                <th className="px-3 py-2 text-left">Tags</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(c => (
                <tr key={c.customer_id} className="border-b border-line/50 hover:bg-bg-700/30">
                  <td className="px-3 py-2 text-text-muted font-mono">{c.customer_id}</td>
                  <td className="px-3 py-2 max-w-[280px]">
                    <div className="font-semibold truncate" title={c.title}>{c.title}</div>
                    <div className="text-[10px] text-text-muted truncate">{c.address}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[10px] text-text-muted">
                    {c.latitude.toFixed(4)}<br />{c.longitude.toFixed(4)}
                  </td>
                  <td className="px-3 py-2">
                    {c.in_problem_comuna && <span className="pill pill-red mr-1">Zona</span>}
                    {c.is_recurrent && <span className="pill pill-yellow">Recurrente</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => setEditing(c)} className="text-accent-blue hover:underline text-xs flex items-center gap-1">
                        <Pencil size={12} /> Editar
                      </button>
                      <ConfirmDelete what={c.customer_id} onConfirm={() => delMut.mutate(c.customer_id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-3 py-2 border-t border-line flex items-center justify-between text-xs text-text-muted">
        <span>{offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} de {data?.total ?? 0}</span>
        <div className="flex gap-2">
          <button className="btn" disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}>
            ← Anterior
          </button>
          <button className="btn" disabled={!data || offset + limit >= data.total}
                  onClick={() => setOffset(offset + limit)}>
            Siguiente →
          </button>
        </div>
      </div>

      {creating && (
        <Modal title="Nuevo cliente" onClose={() => setCreating(false)}>
          <ClientForm
            onSubmit={async data => {
              await api.admin.createClient(data);
              refresh();
              setCreating(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Editar ${editing.customer_id}`} onClose={() => setEditing(null)}>
          <ClientForm
            initial={editing}
            isEdit
            onSubmit={async data => {
              await api.admin.updateClient(editing.customer_id, data);
              refresh();
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ClientForm({ initial, isEdit, onSubmit }: {
  initial?: AdminClient; isEdit?: boolean;
  onSubmit: (data: any) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [lat, setLat] = useState(initial?.latitude ?? -33.45);
  const [lon, setLon] = useState(initial?.longitude ?? -70.66);
  const [recurrent, setRecurrent] = useState(initial?.is_recurrent ?? false);
  const [problem, setProblem] = useState(initial?.in_problem_comuna ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form onSubmit={async e => {
      e.preventDefault();
      setSubmitting(true); setErr(null);
      try {
        await onSubmit({
          customer_id: customerId, title, address,
          latitude: lat, longitude: lon,
          is_recurrent: recurrent, in_problem_comuna: problem,
          notes: notes || null,
        });
      } catch (ex: any) { setErr(ex.message); setSubmitting(false); }
    }}>
      <FormRow label="Customer ID">
        <input className="input w-full" value={customerId}
               disabled={isEdit}
               onChange={e => setCustomerId(e.target.value)} required />
      </FormRow>
      <FormRow label="Razón social / nombre">
        <input className="input w-full" value={title}
               onChange={e => setTitle(e.target.value)} required />
      </FormRow>
      <FormRow label="Dirección">
        <input className="input w-full" value={address}
               onChange={e => setAddress(e.target.value)} required />
      </FormRow>
      <div className="grid grid-cols-2 gap-2">
        <FormRow label="Latitud">
          <input type="number" step="0.0001" className="input w-full" value={lat}
                 onChange={e => setLat(Number(e.target.value))} required />
        </FormRow>
        <FormRow label="Longitud">
          <input type="number" step="0.0001" className="input w-full" value={lon}
                 onChange={e => setLon(Number(e.target.value))} required />
        </FormRow>
      </div>
      <div className="flex gap-4 mb-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={recurrent} onChange={e => setRecurrent(e.target.checked)} />
          Cliente recurrente (history de fallos)
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={problem} onChange={e => setProblem(e.target.checked)} />
          Zona problema
        </label>
      </div>
      <FormRow label="Notas">
        <textarea className="input w-full" rows={2} value={notes}
                  onChange={e => setNotes(e.target.value)} />
      </FormRow>
      {err && <div className="text-accent-red text-xs mb-2">{err}</div>}
      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
