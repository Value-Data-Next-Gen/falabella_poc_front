import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, Search } from 'lucide-react';
import { api } from '../../api';
import { AsistenteIAPanel } from '../AsistenteIAPanel';
import { PlanDriver } from '../../types';
import { useDiaActivo } from '../../hooks/useDiaActivo';

/**
 * R8: Probador IA con layout 2 columnas (drivers + sandbox).
 * Wrapper alrededor de AsistenteIAPanel que provee el driver a probar.
 */
export function ProbadorIAPanel() {
  const { fecha } = useDiaActivo();
  const [selectedVid, setSelectedVid] = useState<number | null>(null);
  const [q, setQ] = useState('');

  // Drivers del día via plan-diario legacy (estructura empresa→drivers→visits)
  const planQ = useQuery({
    queryKey: ['plan-diario-probador', fecha],
    queryFn: () =>
      api.planDiario({ legacy: true, source: 'real', planned_date: fecha }) as Promise<any>,
    enabled: !!fecha,
  });

  // Aplanamos drivers desde plan legacy. Tipo casteado a PlanDriver.
  const drivers: PlanDriver[] = (planQ.data?.empresas ?? []).flatMap(
    (e: any) => (e.drivers ?? []) as PlanDriver[]
  );

  const filtered = q.trim()
    ? drivers.filter(d =>
        (d.driver_name ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (d.vehicle_name ?? '').toLowerCase().includes(q.toLowerCase())
      )
    : drivers;

  const selected = drivers.find(d => d.vehicle_id === selectedVid) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 p-3 h-full overflow-hidden">
      {/* Panel izquierdo: lista de drivers */}
      <div className="panel flex flex-col min-h-0">
        <div className="panel-title flex items-center gap-2">
          <Truck size={13} />
          <span>Drivers del día</span>
          <span className="ml-auto text-[10px] text-text-muted normal-case tracking-normal">
            {drivers.length}
          </span>
        </div>
        <div className="px-3 py-2 border-b border-line">
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar driver…"
              className="input pl-7 !py-1 text-[11px] w-full"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {planQ.isLoading && (
            <div className="p-4 text-center text-text-muted text-[11px]">Cargando…</div>
          )}
          {!planQ.isLoading && filtered.length === 0 && (
            <div className="p-4 text-center text-text-muted text-[11px]">
              Sin drivers para {fecha}.
            </div>
          )}
          {filtered.map(d => {
            const isSel = d.vehicle_id === selectedVid;
            const pending = (d.visits ?? []).filter(v => v.status === 'pending').length;
            return (
              <button
                key={d.vehicle_id}
                onClick={() => setSelectedVid(d.vehicle_id)}
                className={`w-full text-left px-3 py-2 border-b border-line/40 hover:bg-bg-700/30 ${
                  isSel ? 'bg-brand/15 border-l-2 border-l-brand' : ''
                }`}
              >
                <div className="text-[12px] font-medium truncate">{d.driver_name ?? '—'}</div>
                <div className="text-[10px] text-text-muted flex items-center gap-2 mt-0.5">
                  <span className="font-mono">{d.vehicle_name}</span>
                  <span>·</span>
                  <span>{pending} pend</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel derecho: AsistenteIA con driver seleccionado */}
      <div className="overflow-auto min-h-0">
        <AsistenteIAPanel driver={selected} />
      </div>
    </div>
  );
}
