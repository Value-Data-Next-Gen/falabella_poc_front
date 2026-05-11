import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, CheckCircle2, Download, FileText, Loader2, Trash2, Upload,
} from 'lucide-react';
import { api, getToken } from '../../api';
import { DocEntityType, DocumentType, EntityDocument } from '../../types';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

interface Props {
  entityType: DocEntityType;
  entityId: number | string;
  /** Etiqueta de la entidad para textos amigables (ej: "empresa", "vehículo"). */
  label?: string;
}

/** Componente reusable: lista + sube + descarga + borra documentos de una entidad.
 *  Tipos vienen del catálogo `document_types` filtrado por entityType.
 *  Muestra status vs catálogo (faltan obligatorios, vencimientos próximos).
 */
export function EntityDocumentsTab({ entityType, entityId, label }: Props) {
  const qc = useQueryClient();
  const docsQ = useQuery({
    queryKey: [`${entityType}-docs`, entityId],
    queryFn: () => fetchDocs(entityType, entityId),
  });
  const typesQ = useQuery({
    queryKey: ['doc-types', entityType],
    queryFn: () => api.admin.listDocTypes({ entity_type: entityType, only_active: true }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: [`${entityType}-docs`, entityId] });

  const delMut = useMutation({
    mutationFn: (doc_id: number) => deleteDoc(entityType, entityId, doc_id),
    onSuccess: refresh,
  });

  const docs = docsQ.data ?? [];
  const types = typesQ.data ?? [];

  // Coverage per tipo: último doc por codigo
  const latestByTipo = new Map<string, EntityDocument>();
  for (const d of docs) {
    const prev = latestByTipo.get(d.tipo);
    if (!prev || new Date(d.uploaded_at) > new Date(prev.uploaded_at)) {
      latestByTipo.set(d.tipo, d);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <UploadBox entityType={entityType} entityId={entityId} types={types} onUploaded={refresh} />

      {types.length > 0 && (
        <div className="panel">
          <div className="panel-title">Status por tipo de documento</div>
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Última subida</th>
                <th className="px-3 py-2 text-left">Vence</th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => {
                const last = latestByTipo.get(t.codigo);
                const expired = last?.expires_at && new Date(last.expires_at) < new Date();
                const soon = last?.expires_at && new Date(last.expires_at) <= new Date(Date.now() + 30 * 86400_000);
                let pill = 'bg-bg-700 text-text-muted border-line border';
                let pillLabel = 'Falta';
                if (last && expired) { pill = 'pill-red'; pillLabel = 'Vencido'; }
                else if (last && soon) { pill = 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border'; pillLabel = 'Por vencer'; }
                else if (last) { pill = 'pill-green'; pillLabel = 'OK'; }
                else if (!t.mandatory) { pillLabel = 'Opcional'; }
                return (
                  <tr key={t.doc_type_id} className="border-b border-line/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{t.nombre}</div>
                      <div className="text-[10px] text-text-muted">
                        {t.codigo} {t.mandatory && <span className="text-accent-red">· obligatorio</span>}
                        {t.validez_meses && ` · validez ${t.validez_meses}m`}
                      </div>
                    </td>
                    <td className="px-3 py-2"><span className={`pill ${pill}`}>{pillLabel}</span></td>
                    <td className="px-3 py-2 text-text-muted">
                      {last ? new Date(last.uploaded_at).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td className="px-3 py-2 text-text-muted">{last?.expires_at ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">{docs.length} {docs.length === 1 ? 'archivo' : 'archivos'} subidos</div>
        {docsQ.isLoading ? (
          <div className="p-4 text-text-muted text-xs">Cargando…</div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-text-muted text-xs italic text-center">
            Sin documentos para {label ?? entityType}. Subí el primero arriba.
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Archivo</th>
                <th className="px-3 py-2 text-right">Tamaño</th>
                <th className="px-3 py-2 text-left">Subido</th>
                <th className="px-3 py-2 text-left">Vence</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <DocRow key={d.doc_id} doc={d} types={types} entityType={entityType} entityId={entityId}
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


function UploadBox({ entityType, entityId, types, onUploaded }: {
  entityType: DocEntityType; entityId: number | string;
  types: DocumentType[]; onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState(types[0]?.codigo ?? '');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Auto-seleccionar primer tipo cuando lleguen los types
  if (!tipo && types.length > 0) {
    setTimeout(() => setTipo(types[0].codigo), 0);
  }

  const onUpload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const t = getToken();
      const params = new URLSearchParams({ tipo });
      if (expiresAt) params.set('expires_at', expiresAt);
      if (notes.trim()) params.set('notes', notes.trim());
      const fd = new FormData();
      fd.append('file', file);
      const path = pathFor(entityType, entityId);
      const r = await fetch(`${BASE}${path}/documents?${params.toString()}`, {
        method: 'POST',
        headers: t ? { Authorization: `Bearer ${t}` } : {},
        body: fd,
      });
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
                  onChange={e => setTipo(e.target.value)} disabled={types.length === 0}>
            {types.length === 0 && <option>— sin tipos en catálogo —</option>}
            {types.map(t => (
              <option key={t.doc_type_id} value={t.codigo}>
                {t.nombre}{t.mandatory ? ' *' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Vencimiento</span>
          <input type="date" className="input !py-1 !text-[11px]"
                 value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Notas</span>
          <input className="input !py-1 !text-[11px]"
                 value={notes} onChange={e => setNotes(e.target.value)} maxLength={500} />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => inputRef.current?.click()} disabled={busy || !tipo}
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


function DocRow({ doc, types, entityType, entityId, onDelete }: {
  doc: EntityDocument; types: DocumentType[];
  entityType: DocEntityType; entityId: number | string;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const tipoLabel = types.find(t => t.codigo === doc.tipo)?.nombre ?? doc.tipo;
  const expired = doc.expires_at ? new Date(doc.expires_at) < new Date() : false;

  const onDownload = async () => {
    setBusy(true);
    try {
      const t = getToken();
      const path = pathFor(entityType, entityId);
      const r = await fetch(`${BASE}${path}/documents/${doc.doc_id}/download`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Descarga falló: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-b border-line/50">
      <td className="px-3 py-2">
        <span className="pill bg-accent-blue/15 text-accent-blue border-accent-blue/40 border">{tipoLabel}</span>
      </td>
      <td className="px-3 py-2 truncate max-w-[240px]" title={doc.filename}>
        <FileText size={11} className="inline mr-1 text-text-muted" />
        {doc.filename}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-text-muted">
        {(doc.file_size / 1024).toFixed(1)} KB
      </td>
      <td className="px-3 py-2 text-text-muted">{new Date(doc.uploaded_at).toLocaleDateString('es-CL')}</td>
      <td className="px-3 py-2">
        {doc.expires_at ? (
          <span className={expired ? 'text-accent-red font-semibold' : ''}>
            {doc.expires_at}{expired && ' (vencido)'}
          </span>
        ) : <span className="text-text-muted">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onDownload} disabled={busy} className="text-accent-blue hover:underline">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          </button>
          <button onClick={onDelete} className="text-accent-red hover:underline">
            <Trash2 size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
}


function pathFor(entityType: DocEntityType, id: number | string): string {
  if (entityType === 'driver') return `/admin/drivers/${encodeURIComponent(String(id))}`;
  if (entityType === 'vehicle') return `/admin/vehicles/${id}`;
  return `/admin/empresas/${id}`;
}

async function fetchDocs(entityType: DocEntityType, id: number | string): Promise<EntityDocument[]> {
  if (entityType === 'driver') {
    const docs = await api.admin.listDriverDocs(String(id));
    // Adaptar DriverDocument → EntityDocument shape (driver_id → entity_id no aplica aquí)
    return docs.map(d => ({ ...d, entity_id: 0 } as unknown as EntityDocument));
  }
  if (entityType === 'vehicle') return api.admin.listVehicleDocs(Number(id));
  return api.admin.listEmpresaDocs(Number(id));
}

async function deleteDoc(entityType: DocEntityType, id: number | string, doc_id: number) {
  if (entityType === 'driver') return api.admin.deleteDriverDoc(String(id), doc_id);
  if (entityType === 'vehicle') return api.admin.deleteVehicleDoc(Number(id), doc_id);
  return api.admin.deleteEmpresaDoc(Number(id), doc_id);
}
