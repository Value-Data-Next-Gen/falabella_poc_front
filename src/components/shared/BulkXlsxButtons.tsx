import { useRef, useState } from 'react';
import { Download, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getToken } from '../../api';

interface BulkResult {
  created: number;
  updated: number;
  errors: string[];
}

interface BulkXlsxButtonsProps {
  downloadPath: string;   // ej: '/admin/drivers/template?empresa_id=22'
  filename: string;       // ej: 'drivers_22.xlsx'
  uploadPath: string;     // ej: '/admin/drivers/upload?empresa_id=22'
  onUploaded?: () => void;
}

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

async function downloadBlob(path: string, filename: string): Promise<void> {
  const t = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: t ? { Authorization: `Bearer ${t}`, 'ngrok-skip-browser-warning': '1' } : {},
  });
  if (!res.ok) throw new Error(`Descarga falló: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function uploadXlsx(path: string, file: File): Promise<BulkResult> {
  const t = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { const j = await res.json(); if (j?.detail) detail = j.detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export function BulkXlsxButtons({ downloadPath, filename, uploadPath, onUploaded }: BulkXlsxButtonsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'down' | 'up' | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onDownload = async () => {
    setErr(null);
    setBusy('down');
    try {
      await downloadBlob(downloadPath, filename);
    } catch (e: any) {
      setErr(e?.message ?? 'error descargando');
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (file: File) => {
    setErr(null); setResult(null);
    setBusy('up');
    try {
      const r = await uploadXlsx(uploadPath, file);
      setResult(r);
      onUploaded?.();
    } catch (e: any) {
      setErr(e?.message ?? 'error subiendo');
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={busy !== null}
          className="btn text-[11px] flex items-center gap-1 disabled:opacity-50"
        >
          {busy === 'down' ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
          Template
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== null}
          className="btn-primary text-[11px] flex items-center gap-1 disabled:opacity-50"
        >
          {busy === 'up' ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          Subir XLSX
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
          }}
        />
      </div>
      {result && (
        <div className="text-[10px] text-text-secondary flex items-center gap-1">
          <CheckCircle2 size={10} className="text-accent-green" />
          {result.created} creados, {result.updated} actualizados
          {result.errors.length > 0 && (
            <span className="text-accent-red ml-1">
              ({result.errors.length} {result.errors.length === 1 ? 'error' : 'errores'})
            </span>
          )}
        </div>
      )}
      {result && result.errors.length > 0 && (
        <details className="text-[10px] text-accent-red">
          <summary className="cursor-pointer">ver errores</summary>
          <ul className="list-disc pl-4 mt-1">
            {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
            {result.errors.length > 10 && <li>… y {result.errors.length - 10} más</li>}
          </ul>
        </details>
      )}
      {err && (
        <div className="text-[10px] text-accent-red flex items-center gap-1">
          <AlertCircle size={10} /> {err}
        </div>
      )}
    </div>
  );
}
