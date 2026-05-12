import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ChevronDown, ChevronRight, CheckCircle2, Crown,
  Loader2, MapPin, Phone, Route as RouteIcon, Search, ShieldAlert,
  Star, User, Settings2,
} from 'lucide-react';
import { api } from '../../api';
import { RutaDetalleDrawer } from './RutaDetalleDrawer';

interface Props {
  fecha: string;
}

type Sev = 'green' | 'red' | 'yellow' | 'gray';

export function PlanDelDiaSimplePanel({ fecha }: Props) {
  const [drawerRutaId, setDrawerRutaId] = useState<string | null>(null);
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
        {data.vips.map(v => <VipRow key={v.tracking_id} v={v} onOpenRuta={setDrawerRutaId} />)}
        <VipSearch fecha={fecha} />
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
        {data.driver_issues.map((d, i) => <DriverRow key={`${d.driver_name}-${d.issue_type}-${i}`} d={d} onOpenRuta={setDrawerRutaId} />)}
      </Section>
      {drawerRutaId && (
        <RutaDetalleDrawer rutaId={drawerRutaId} onClose={() => setDrawerRutaId(null)} />
      )}
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

function VipRow({ v, onOpenRuta }: {
  v: { tracking_id: string; cliente: string; comuna: string | null;
       folio: string | null; deadline: string | null; ruta_id: string | null;
       driver_name: string | null; priority_set: boolean };
  onOpenRuta: (rutaId: string) => void;
}) {
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
        <button
          onClick={() => onOpenRuta(v.ruta_id!)}
          className="font-mono text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand border border-brand/30 rounded inline-flex items-center gap-1 hover:bg-brand/25 transition-colors"
          title="Ver detalle de la ruta"
        >
          <RouteIcon size={9} /> {v.ruta_id}
        </button>
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

function VipSearch({ fecha }: { fecha: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const searchQ = useQuery({
    queryKey: ['day-clients', fecha, q.trim()],
    queryFn: () => api.planificacion.dayClients(fecha, q.trim() || undefined, 20),
    enabled: open && q.trim().length >= 2,
    staleTime: 10_000,
  });
  const markMut = useMutation({
    mutationFn: (cliente: string) => api.vip.create({
      match_type: 'title', match_value: cliente, tier: 'VIP',
      notes: `Marcado desde Plan del día ${fecha}`,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-prep', fecha] });
      qc.invalidateQueries({ queryKey: ['day-clients', fecha] });
      qc.invalidateQueries({ queryKey: ['planif-day-status', fecha] });
    },
  });

  return (
    <div className="border-t border-line/30 px-4 py-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1"
      >
        <Search size={11} /> Marcar otro cliente como VIP
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar cliente (mínimo 2 letras)…"
            className="input text-[12px]"
          />
          {searchQ.isFetching && (
            <div className="text-[10px] text-text-muted flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Buscando…
            </div>
          )}
          {searchQ.data && searchQ.data.length === 0 && q.trim().length >= 2 && (
            <div className="text-[10px] text-text-muted italic">Sin resultados.</div>
          )}
          <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
            {(searchQ.data ?? []).map(c => (
              <div key={c.tracking_id}
                   className="flex items-center gap-2 px-2 py-1.5 text-[11px] bg-bg-700/30 rounded">
                <span className="font-medium truncate max-w-[200px]">{c.cliente}</span>
                {c.comuna && <span className="text-text-muted">· {c.comuna}</span>}
                {c.ruta_id && (
                  <span className="font-mono text-[10px] px-1 bg-brand/10 text-brand border border-brand/30 rounded">
                    {c.ruta_id}
                  </span>
                )}
                <button
                  disabled={c.is_vip || markMut.isPending}
                  onClick={() => markMut.mutate(c.cliente)}
                  className={`ml-auto px-2 py-0.5 rounded text-[10px] flex items-center gap-1 ${
                    c.is_vip
                      ? 'bg-cmr/20 text-cmr cursor-default'
                      : 'btn-primary hover:bg-cmr/30'
                  }`}
                >
                  <Star size={10} /> {c.is_vip ? 'Ya es VIP' : 'Marcar VIP'}
                </button>
              </div>
            ))}
          </div>
          {markMut.error && (
            <div className="text-[10px] text-accent-red">
              {(markMut.error as Error).message}
            </div>
          )}
        </div>
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

function DriverRow({ d, onOpenRuta }: {
  d: { driver_id: string | null; driver_name: string | null;
       ruta_id: string | null; issue_type: string;
       issue_label: string; affects_visits: number };
  onOpenRuta: (rutaId: string) => void;
}) {
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
        <button
          onClick={() => onOpenRuta(d.ruta_id!)}
          className="font-mono text-[10px] px-1.5 py-0.5 bg-brand/10 text-brand border border-brand/30 rounded hover:bg-brand/25 transition-colors"
          title="Ver detalle de la ruta"
        >
          {d.ruta_id}
        </button>
      )}
      {d.affects_visits > 0 && (
        <span className="ml-auto text-[10px] text-accent-red font-semibold">
          afecta {d.affects_visits} visita{d.affects_visits === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
