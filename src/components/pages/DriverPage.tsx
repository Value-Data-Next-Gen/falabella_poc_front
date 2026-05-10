import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, GraduationCap,
  Loader2, Trash2, Truck, Upload, User,
} from 'lucide-react';
import { api, getToken } from '../../api';
import { DriverDocTipo, DriverDocument } from '../../types';

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
