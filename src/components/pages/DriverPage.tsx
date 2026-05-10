import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, GraduationCap,
  Loader2, Trash2, Truck, Upload, User,
} from 'lucide-react';
import { api, getToken } from '../../api';
import {
  CapacitacionModulo, DriverCapacitacion, DriverDocTipo, DriverDocument,
} from '../../types';
import { Modal } from '../shared/Modal';
import { Plus } from 'lucide-react';

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
        {tab === 'documentos' && <DocumentosTab driverId={driverId} />}
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

const TIPO_LABELS: Record<DriverDocTipo, string> = {
  licencia:      'Licencia de conducir',
  antecedentes:  'Antecedentes',
  contrato:      'Contrato',
  poliza:        'Póliza de seguro',
  certificacion: 'Certificación',
  otro:          'Otro',
};

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

function DocumentosTab({ driverId }: { driverId: string }) {
  const qc = useQueryClient();
  const docsQ = useQuery({
    queryKey: ['driver-docs', driverId],
    queryFn: () => api.admin.listDriverDocs(driverId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['driver-docs', driverId] });

  const delMut = useMutation({
    mutationFn: (doc_id: number) => api.admin.deleteDriverDoc(driverId, doc_id),
    onSuccess: refresh,
  });

  const docs = docsQ.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <UploadDocBox driverId={driverId} onUploaded={refresh} />

      <div className="panel">
        <div className="panel-title flex items-center justify-between">
          <span>{docs.length} {docs.length === 1 ? 'documento' : 'documentos'}</span>
        </div>
        {docsQ.isLoading ? (
          <div className="p-4 text-text-muted text-xs">Cargando…</div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-text-muted text-xs italic text-center">
            Sin documentos. Subí el primero arriba.
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Archivo</th>
                <th className="px-3 py-2 text-right">Tamaño</th>
                <th className="px-3 py-2 text-left">Subido</th>
                <th className="px-3 py-2 text-left">Vencimiento</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <DocRow key={d.doc_id} doc={d} driverId={driverId}
                        onDelete={() => {
                          if (confirm(`Eliminar ${d.filename}?`)) delMut.mutate(d.doc_id);
                        }} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DocRow({ doc, driverId, onDelete }: {
  doc: DriverDocument; driverId: string; onDelete: () => void;
}) {
  const [downloading, setDownloading] = useState(false);
  const expSoon = doc.expires_at ? new Date(doc.expires_at) <= new Date(Date.now() + 30 * 86400_000) : false;
  const expired = doc.expires_at ? new Date(doc.expires_at) < new Date() : false;

  const onDownload = async () => {
    setDownloading(true);
    try {
      const t = getToken();
      const r = await fetch(
        `${BASE}/admin/drivers/${encodeURIComponent(driverId)}/documents/${doc.doc_id}/download`,
        { headers: t ? { Authorization: `Bearer ${t}` } : {} },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Descarga falló: ${e instanceof Error ? e.message : e}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <tr className="border-b border-line/50">
      <td className="px-3 py-2">
        <span className="pill bg-accent-blue/15 text-accent-blue border-accent-blue/40 border">
          {TIPO_LABELS[doc.tipo as DriverDocTipo] ?? doc.tipo}
        </span>
      </td>
      <td className="px-3 py-2 truncate max-w-[260px]" title={doc.filename}>{doc.filename}</td>
      <td className="px-3 py-2 text-right tabular-nums text-text-muted">
        {(doc.file_size / 1024).toFixed(1)} KB
      </td>
      <td className="px-3 py-2 text-text-muted">
        {new Date(doc.uploaded_at).toLocaleDateString('es-CL')}
      </td>
      <td className="px-3 py-2">
        {doc.expires_at ? (
          <span className={expired ? 'text-accent-red font-semibold' : expSoon ? 'text-accent-yellow' : ''}>
            {doc.expires_at}
            {expired && ' (vencido)'}
          </span>
        ) : <span className="text-text-muted">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onDownload} disabled={downloading}
                  className="text-accent-blue hover:underline">
            {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          </button>
          <button onClick={onDelete} className="text-accent-red hover:underline">
            <Trash2 size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function UploadDocBox({ driverId, onUploaded }: { driverId: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<DriverDocTipo>('licencia');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const onPick = () => inputRef.current?.click();

  const onUpload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const t = getToken();
      const params = new URLSearchParams({ tipo });
      if (expiresAt) params.set('expires_at', expiresAt);
      if (notes.trim()) params.set('notes', notes.trim());
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(
        `${BASE}/admin/drivers/${encodeURIComponent(driverId)}/documents?${params.toString()}`,
        { method: 'POST', headers: t ? { Authorization: `Bearer ${t}` } : {}, body: fd },
      );
      if (!r.ok) {
        let detail = r.statusText;
        try { const j = await r.json(); if (j?.detail) detail = j.detail; } catch {}
        throw new Error(detail);
      }
      setMsg({ kind: 'ok', text: `${file.name} subido` });
      setExpiresAt(''); setNotes('');
      onUploaded();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.message ?? 'error' });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
        <Upload size={12} /> Subir documento
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Tipo</span>
          <select className="input !py-1 !text-[11px]" value={tipo}
                  onChange={e => setTipo(e.target.value as DriverDocTipo)}>
            {(Object.keys(TIPO_LABELS) as DriverDocTipo[]).map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Vencimiento (opcional)</span>
          <input type="date" className="input !py-1 !text-[11px]"
                 value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Notas (opcional)</span>
          <input className="input !py-1 !text-[11px]"
                 value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onPick} disabled={busy}
                className="btn-primary text-[11px] flex items-center gap-1 disabled:opacity-50">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          Seleccionar archivo
        </button>
        <input ref={inputRef} type="file" className="hidden"
               onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        <span className="text-[10px] text-text-muted">Máx 25MB</span>
        {msg && (
          <span className={`text-[10px] flex items-center gap-1 ${
            msg.kind === 'ok' ? 'text-accent-green' : 'text-accent-red'
          }`}>
            {msg.kind === 'ok' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
            {msg.text}
          </span>
        )}
      </div>
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
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
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
                  <td className="px-3 py-2 text-text-secondary truncate max-w-[200px]" title={c.notas ?? ''}>
                    {c.notas ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => {
                              if (confirm('Eliminar este registro?')) delMut.mutate(c.cap_id);
                            }}
                            className="text-accent-red hover:underline">
                      <Trash2 size={11} />
                    </button>
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
