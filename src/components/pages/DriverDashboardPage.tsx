import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, FileText, GraduationCap, LogOut, MapPin, Truck, User,
} from 'lucide-react';
import { api, getToken } from '../../api';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../shared/Modal';
import { Upload, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRef } from 'react';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

type TabKey = 'pedidos' | 'documentos' | 'capacitaciones';

export function DriverDashboardPage() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<TabKey>('pedidos');

  const profileQ = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.me.profile(),
  });

  return (
    <div className="h-full flex flex-col bg-bg-900">
      {/* Header simple */}
      <header className="h-14 border-b border-line bg-bg-800 px-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-md bg-brand text-white flex items-center justify-center font-bold">
          VD
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">
            {profileQ.data?.name ?? user?.display_name}
          </div>
          <div className="text-[10px] text-text-muted truncate">
            {profileQ.data?.empresa_nombre ?? '—'} · {profileQ.data?.vehicle_name ?? '—'}{' '}
            {profileQ.data?.plate ? <span className="font-mono">({profileQ.data.plate})</span> : null}
          </div>
        </div>
        <button onClick={logout}
                className="btn !py-1 !px-2 text-[11px] flex items-center gap-1 text-text-muted">
          <LogOut size={12} /> Salir
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-line bg-bg-800">
        {([
          { key: 'pedidos',        label: 'Mis pedidos',     icon: MapPin       },
          { key: 'documentos',     label: 'Mis documentos',  icon: FileText     },
          { key: 'capacitaciones', label: 'Capacitaciones',  icon: GraduationCap },
        ] as { key: TabKey; label: string; icon: any }[]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[12px] uppercase tracking-wider border-b-2 ${
                tab === t.key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-auto p-4">
        {tab === 'pedidos'        && <MisPedidosTab />}
        {tab === 'documentos'     && <MisDocumentosTab />}
        {tab === 'capacitaciones' && <MisCapacitacionesTab />}
      </main>
    </div>
  );
}

function MisPedidosTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(today);
  const ordersQ = useQuery({
    queryKey: ['me-orders', fecha],
    queryFn: () => api.me.orders(fecha),
  });

  const orders = ordersQ.data ?? [];
  const completadas = orders.filter(o => o.status === 'completed').length;
  const pendientes = orders.filter(o => o.status === 'pending').length;
  const fallidas = orders.filter(o => o.status === 'failed').length;

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-text-muted" />
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="input !py-1 !text-[12px] font-mono"
          />
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-text-muted">{orders.length} pedidos</span>
          <span className="pill pill-green">{completadas} OK</span>
          {pendientes > 0 && <span className="pill bg-accent-blue/15 text-accent-blue border-accent-blue/40 border">{pendientes} pendientes</span>}
          {fallidas > 0 && <span className="pill pill-red">{fallidas} fallidas</span>}
        </div>
      </div>
      {ordersQ.isLoading ? (
        <div className="panel p-4 text-text-muted text-xs">Cargando…</div>
      ) : orders.length === 0 ? (
        <div className="panel p-8 text-center text-text-muted text-xs">
          <Truck size={32} className="mx-auto mb-2 text-text-muted/40" />
          <div>Sin pedidos asignados para {fecha}</div>
        </div>
      ) : (
        <div className="panel">
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Dirección</th>
                <th className="px-3 py-2 text-left">ETA</th>
                <th className="px-3 py-2 text-left">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.tracking_id} className="border-b border-line/50">
                  <td className="px-3 py-2 font-mono text-[10px]">{o.order}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium truncate max-w-[200px]" title={o.title}>{o.title}</div>
                    {o.reference && <div className="text-[10px] text-text-muted">#{o.reference}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="truncate max-w-[260px]" title={o.address}>{o.address}</div>
                    {o.comuna && <div className="text-[10px] text-text-muted">{o.comuna}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono">{o.current_eta_hhmm}</td>
                  <td className="px-3 py-2">
                    <span className={`pill ${
                      o.status === 'completed' ? 'pill-green' :
                      o.status === 'failed' ? 'pill-red' :
                      'bg-accent-blue/15 text-accent-blue border-accent-blue/40 border'
                    }`}>
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const TIPO_LABELS: Record<string, string> = {
  licencia: 'Licencia de conducir',
  antecedentes: 'Antecedentes',
  contrato: 'Contrato',
  poliza: 'Póliza',
  certificacion: 'Certificación',
  otro: 'Otro',
};

function MisDocumentosTab() {
  const [uploading, setUploading] = useState(false);
  const docsQ = useQuery({
    queryKey: ['me-docs'],
    queryFn: () => api.me.documents(),
  });
  const docs = docsQ.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <UploadMyDocBox onUploaded={() => docsQ.refetch()} disabled={uploading} setDisabled={setUploading} />

      <div className="panel">
        <div className="panel-title">{docs.length} {docs.length === 1 ? 'documento' : 'documentos'}</div>
        {docsQ.isLoading ? (
          <div className="p-4 text-text-muted text-xs">Cargando…</div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-text-muted text-xs italic text-center">
            Aún no subiste nada. Usá el formulario de arriba.
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Archivo</th>
                <th className="px-3 py-2 text-left">Subido</th>
                <th className="px-3 py-2 text-left">Vence</th>
                <th className="px-3 py-2 text-right">Descargar</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <MyDocRow key={d.doc_id} doc={d} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MyDocRow({ doc }: { doc: any }) {
  const [busy, setBusy] = useState(false);
  const onDownload = async () => {
    setBusy(true);
    try {
      const t = getToken();
      const r = await fetch(`${BASE}/me/documents/${doc.doc_id}/download`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Descarga falló: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };
  const expired = doc.expires_at ? new Date(doc.expires_at) < new Date() : false;

  return (
    <tr className="border-b border-line/50">
      <td className="px-3 py-2">
        <span className="pill bg-accent-blue/15 text-accent-blue border-accent-blue/40 border">
          {TIPO_LABELS[doc.tipo] ?? doc.tipo}
        </span>
      </td>
      <td className="px-3 py-2 truncate max-w-[200px]" title={doc.filename}>{doc.filename}</td>
      <td className="px-3 py-2 text-text-muted">{new Date(doc.uploaded_at).toLocaleDateString('es-CL')}</td>
      <td className="px-3 py-2">
        {doc.expires_at ? (
          <span className={expired ? 'text-accent-red font-semibold' : ''}>
            {doc.expires_at}{expired && ' (vencido)'}
          </span>
        ) : <span className="text-text-muted">—</span>}
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={onDownload} disabled={busy} className="text-accent-blue hover:underline">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
        </button>
      </td>
    </tr>
  );
}

function UploadMyDocBox({ onUploaded, disabled, setDisabled }: {
  onUploaded: () => void;
  disabled: boolean;
  setDisabled: (b: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState('licencia');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const onUpload = async (file: File) => {
    setDisabled(true); setMsg(null);
    try {
      const t = getToken();
      const params = new URLSearchParams({ tipo });
      if (expiresAt) params.set('expires_at', expiresAt);
      if (notes.trim()) params.set('notes', notes.trim());
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${BASE}/me/documents?${params.toString()}`, {
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
      setDisabled(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-text-muted mb-2 flex items-center gap-2">
        <Upload size={12} /> Subir mi documento
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Tipo</span>
          <select className="input !py-1 !text-[11px]" value={tipo}
                  onChange={e => setTipo(e.target.value)}>
            {Object.keys(TIPO_LABELS).map(t => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
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
        <button onClick={() => inputRef.current?.click()} disabled={disabled}
                className="btn-primary text-[11px] flex items-center gap-1 disabled:opacity-50">
          {disabled ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
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

function MisCapacitacionesTab() {
  const capsQ = useQuery({
    queryKey: ['me-caps'],
    queryFn: () => api.me.capacitaciones(),
  });
  const caps = capsQ.data ?? [];

  return (
    <div className="panel">
      <div className="panel-title">Mis capacitaciones</div>
      {capsQ.isLoading ? (
        <div className="p-4 text-text-muted text-xs">Cargando…</div>
      ) : caps.length === 0 ? (
        <div className="p-6 text-text-muted text-xs italic text-center">
          Aún sin capacitaciones registradas. El transportista te las cargará cuando completes los cursos.
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead className="border-b border-line text-text-muted uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2 text-left">Módulo</th>
              <th className="px-3 py-2 text-left">Completado</th>
              <th className="px-3 py-2 text-left">Vence</th>
              <th className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {caps.map((c: any) => {
              const expired = c.vence_at ? new Date(c.vence_at) < new Date() : false;
              const soon = c.vence_at ? new Date(c.vence_at) <= new Date(Date.now() + 30 * 86400_000) : false;
              return (
                <tr key={c.cap_id} className="border-b border-line/50">
                  <td className="px-3 py-2">{c.modulo_nombre}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{c.fecha_completado}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{c.vence_at ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`pill ${
                      expired ? 'pill-red' : soon ? 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border' : 'pill-green'
                    }`}>
                      {expired ? 'Vencida' : soon ? 'Por vencer' : 'Vigente'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
