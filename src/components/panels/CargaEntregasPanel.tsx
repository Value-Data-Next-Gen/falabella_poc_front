import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarDays, Download, Inbox, Loader2, UploadCloud } from 'lucide-react';
import { api } from '../../api';

export function CargaEntregasPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState<string>(today);
  const [lastResult, setLastResult] = useState<{ count: number; fecha: string } | null>(null);

  const importMut = useMutation({
    mutationFn: api.planificacion.importMock,
    onSuccess: r => setLastResult({ count: r.count, fecha: r.fecha }),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Carga de entregas</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            Importa el plan de visitas desde SimpliRoute para una fecha específica.
          </p>
        </div>
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
            onClick={() => importMut.mutate()}
            disabled={importMut.isPending}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-[13px] rounded-md"
          >
            {importMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            Importar desde SimpliRoute
          </button>

          {lastResult && (
            <div className="text-[12px] text-accent-green flex items-center gap-2">
              <Inbox size={13} /> {lastResult.count} visitas para {lastResult.fecha}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Última carga</div>
        {lastResult ? (
          <div className="p-4 text-[13px]">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50/5 border-b border-line/40">
                <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Visitas importadas</th>
                  <th className="px-3 py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-bg-700/20 border-b border-line/30">
                  <td className="px-3 py-2 tabular-nums">{lastResult.fecha}</td>
                  <td className="px-3 py-2 tabular-nums">{lastResult.count}</td>
                  <td className="px-3 py-2 text-text-muted">SimpliRoute (mock)</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-text-muted text-[12px] flex flex-col items-center gap-2">
            <Download size={32} className="text-text-muted/40" />
            <div>Aún no hay cargas registradas en esta sesión.</div>
            <div className="text-[11px]">Selecciona una fecha y presiona “Importar desde SimpliRoute”.</div>
          </div>
        )}
      </div>
    </div>
  );
}
