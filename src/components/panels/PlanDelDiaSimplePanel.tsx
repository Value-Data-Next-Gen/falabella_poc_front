import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, Crown,
  Loader2, MapPin, Phone, Route as RouteIcon, ShieldAlert, User, Settings2,
} from 'lucide-react';
import { api } from '../../api';

interface Props {
  fecha: string;
}

type Sev = 'green' | 'red' | 'yellow' | 'gray';

export function PlanDelDiaSimplePanel({ fecha }: Props) {
  const prepQ = useQuery({
    queryKey: ['day-prep', fecha],
    queryFn: () => api.planificacion.dayPrep(fecha),
    refetchInterval: 30_000,
  });

  if (prepQ.isLoading) {
    return (
      <div className="panel p-6 text-text-muted text-sm flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Cargando plan del día…
      </div>
    );
  }
  if (prepQ.error) {
    return (
      <div className="panel p-6 text-accent-red text-sm">
        Error: {(prepQ.error as Error).message}
      </div>
    );
  }
  const data = prepQ.data;
  if (!data) return null;

  const vipsCount = data.vips.length;
  const cfgCount = data.config_issues.length;
  const drvCount = data.driver_issues.length;
  const allOk = data.all_ok;

  return (
    <div className="flex flex-col gap-3">
      <Header fecha={fecha} allOk={allOk} cfgCount={cfgCount} drvCount={drvCount} vipsCount={vipsCount} />
      <Section
        title="VIPs del día"
        icon={Crown}
        count={vipsCount}
        sev={vipsCount === 0 ? 'gray' : 'yellow'}
        emptyText="No hay clientes VIP marcados para este día."
      >
        {data.vips.map(v => <VipRow key={v.tracking_id} v={v} />)}
      </Section>
      <Section
        title="Configuración pendiente"
        icon={Settings2}
        count={cfgCount}
        sev={cfgCount === 0 ? 'green' : 'yellow'}
        emptyText="Todas las visitas tienen ruta, región, comuna y CT asignados."
      >
        {data.config_issues.map((c, i) => <ConfigRow key={`${c.tracking_id}-${i}`} c={c} />)}
      </Section>
      <Section
        title="Drivers y dotación con problemas"
        icon={ShieldAlert}
        count={drvCount}
        sev={drvCount === 0 ? 'green' : 'red'}
        emptyText="Todos los drivers y vehículos asignados están operables y con datos de contacto."
      >
        {data.driver_issues.map((d, i) => <DriverRow key={`${d.driver_name}-${d.issue_type}-${i}`} d={d} />)}
      </Section>
    </div>
  );
}

function Header({ fecha, allOk, cfgCount, drvCount, vipsCount }: {
  fecha: string; allOk: boolean; cfgCount: number; drvCount: number; vipsCount: number;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <div className="text-[12px] uppercase tracking-wider text-text-muted">
            Plan del día · {fecha}
          </div>
          <div className={`text-[15px] font-semibold tracking-tight mt-1 flex items-center gap-2 ${
            allOk ? 'text-accent-green' : 'text-accent-yellow'
          }`}>
            {allOk
              ? <><CheckCircle2 size={16} /> Listo para iniciar</>
              : <><AlertTriangle size={16} /> Hay cosas por resolver</>}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap text-[11px]">
          <Pill icon={Crown} label={`${vipsCount} VIP`} tone={vipsCount > 0 ? 'yellow' : 'gray'} />
          <Pill icon={Settings2} label={`${cfgCount} config`} tone={cfgCount > 0 ? 'yellow' : 'green'} />
          <Pill icon={ShieldAlert} label={`${drvCount} drivers`} tone={drvCount > 0 ? 'red' : 'green'} />
        </div>
      </div>
    </div>
  );
}

function Pill({ icon: Icon, label, tone }: { icon: any; label: string; tone: Sev }) {
  const cls = {
    green:  'bg-accent-green/15 text-accent-green border-accent-green/40',
    yellow: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40',
    red:    'bg-accent-red/15 text-accent-red border-accent-red/40',
    gray:   'bg-bg-700 text-text-muted border-line',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 border rounded font-medium ${cls}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

function Section({ title, icon: Icon, count, sev, emptyText, children }: {
  title: string; icon: any; count: number; sev: Sev; emptyText: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(count > 0);
  const sevCls = {
    green:  'text-accent-green',
    yellow: 'text-accent-yellow',
    red:    'text-accent-red',
    gray:   'text-text-muted',
  }[sev];
  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full panel-title flex items-center gap-2 hover:bg-bg-700/30 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={14} className={sevCls} />
        <span>{title}</span>
        <span className={`ml-auto text-[12px] font-mono ${sevCls}`}>{count}</span>
      </button>
      {open && (
        <div className="flex flex-col">
          {count === 0 ? (
            <div className="px-4 py-3 text-[11px] text-text-muted italic flex items-center gap-2">
              <CheckCircle2 size={11} className="text-accent-green" />
              {emptyText}
            </div>
          ) : children}
        </div>
      )}
    </div>
  );
}

function VipRow({ v }: { v: { tracking_id: string; cliente: string; comuna: string | null;
                             folio: string | null; deadline: string | null; ruta_id: string | null;
                             driver_name: string | null; priority_set: boolean } }) {
  return (
    <div className="border-t border-line/30 px-4 py-2 text-[12px] flex items-center gap-3 flex-wrap">
      <Crown size={12} className="text-cmr shrink-0" />
      <span className="font-medium truncate max-w-[260px]">{v.cliente}</span>
      {v.comuna && (
        <span className="text-text-muted text-[11px] inline-flex items-center gap-0.5">
          <MapPin size={10} /> {v.comuna}
        </span>
      )}
      {v.folio && (
        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-cmr/10 text-cmr border border-cmr/30 rounded">
          {v.folio}
        </span>
      )}
      {v.ruta_id && (
        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand border border-brand/30 rounded inline-flex items-center gap-1">
          <RouteIcon size={9} /> {v.ruta_id}
        </span>
      )}
      {v.driver_name && (
        <span className="text-[11px] text-text-secondary inline-flex items-center gap-0.5">
          <User size={10} /> {v.driver_name}
        </span>
      )}
      {!v.priority_set && (
        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/40 rounded">
          Sin prioridad seteada
        </span>
      )}
    </div>
  );
}

function ConfigRow({ c }: { c: { tracking_id: string; cliente: string; issue_type: string; issue_label: string } }) {
  return (
    <div className="border-t border-line/30 px-4 py-2 text-[12px] flex items-center gap-3 flex-wrap">
      <Settings2 size={12} className="text-accent-yellow shrink-0" />
      <span className="font-medium truncate max-w-[260px]">{c.cliente}</span>
      <span className="text-[11px] text-text-muted">{c.issue_label}</span>
      <span className="ml-auto font-mono text-[10px] text-text-muted">{c.tracking_id}</span>
    </div>
  );
}

function DriverRow({ d }: { d: { driver_id: string | null; driver_name: string | null;
                                 ruta_id: string | null; issue_type: string;
                                 issue_label: string; affects_visits: number } }) {
  const icon = d.issue_type === 'sin_telefono' ? Phone
             : d.issue_type === 'vehiculo_no_operable' ? RouteIcon
             : ShieldAlert;
  const Icon = icon;
  return (
    <div className="border-t border-line/30 px-4 py-2 text-[12px] flex items-center gap-3 flex-wrap">
      <Icon size={12} className="text-accent-red shrink-0" />
      <span className="font-medium truncate max-w-[200px]">
        {d.driver_name ?? '(sin nombre)'}
      </span>
      <span className="text-[11px] text-text-muted">{d.issue_label}</span>
      {d.ruta_id && (
        <span className="font-mono text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand border border-brand/30 rounded">
          {d.ruta_id}
        </span>
      )}
      {d.affects_visits > 0 && (
        <span className="ml-auto text-[10px] text-accent-red font-semibold">
          afecta {d.affects_visits} visita{d.affects_visits === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
