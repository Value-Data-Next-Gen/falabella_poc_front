import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Truck, UserIcon, ShieldCheck, AlertCircle, CheckCircle2, Copy,
  ClipboardCheck, MessageCircle, Loader2,
} from 'lucide-react';
import { api } from '../../api';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'driver' | 'jefe' | 'admin';

const TABS: Array<{ key: Tab; label: string; icon: any; desc: string }> = [
  { key: 'driver', label: 'Driver', icon: Truck, desc: 'Conductor de flota — recibe alertas y reporta motivos.' },
  { key: 'jefe', label: 'Jefe de flota', icon: UserIcon, desc: 'Manager de empresa — recibe alertas de su flota + intervenciones.' },
  { key: 'admin', label: 'Admin Falabella', icon: ShieldCheck, desc: 'Acceso global a todas las empresas. Solo crea otro admin Falabella.' },
];

export function InviteWizardModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('driver');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+56');
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [role, setRole] = useState<'falabella_admin' | 'falabella_ops'>('falabella_ops');
  const [result, setResult] = useState<{ link: string; token: string; nombre: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const empresasQ = useQuery({
    queryKey: ['wizard-empresas'],
    queryFn: api.empresaContactos.listEmpresas,
    enabled: open && tab !== 'admin',
    staleTime: 60_000,
  });
  const vehiclesQ = useQuery({
    queryKey: ['wizard-vehicles', empresaId],
    queryFn: api.admin.listVehicles,
    enabled: open && tab === 'driver',
    staleTime: 60_000,
  });
  const driversQ = useQuery({
    queryKey: ['wizard-drivers-current'],
    queryFn: api.admin.listDrivers,
    enabled: open && tab === 'driver',
    staleTime: 60_000,
  });

  // Vehicles libres = vehicles que NO tengan driver active asignado.
  const vehiclesLibres = useMemo(() => {
    const all = vehiclesQ.data ?? [];
    const used = new Set((driversQ.data ?? []).filter((d: any) => d.active).map((d: any) => d.vehicle_id));
    return all.filter((v: any) => !used.has(v.vehicle_id) && (empresaId === '' || v.empresa_id === empresaId));
  }, [vehiclesQ.data, driversQ.data, empresaId]);

  const reset = () => {
    setName(''); setEmail(''); setPhone('+56');
    setEmpresaId(''); setVehicleId(''); setRole('falabella_ops');
    setResult(null); setError(null); setCopied(false);
  };

  const closeAll = () => { reset(); onClose(); };

  const driverMut = useMutation({
    mutationFn: async () => {
      // 1) Crear driver
      const driver_id = `DRV-${Date.now().toString().slice(-6)}`;
      const v = vehiclesLibres.find((x: any) => x.vehicle_id === vehicleId);
      await api.admin.createDriver({
        driver_id,
        name: name.trim(),
        phone: phone.trim(),
        license: 'A-3 Profesional',
        empresa_id: Number(empresaId),
        vehicle_id: Number(vehicleId),
        vehicle_name: v?.name ?? `VAN-${vehicleId}`,
        rating: 4.5,
        deliveries_30d: 0,
        fail_rate_30d: 0,
        joined_at: new Date().toISOString().slice(0, 10),
        active: true,
      } as any);
      // 2) Get activation link
      const link = await api.admin.getDriverActivationLink(driver_id);
      return { ...link, nombre: name.trim() };
    },
    onSuccess: (data) => {
      setResult({ link: data.link!, token: data.token!, nombre: data.nombre });
      setError(null);
      qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (e: any) => setError(extractError(e)),
  });

  const jefeMut = useMutation({
    mutationFn: async () => {
      const created = await api.empresaContactos.create(Number(empresaId), {
        nombre: name.trim(),
        rol: 'jefe',
        phone_e164: phone.trim(),
        email: email.trim() || null,
        severities_in: ['HIGH', 'MEDIUM'],
        receive_alerts: true,
        active: true,
      } as any);
      const link = await api.empresaContactos.getActivationLink(Number(empresaId), created.contact_id);
      return { ...link, nombre: name.trim() };
    },
    onSuccess: (data) => {
      setResult({ link: data.link!, token: data.token!, nombre: data.nombre });
      setError(null);
      qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (e: any) => setError(extractError(e)),
  });

  const adminMut = useMutation({
    mutationFn: async () => {
      const created = await api.admin.createUser({
        email: email.trim(),
        password: Math.random().toString(36).slice(2, 10) + 'Aa1!',
        display_name: name.trim(),
        role,
        empresa_id: null,
        driver_id: null,
        activo: true,
        phone_e164: phone.trim() || null,
        notify_whatsapp: !!phone.trim(),
      });
      const link = await api.admin.getUserActivationLink(created.user_id);
      return { ...link, nombre: name.trim() };
    },
    onSuccess: (data) => {
      setResult({ link: data.link!, token: data.token!, nombre: data.nombre });
      setError(null);
      qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (e: any) => setError(extractError(e)),
  });

  const submit = () => {
    setError(null); setResult(null); setCopied(false);
    if (!name.trim()) return setError('Nombre requerido');
    if (tab !== 'admin' && !/^\+\d{8,15}$/.test(phone.trim())) return setError('Teléfono inválido. Formato +569XXXXXXXX');
    if (tab === 'driver') {
      if (!empresaId) return setError('Empresa requerida');
      if (!vehicleId) return setError('Vehículo requerido');
      driverMut.mutate();
    } else if (tab === 'jefe') {
      if (!empresaId) return setError('Empresa requerida');
      jefeMut.mutate();
    } else {
      if (!email.trim()) return setError('Email requerido para admin');
      adminMut.mutate();
    }
  };

  const isPending = driverMut.isPending || jefeMut.isPending || adminMut.isPending;

  const copyLink = async () => {
    if (!result?.link) return;
    try { await navigator.clipboard.writeText(result.link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-bg-800 border border-line rounded-lg max-w-xl w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Invitar persona nueva</h2>
          <button onClick={closeAll} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setResult(null); setError(null); }}
                className={`p-2 rounded border text-left ${
                  active ? 'border-brand bg-brand/10' : 'border-line hover:border-text-muted'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-medium">
                  <Icon size={12} className={active ? 'text-brand' : 'text-text-muted'} />
                  {t.label}
                </div>
                <div className="text-[10px] text-text-muted mt-1 leading-tight">{t.desc}</div>
              </button>
            );
          })}
        </div>

        {!result && (
          <>
            <div className="mb-2">
              <label className="text-[10px] text-text-muted block mb-1">Nombre</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={tab === 'driver' ? 'Juan Pérez' : tab === 'jefe' ? 'Carla Soto' : 'Pedro Vega'}
                className="input w-full text-[11px]"
                autoFocus
              />
            </div>

            {tab !== 'admin' && (
              <div className="mb-2">
                <label className="text-[10px] text-text-muted block mb-1">Teléfono (E.164, +569…)</label>
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+56912345678"
                  className="input w-full text-[11px]"
                />
              </div>
            )}

            {tab === 'admin' && (
              <>
                <div className="mb-2">
                  <label className="text-[10px] text-text-muted block mb-1">Email</label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@falabella.cl"
                    className="input w-full text-[11px]"
                    type="email"
                  />
                </div>
                <div className="mb-2">
                  <label className="text-[10px] text-text-muted block mb-1">Rol</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="input w-full text-[11px]"
                  >
                    <option value="falabella_ops">Falabella Ops (operación)</option>
                    <option value="falabella_admin">Falabella Admin (todo + config)</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="text-[10px] text-text-muted block mb-1">Teléfono (opcional, para WhatsApp)</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+56912345678"
                    className="input w-full text-[11px]"
                  />
                </div>
              </>
            )}

            {tab === 'jefe' && (
              <div className="mb-2">
                <label className="text-[10px] text-text-muted block mb-1">Email (opcional)</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="manager@empresa.cl"
                  className="input w-full text-[11px]"
                />
              </div>
            )}

            {tab !== 'admin' && (
              <div className="mb-2">
                <label className="text-[10px] text-text-muted block mb-1">Empresa de transporte</label>
                <select
                  value={empresaId}
                  onChange={e => setEmpresaId(Number(e.target.value) || '')}
                  className="input w-full text-[11px]"
                >
                  <option value="">— elegir empresa —</option>
                  {(empresasQ.data ?? []).map((e: any) => (
                    <option key={e.empresa_id} value={e.empresa_id}>
                      {e.empresa_id} · {e.empresa_nombre ?? e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tab === 'driver' && (
              <div className="mb-2">
                <label className="text-[10px] text-text-muted block mb-1">Vehículo libre</label>
                <select
                  value={vehicleId}
                  onChange={e => setVehicleId(Number(e.target.value) || '')}
                  className="input w-full text-[11px]"
                  disabled={!empresaId}
                >
                  <option value="">{empresaId ? '— elegir vehículo —' : 'Elegí empresa primero'}</option>
                  {vehiclesLibres.map((v: any) => (
                    <option key={v.vehicle_id} value={v.vehicle_id}>
                      VAN-{v.vehicle_id} · {v.plate ?? v.name}
                    </option>
                  ))}
                </select>
                {empresaId && vehiclesLibres.length === 0 && (
                  <div className="text-[10px] text-accent-yellow mt-1">
                    No hay vehículos libres en esta empresa. Crear uno en Mantenedores → Vehículos.
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="text-[11px] text-accent-red flex items-center gap-1 mb-2 bg-accent-red/10 border border-accent-red/30 rounded px-2 py-1.5">
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <button onClick={closeAll} className="btn !text-[11px] !py-1.5 !px-3">Cancelar</button>
              <button
                onClick={submit}
                disabled={isPending}
                className="btn-primary !text-[11px] !py-1.5 !px-3 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isPending && <Loader2 size={11} className="animate-spin" />}
                Crear y generar link
              </button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="bg-brand/10 border border-brand/30 rounded p-3">
              <div className="flex items-center gap-2 text-brand mb-1.5">
                <CheckCircle2 size={14} />
                <span className="text-[12px] font-semibold">¡Invitación generada para {result.nombre}!</span>
              </div>
              <div className="text-[10px] text-text-muted mb-2">
                Compartile este link a {result.nombre}. Cuando le pulse "Enviar", abrirá su WhatsApp con
                el mensaje <span className="text-text-secondary font-mono">ACTIVAR {result.token}</span> pre-rellenado.
                Al enviarlo, su cuenta queda activa.
              </div>
              <div className="bg-bg-900 rounded px-2 py-1.5 text-[10px] font-mono break-all text-text-secondary mb-2">
                {result.link}
              </div>
              <div className="flex gap-1.5">
                <button onClick={copyLink} className="btn !text-[11px] !py-1.5 !px-3 flex items-center gap-1">
                  {copied ? <ClipboardCheck size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado!' : 'Copiar link'}
                </button>
                <a
                  href={result.link}
                  target="_blank" rel="noopener noreferrer"
                  className="btn !text-[11px] !py-1.5 !px-3 flex items-center gap-1 text-accent-green"
                >
                  <MessageCircle size={12} /> Abrir WhatsApp
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hola ${result.nombre}, te invitan a la torre de control Falabella. Para activar tu cuenta, hacé click acá: ${result.link}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="btn !text-[11px] !py-1.5 !px-3 flex items-center gap-1 text-brand"
                >
                  <MessageCircle size={12} /> Compartir con mensaje
                </a>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={reset} className="btn !text-[11px] !py-1.5 !px-3">Invitar otra persona</button>
              <button onClick={closeAll} className="btn-primary !text-[11px] !py-1.5 !px-3">Cerrar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function extractError(e: any): string {
  if (typeof e?.message === 'string') return e.message;
  if (e?.detail) return typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail);
  return String(e);
}
