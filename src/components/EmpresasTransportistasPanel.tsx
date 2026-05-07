import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, CheckCircle2, Clock, Download, FileWarning, Pencil, Plus, Send,
  ShieldAlert, Trash2, Upload, UserCheck, X,
} from 'lucide-react';
import { api } from '../api';
import {
  BulkCSVResult, Contacto, ContactoCreate, ContactoRegion, ContactoRol,
  EmpresaSummary, MotivoSeverity, TestBroadcastResult,
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


export function EmpresasTransportistasPanel() {
  const { isFalabella } = useAuth();

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

  const empresasQ = useQuery({
    queryKey: ['empresa-contactos-list'],
    queryFn: api.empresaContactos.listEmpresas,
  });

  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaSummary | null>(null);

  const downloadGlobalTemplate = () => {
    // Cualquier empresa ID sirve; el contenido es el mismo. Usamos 0 para
    // dejar claro que es genérico.
    api.empresaContactos.downloadCsvTemplate(0).catch(() => void 0);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            <Building2 size={16} /> Empresas transportistas
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Configurá los destinatarios de WhatsApp por empresa. Separados de los
            usuarios login: un contacto puede recibir alertas sin tener cuenta.
          </p>
        </div>
        <button onClick={downloadGlobalTemplate}
                className="btn text-xs flex items-center gap-1">
          <Download size={12} /> CSV template
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">
          <span>{empresasQ.data?.length ?? 0} empresas</span>
        </div>
        {empresasQ.isLoading || !empresasQ.data ? (
          <div className="p-4 text-text-muted text-xs">Cargando…</div>
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
              {empresasQ.data.map(e => (
                <tr key={e.empresa_id} className="border-b border-line/50 hover:bg-bg-700/30">
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
                      onClick={() => setSelectedEmpresa(e)}
                      className="text-accent-blue hover:underline text-xs"
                    >
                      Ver contactos →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedEmpresa && (
        <EmpresaDrawer
          empresa={selectedEmpresa}
          onClose={() => setSelectedEmpresa(null)}
        />
      )}
    </div>
  );
}


// =============================================================================
// Drawer lateral
// =============================================================================
type DrawerTab = 'contactos' | 'csv' | 'broadcast';

function EmpresaDrawer({ empresa, onClose }: { empresa: EmpresaSummary; onClose: () => void }) {
  const [tab, setTab] = useState<DrawerTab>('contactos');

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <aside
        onClick={e => e.stopPropagation()}
        className="relative bg-bg-800 border-l border-line w-[480px] max-w-full h-full overflow-auto flex flex-col"
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
            { key: 'csv' as const,       label: 'Importar CSV' },
            { key: 'broadcast' as const, label: 'Test broadcast' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-2 text-[11px] uppercase tracking-wider border-b-2 ${
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
          {tab === 'csv' && <CSVTab empresaId={empresa.empresa_id} />}
          {tab === 'broadcast' && <BroadcastTab empresa={empresa} />}
        </div>
      </aside>
    </div>
  );
}


// =============================================================================
// Tab: contactos (CRUD)
// =============================================================================
function ContactosTab({ empresaId }: { empresaId: number }) {
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
function CSVTab({ empresaId }: { empresaId: number }) {
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
function BroadcastTab({ empresa }: { empresa: EmpresaSummary }) {
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
