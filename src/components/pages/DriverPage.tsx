import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, GraduationCap,
  Loader2, Trash2, Truck, Upload, User,
} from 'lucide-react';
import { api, getToken } from '../../api';
import {
  CapacitacionModulo, DriverCapacitacion,
} from '../../types';
import { Modal } from '../shared/Modal';
import { EntityDocumentsTab } from '../shared/EntityDocumentsTab';
import { Plus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
        {tab === 'documentos' && (
          <EntityDocumentsTab entityType="driver" entityId={driverId} label="este driver" />
        )}
        {tab === 'capacitaciones' && <CapacitacionesTab driverId={driverId} />}
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

type CapStatus = 'ok' | 'expira-pronto' | 'vencida' | 'pendiente';

function _capStatus(c?: DriverCapacitacion): CapStatus {
  if (!c) return 'pendiente';
  if (!c.vence_at) return 'ok';
  const exp = new Date(c.vence_at);
  const now = new Date();
  if (exp < now) return 'vencida';
  if (exp <= new Date(now.getTime() + 30 * 86400_000)) return 'expira-pronto';
  return 'ok';
}

const STATUS_PILL: Record<CapStatus, { cls: string; label: string }> = {
  ok:             { cls: 'pill-green',   label: 'Vigente' },
  'expira-pronto':{ cls: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border', label: 'Por vencer' },
  vencida:        { cls: 'pill-red',     label: 'Vencida' },
  pendiente:      { cls: 'bg-bg-700 text-text-muted border-line border', label: 'Pendiente' },
};

function CapacitacionesTab({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const { isFalabella } = useAuth();
  const modulosQ = useQuery({
    queryKey: ['cap-modulos', true],
    queryFn: () => api.admin.listCapacitacionModulos(true),
  });
  const capsQ = useQuery({
    queryKey: ['driver-caps', driverId],
    queryFn: () => api.admin.listDriverCapacitaciones(driverId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['driver-caps', driverId] });

  const [registering, setRegistering] = useState<CapacitacionModulo | null>(null);

  const delMut = useMutation({
    mutationFn: (cap_id: number) => api.admin.deleteDriverCapacitacion(driverId, cap_id),
    onSuccess: refresh,
  });
  const validateMut = useMutation({
    mutationFn: (cap_id: number) => api.admin.validateDriverCapacitacion(driverId, cap_id),
    onSuccess: refresh,
  });
  const unvalidateMut = useMutation({
    mutationFn: (cap_id: number) => api.admin.unvalidateDriverCapacitacion(driverId, cap_id),
    onSuccess: refresh,
  });

  // Última capacitación por módulo
  const latestByModulo = new Map<number, DriverCapacitacion>();
  for (const c of capsQ.data ?? []) {
    const prev = latestByModulo.get(c.modulo_id);
    if (!prev || new Date(c.fecha_completado) > new Date(prev.fecha_completado)) {
      latestByModulo.set(c.modulo_id, c);
    }
  }

  if (modulosQ.isLoading || capsQ.isLoading) {
    return <div className="panel p-4 text-text-muted text-xs">Cargando…</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="panel">
        <div className="panel-title">Estado por módulo</div>
        <table className="w-full text-[12px]">
          <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">Módulo</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2 text-left">Última fecha</th>
              <th className="px-3 py-2 text-left">Vence</th>
              <th className="px-3 py-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {(modulosQ.data ?? []).map(m => {
              const last = latestByModulo.get(m.modulo_id);
              const st = _capStatus(last);
              const pill = STATUS_PILL[st];
              return (
                <tr key={m.modulo_id} className="border-b border-line/50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.nombre}</div>
                    <div className="text-[10px] text-text-muted">
                      {m.codigo} · validez {m.validez_meses} meses
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className={`pill ${pill.cls}`}>{pill.label}</span>
                      {last && (last.validated_at ? (
                        <span title={`Validado por ${last.validated_by_name ?? '—'}`}>
                          <ShieldCheck size={11} className="text-accent-green" />
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-muted" title="Sin validación Falabella">·sin val.</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {last ? new Date(last.fecha_completado).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {last?.vence_at ? new Date(last.vence_at).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setRegistering(m)}
                            className="btn-primary text-[11px] flex items-center gap-1 ml-auto">
                      <Plus size={10} /> {last ? 'Renovar' : 'Registrar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title flex items-center justify-between">
          <span>Histórico ({capsQ.data?.length ?? 0})</span>
        </div>
        {(capsQ.data ?? []).length === 0 ? (
          <div className="p-4 text-text-muted text-xs italic text-center">
            Aún sin registros. Registrá la primera capacitación con los botones de arriba.
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Módulo</th>
                <th className="px-3 py-2 text-left">Completado</th>
                <th className="px-3 py-2 text-left">Vence</th>
                <th className="px-3 py-2 text-left">Validación</th>
                <th className="px-3 py-2 text-left">Notas</th>
                <th className="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {(capsQ.data ?? []).map(c => (
                <tr key={c.cap_id} className="border-b border-line/50">
                  <td className="px-3 py-2">{c.modulo_nombre}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {new Date(c.fecha_completado).toLocaleDateString('es-CL')}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {c.vence_at ? new Date(c.vence_at).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {c.validated_at ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="pill pill-green text-[9px] inline-flex items-center gap-1 w-fit">
                          <ShieldCheck size={9} /> Validado
                        </span>
                        <span className="text-[9px] text-text-muted">
                          {c.validated_by_name ?? `user #${c.validated_by_user_id}`}
                          {' · '}
                          {new Date(c.validated_at).toLocaleDateString('es-CL')}
                        </span>
                      </div>
                    ) : (
                      <span className="pill bg-bg-700 text-text-muted border-line border text-[9px]">
                        Pendiente validación
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-secondary truncate max-w-[160px]" title={c.notas ?? ''}>
                    {c.notas ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {isFalabella && (
                        c.validated_at ? (
                          <button onClick={() => unvalidateMut.mutate(c.cap_id)}
                                  className="text-text-muted hover:text-accent-yellow text-[10px]"
                                  title="Quitar validación">
                            quitar val.
                          </button>
                        ) : (
                          <button onClick={() => validateMut.mutate(c.cap_id)}
                                  className="text-accent-green hover:underline text-[10px] flex items-center gap-1"
                                  title="Validar capacitación (solo Falabella)">
                            <ShieldCheck size={10} /> validar
                          </button>
                        )
                      )}
                      <button onClick={() => {
                                if (confirm('Eliminar este registro?')) delMut.mutate(c.cap_id);
                              }}
                              className="text-accent-red hover:underline">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {registering && (
        <CapacitacionFormModal
          driverId={driverId}
          modulo={registering}
          onClose={() => setRegistering(null)}
          onSaved={() => { refresh(); setRegistering(null); }}
        />
      )}
    </div>
  );
}

function CapacitacionFormModal({ driverId, modulo, onClose, onSaved }: {
  driverId: string;
  modulo: CapacitacionModulo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(today);
  const [vence, setVence] = useState('');  // si vacío, backend calcula
  const [notas, setNotas] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await api.admin.createDriverCapacitacion(driverId, {
        modulo_id: modulo.modulo_id,
        fecha_completado: fecha,
        vence_at: vence || null,
        notas: notas.trim() || null,
      });
      onSaved();
    } catch (ex: any) {
      setErr(ex?.message ?? 'error');
      setSaving(false);
    }
  };

  return (
    <Modal title={`Registrar: ${modulo.nombre}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 text-[12px]">
        <div className="text-[11px] text-text-muted">
          Validez configurada: <strong>{modulo.validez_meses} meses</strong>. Si dejás vencimiento vacío, se calcula automáticamente.
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Fecha completado</span>
          <input type="date" className="input" required value={fecha}
                 onChange={e => setFecha(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">
            Vencimiento (opcional, calculado si vacío)
          </span>
          <input type="date" className="input" value={vence}
                 onChange={e => setVence(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Notas</span>
          <textarea className="input" rows={2} maxLength={500}
                    value={notas} onChange={e => setNotas(e.target.value)} />
        </label>
        {err && <div className="text-accent-red text-[11px]">{err}</div>}
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Guardando…' : 'Registrar'}
        </button>
      </form>
    </Modal>
  );
}
