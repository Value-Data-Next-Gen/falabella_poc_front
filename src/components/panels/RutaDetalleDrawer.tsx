import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, Clock, Crown, Loader2, MapPin, Package,
  Route as RouteIcon, Truck, User, X, XCircle,
} from 'lucide-react';
import { api } from '../../api';

interface Props {
  rutaId: string;
  onClose: () => void;
}

const STATUS_PILL: Record<string, { label: string; cls: string; icon: any }> = {
  pending:   { label: 'pendiente',  cls: 'bg-bg-700 text-text-secondary border-line',                icon: Clock },
  completed: { label: 'entregado',  cls: 'bg-accent-green/15 text-accent-green border-accent-green/40', icon: CheckCircle2 },
  failed:    { label: 'fallido',    cls: 'bg-accent-red/15 text-accent-red border-accent-red/40',   icon: XCircle },
};

export function RutaDetalleDrawer({ rutaId, onClose }: Props) {
  const q = useQuery({
    queryKey: ['ruta-detalle', rutaId],
    queryFn: () => api.planificacion.rutaDetalle(rutaId),
    refetchInterval: 20_000,
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex" onClick={onClose}>
      <div className="ml-auto h-full w-full max-w-2xl bg-bg-900 border-l border-line shadow-2xl overflow-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-bg-800 border-b border-line px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider">
            <RouteIcon size={14} className="text-brand" />
            Detalle de ruta
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
            <X size={16} />
          </button>
        </div>

        {q.isLoading && (
          <div className="p-6 text-text-muted text-[12px] flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Cargando…
          </div>
        )}
        {q.error && (
          <div className="p-6 text-accent-red text-[12px]">
            {(q.error as Error).message}
          </div>
        )}
        {q.data && <RutaContent d={q.data} />}
      </div>
    </div>
  );
}

function RutaContent({ d }: { d: NonNullable<Awaited<ReturnType<typeof api.planificacion.rutaDetalle>>> }) {
  const pctOk = d.total_stops ? Math.round((d.completed / d.total_stops) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header info */}
      <div className="panel p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="font-mono text-[14px] font-semibold text-brand">{d.ruta_id}</div>
            <div className="text-[11px] text-text-muted mt-0.5">{d.planned_date}</div>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {d.valid_routing
              ? <span className="pill bg-accent-green/15 text-accent-green border-accent-green/40 border">integridad OK</span>
              : <span className="pill bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border">
                  <AlertTriangle size={9} className="inline mr-0.5" /> revisar
                </span>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-[12px]">
          <KV label="Empresa" value={d.empresa_nombre ?? '—'} icon={Truck} />
          <KV label="Región" value={d.region ?? '—'} icon={MapPin} />
          <KV label="Driver" value={d.driver_name ?? '—'} icon={User} />
          <KV label="Patente" value={d.patente ?? '—'} mono />
          <KV label="Total stops" value={d.total_stops} mono highlight />
          <KV label="VIPs" value={d.vip_count} icon={Crown} mono tone={d.vip_count ? 'yellow' : undefined} />
        </div>
        {/* Progreso */}
        <div className="mt-3 flex items-center gap-3 text-[11px]">
          <div className="flex-1 h-2 bg-bg-700/60 rounded-full overflow-hidden">
            <div className="h-full bg-accent-green transition-all" style={{ width: `${pctOk}%` }} />
          </div>
          <span className="font-mono text-text-secondary">{pctOk}%</span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[11px]">
          <span className="text-accent-green">{d.completed} OK</span>
          <span className="text-text-muted">{d.pending} pend</span>
          <span className="text-accent-red">{d.failed} fail</span>
          <span className="ml-auto text-text-muted">
            {d.folios_unicos} folios · {d.subfolios_total} subfolios
          </span>
        </div>
      </div>

      {/* Integrity warnings */}
      {!d.valid_routing && d.integrity_warnings.length > 0 && (
        <div className="panel border-accent-yellow/40 p-3 bg-accent-yellow/5">
          <div className="text-[11px] font-semibold text-accent-yellow mb-1 flex items-center gap-1">
            <AlertTriangle size={11} /> Warnings de integridad
          </div>
          <ul className="text-[11px] text-text-secondary list-disc list-inside space-y-1">
            {d.integrity_warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Stops */}
      <div className="panel">
        <div className="panel-title">Stops ({d.stops.length})</div>
        <div className="divide-y divide-line/30 max-h-[60vh] overflow-y-auto">
          {d.stops.map(s => <StopRow key={s.tracking_id} s={s} />)}
        </div>
      </div>
    </div>
  );
}

type Stop = NonNullable<Awaited<ReturnType<typeof api.planificacion.rutaDetalle>>>['stops'][number];

function StopRow({ s }: { s: Stop }) {
  const pill = STATUS_PILL[s.status] ?? STATUS_PILL.pending;
  const Icon = pill.icon;
  return (
    <div className="px-3 py-2 flex items-start gap-2 text-[12px]">
      <span className="text-text-muted font-mono shrink-0 w-6 text-right pt-0.5">
        {s.order ?? '·'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{s.cliente}</span>
          {s.is_vip && (
            <span className="pill bg-cmr/15 text-cmr border-cmr/40 border text-[9px] flex items-center gap-0.5">
              <Crown size={8} /> {s.vip_tier ?? 'VIP'}
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
          {s.comuna && <span><MapPin size={9} className="inline" /> {s.comuna}</span>}
          {s.folio && (
            <span className="font-mono">
              <Package size={9} className="inline" /> {s.folio}
            </span>
          )}
          {s.eta && <span><Clock size={9} className="inline" /> {s.eta.slice(11, 16)}</span>}
        </div>
        {s.direccion && (
          <div className="text-[10px] text-text-muted truncate mt-0.5" title={s.direccion}>
            {s.direccion}
          </div>
        )}
      </div>
      <span className={`pill ${pill.cls} border text-[9px] flex items-center gap-0.5 shrink-0`}>
        <Icon size={9} /> {pill.label}
      </span>
    </div>
  );
}

function KV({ label, value, icon: Icon, mono, highlight, tone }: {
  label: string; value: string | number; icon?: any; mono?: boolean;
  highlight?: boolean; tone?: 'yellow' | 'red' | 'green';
}) {
  const cls = tone === 'yellow' ? 'text-accent-yellow' :
              tone === 'red'    ? 'text-accent-red' :
              tone === 'green'  ? 'text-accent-green' : '';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        {Icon && <Icon size={9} />} {label}
      </span>
      <span className={`${mono ? 'font-mono' : ''} ${cls} ${highlight ? 'text-[15px] font-semibold' : 'text-[12px]'}`}>
        {value}
      </span>
    </div>
  );
}
