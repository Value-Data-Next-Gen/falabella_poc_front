import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, CheckCircle2, Download, FileSpreadsheet, Inbox, Loader2, Play, RefreshCw, Upload, UploadCloud } from 'lucide-react';
import { api, getToken } from '../../api';
import { DotacionConflict } from '../../types';

interface CargaEntregasPanelProps {
  initialFecha?: string;
  onFechaChange?: (f: string) => void;
}

export function CargaEntregasPanel({ initialFecha, onFechaChange }: CargaEntregasPanelProps = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFechaState] = useState<string>(initialFecha ?? today);
  // Si nos pasan la fecha desde arriba, mantenemos local en sync.
  // (no usamos directamente initialFecha como valor controlado para no
  // perder la edición local si el usuario tipea)
  const setFecha = (f: string) => {
    setFechaState(f);
    onFechaChange?.(f);
  };
  const [flash, setFlash] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<DotacionConflict[]>([]);
  const qc = useQueryClient();

  // Histórico de cargas — persistente en backend (sobrevive a navegación + refresh).
  const importsQ = useQuery({
    queryKey: ['planificacion', 'imports'],
    queryFn: api.planificacion.listImports,
    staleTime: 30_000,
  });

  const importMut = useMutation({
    mutationFn: (vars: { fecha: string; force?: boolean }) =>
      api.planificacion.importMock(vars.fecha, vars.force),
    onSuccess: r => {
      if (r.already_imported) {
        setFlash(`ℹ️ ${r.message}`);
      } else {
        setFlash(`✅ ${r.message}`);
      }
      setConflicts(r.conflicts ?? []);
      qc.invalidateQueries({ queryKey: ['planificacion', 'imports'] });
      qc.invalidateQueries({ queryKey: ['planif-calendar'] });
      qc.invalidateQueries({ queryKey: ['planif-day-status'] });
      qc.invalidateQueries({ queryKey: ['plan-diario'] });
      // Auto-clear flash después de 6s (los conflicts persisten hasta nueva carga)
      setTimeout(() => setFlash(null), 6_000);
    },
    onError: (e: Error) => {
      setFlash(`❌ ${e.message}`);
      setTimeout(() => setFlash(null), 6_000);
    },
  });

  const checkMut = useMutation({
    mutationFn: (f: string) => api.planificacion.dotacionCheck(f),
    onSuccess: c => {
      setConflicts(c);
      setFlash(c.length === 0
        ? `✅ Sin conflictos: todos los drivers de ${fecha} están disponibles`
        : `⚠️ ${c.length} conflicto(s) — revisá la lista de abajo`);
      setTimeout(() => setFlash(null), 6_000);
    },
  });

  const startDayMut = useMutation({
    mutationFn: (f: string) => api.planificacion.startDay(f),
    onSuccess: r => {
      setConflicts(r.conflicts ?? []);
      setFlash(`🚀 ${r.message}`);
      qc.invalidateQueries({ queryKey: ['state'] });
      qc.invalidateQueries({ queryKey: ['plan-diario'] });
      setTimeout(() => setFlash(null), 8_000);
    },
    onError: (e: Error) => {
      setFlash(`❌ ${e.message}`);
      setTimeout(() => setFlash(null), 6_000);
    },
  });

  // ----- Upload Excel REAL de SimpliRoute -----
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [xlsxForce, setXlsxForce] = useState(false);
  const uploadXlsx = async (file: File) => {
    setXlsxBusy(true); setFlash(null); setConflicts([]);
    try {
      const t = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(
        `${(import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'}${api.planificacion.importXlsxPath(xlsxForce)}`,
        { method: 'POST', headers: t ? { Authorization: `Bearer ${t}` } : {}, body: fd },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail ?? r.statusText);
      if (j.ok === false) {
        setFlash(`⚠️ ${j.message}`);
      } else {
        setFlash(`✅ ${j.message}`);
        setConflicts(j.conflicts ?? []);
        qc.invalidateQueries({ queryKey: ['planificacion', 'imports'] });
        qc.invalidateQueries({ queryKey: ['plan-diario'] });
        qc.invalidateQueries({ queryKey: ['planif-calendar'] });
        qc.invalidateQueries({ queryKey: ['planif-day-status'] });
      }
      setTimeout(() => setFlash(null), 8_000);
    } catch (e: any) {
      setFlash(`❌ ${e?.message ?? 'error'}`);
      setTimeout(() => setFlash(null), 6_000);
    } finally {
      setXlsxBusy(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
    }
  };

  const imports = importsQ.data ?? [];
  const alreadyForFecha = imports.find(i => i.fecha === fecha);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Carga de entregas</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            Importa el plan de visitas desde SimpliRoute para una fecha específica.
          </p>
        </div>
        <button
          onClick={() => importsQ.refetch()}
          disabled={importsQ.isFetching}
          className="btn flex items-center gap-1 text-[11px] !py-1 !px-2"
          title="Refrescar log"
        >
          <RefreshCw size={12} className={importsQ.isFetching ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </header>

      <div className="panel">
        <div className="panel-title">Importar desde SimpliRoute</div>
        <div className="p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wider text-text-muted">Fecha planificada</label>
            <div className="flex items-center gap-2 input py-1.5">
              <CalendarDays size={13} className="text-text-muted" />
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="bg-transparent outline-none text-[12px]"
              />
            </div>
          </div>

          <button
            onClick={() => importMut.mutate({ fecha, force: false })}
            disabled={importMut.isPending}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-[13px] rounded-md"
          >
            {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            Importar desde SimpliRoute
          </button>

          {alreadyForFecha && !importMut.isPending && (
            <button
              onClick={() => {
                if (confirm(`Re-importar ${fecha}? Se agregarán visitas nuevas a las ${alreadyForFecha.count} ya cargadas.`)) {
                  importMut.mutate({ fecha, force: true });
                }
              }}
              className="btn flex items-center gap-1 text-[11px] !py-1.5 !px-3"
              title="Forzar re-importación"
            >
              <RefreshCw size={11} />
              Re-importar (force)
            </button>
          )}

          <button
            onClick={() => checkMut.mutate(fecha)}
            disabled={checkMut.isPending}
            className="btn flex items-center gap-1 text-[11px] !py-1.5 !px-3"
            title="Cruzar visitas vs dotación del día"
          >
            {checkMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
            Verificar dotación
          </button>

          <button
            onClick={() => {
              if (confirm(`Iniciar día ${fecha}? Esto pausa el generador de visitas en vivo y fija la fecha operativa.`)) {
                startDayMut.mutate(fecha);
              }
            }}
            disabled={startDayMut.isPending}
            className="btn-primary flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-md"
            title="Iniciar el día operativo: pausa live_gen + setea STATE.today + cuadra el snapshot"
          >
            {startDayMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Iniciar día
          </button>

          {flash && (
            <div className={`text-[12px] flex items-center gap-2 ${
              flash.startsWith('✅') ? 'text-accent-green' :
              flash.startsWith('ℹ️') ? 'text-accent-amber' :
              'text-accent-red'
            }`}>
              <Inbox size={13} /> {flash}
            </div>
          )}
        </div>

        {alreadyForFecha && (
          <div className="px-4 pb-3 text-[11px] text-text-muted flex items-center gap-1">
            <CheckCircle2 size={12} className="text-accent-green" />
            Ya cargaste {fecha}: {alreadyForFecha.count} visitas el {alreadyForFecha.imported_at}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <FileSpreadsheet size={14} /> Subir Excel real SimpliRoute
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="text-[12px] text-text-muted">
            Formato esperado: <code className="px-1 bg-bg-700 rounded text-[10px]">datos_eta_YYYY-MM-DD.xlsx</code>{' '}
            con hojas <strong>Simpli</strong> (visitas) y opcional <strong>Geo</strong> (suborders).
            La fecha viene en la columna <code className="px-1 bg-bg-700 rounded text-[10px]">planned_date</code>.
            Procesa todas las fechas que contenga el archivo.
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => xlsxInputRef.current?.click()}
              disabled={xlsxBusy}
              className="btn-primary flex items-center gap-2 px-3 py-1.5 text-[12px] rounded-md disabled:opacity-50"
            >
              {xlsxBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Subir XLSX real
            </button>
            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadXlsx(f); }}
            />
            <label className="flex items-center gap-1 text-[11px] cursor-pointer">
              <input type="checkbox" checked={xlsxForce} onChange={e => setXlsxForce(e.target.checked)} />
              Force: reemplazar fechas existentes
            </label>
            <span className="text-[10px] text-text-muted ml-auto">Máx 50MB</span>
          </div>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="panel border border-accent-red/40">
          <div className="panel-title flex items-center gap-2 text-accent-red">
            <AlertTriangle size={14} />
            <span>{conflicts.length} conflicto(s) de dotación</span>
            <span className="ml-auto text-[10px] text-text-muted normal-case font-normal tracking-normal">
              estos drivers/vehículos están en rutas pero marcados no operables
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead className="border-b border-line/40 text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-3 py-2 text-left">Vehículo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Motivo</th>
                <th className="px-3 py-2 text-right">Visitas</th>
                <th className="px-3 py-2 text-left">Ruta</th>
              </tr>
            </thead>
            <tbody>
              {conflicts.map((c, i) => (
                <tr key={`${c.empresa_id}-${c.driver_id ?? c.vehicle_id}-${i}`} className="border-b border-line/30">
                  <td className="px-3 py-2">{c.empresa_nombre ?? `#${c.empresa_id}`}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.driver_name ?? '—'}</div>
                    {c.driver_id && <div className="text-[10px] text-text-muted font-mono">{c.driver_id}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {c.plate ?? (c.vehicle_id ? `#${c.vehicle_id}` : '—')}
                  </td>
                  <td className="px-3 py-2">
                    <span className="pill pill-red">{c.estado}</span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{c.motivo ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.visitas_afectadas}</td>
                  <td className="px-3 py-2 font-mono text-text-muted text-[10px]">{c.ruta_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2 text-[11px] text-text-muted">
            Resolvé en <a href={`#/planificacion/dotacion`} className="text-accent-blue hover:underline">Planificación → Dotación del día</a>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-title flex items-center justify-between pr-3">
          <span>Histórico de cargas</span>
          <span className="text-[10px] text-text-muted normal-case tracking-normal font-normal">
            {imports.length > 0 ? `${imports.length} carga${imports.length === 1 ? '' : 's'} registrada${imports.length === 1 ? '' : 's'}` : 'sin cargas'}
          </span>
        </div>
        {importsQ.isLoading ? (
          <div className="p-8 text-center text-text-muted text-[12px]">Cargando histórico…</div>
        ) : imports.length > 0 ? (
          <div className="p-4 text-[13px]">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50/5 border-b border-line/40">
                <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Visitas importadas</th>
                  <th className="px-3 py-2">Cargado el</th>
                  <th className="px-3 py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                {imports.map(row => (
                  <tr key={row.fecha} className="hover:bg-bg-700/20 border-b border-line/30">
                    <td className="px-3 py-2 tabular-nums font-medium">{row.fecha}</td>
                    <td className="px-3 py-2 tabular-nums">{row.count}</td>
                    <td className="px-3 py-2 text-text-muted text-[11px]">{row.imported_at}</td>
                    <td className="px-3 py-2 text-text-muted">SimpliRoute (mock)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-text-muted text-[12px] flex flex-col items-center gap-2">
            <Download size={32} className="text-text-muted/40" />
            <div>Aún no hay cargas registradas.</div>
            <div className="text-[11px]">Selecciona una fecha y presiona “Importar desde SimpliRoute”.</div>
          </div>
        )}
      </div>
    </div>
  );
}
