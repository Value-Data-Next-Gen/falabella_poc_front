import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Building2, Clock, Crown, Flame, Loader2, Map as MapIcon, MessageSquare, Phone, Search,
  Star, Truck, User, X, Zap,
} from 'lucide-react';
import { api } from '../api';
import { Priority, RegionFilter, TrackingNotifSummary, WatchlistVisit } from '../types';
import { useAuth } from '../hooks/useAuth';

const SEV_META = {
  CRITICO: { label: 'Crítico', color: 'text-accent-red',    bg: 'bg-accent-red/15',    border: 'border-accent-red/60' },
  ALTO:    { label: 'Alto',    color: 'text-accent-yellow', bg: 'bg-accent-yellow/15', border: 'border-accent-yellow/60' },
  MEDIO:   { label: 'Medio',   color: 'text-accent-blue',   bg: 'bg-accent-blue/15',   border: 'border-accent-blue/60' },
} as const;

type Severity = keyof typeof SEV_META;

export interface WatchlistFilterOverrides {
  region?: RegionFilter;
  onlyVip?: boolean;
  empresaId?: number | 'all';
  hideLocalFilters?: boolean;
}

export function WatchlistPanel({ filters }: { filters?: WatchlistFilterOverrides } = {}) {
  const { isFalabella, isAdmin } = useAuth();
  const empresasQ = useQuery({ queryKey: ['empresas'], queryFn: api.empresas, enabled: isFalabella });
  const [empresaFilterLocal, setEmpresaFilterLocal] = useState<number | 'all'>('all');
  const [search, setSearch] = useState('');
  const [notifiedFilter, setNotifiedFilter] = useState<'' | 'yes' | 'no'>('');
  const [sevFilter, setSevFilter] = useState<Severity | ''>('');
  const [regionLocal, setRegionLocal] = useState<RegionFilter>('all');
  const [onlyVipLocal, setOnlyVipLocal] = useState(false);
  const [notifyFor, setNotifyFor] = useState<WatchlistVisit | null>(null);

  const region = filters?.region ?? regionLocal;
  const onlyVip = filters?.onlyVip ?? onlyVipLocal;
  const empresaFilter = filters?.empresaId ?? empresaFilterLocal;
  const hideLocalFilters = !!filters?.hideLocalFilters;

  const watchQ = useQuery({
    queryKey: ['watchlist', empresaFilter, region, onlyVip],
    queryFn: () => api.watchlist({
      empresa_id: empresaFilter === 'all' ? undefined : empresaFilter,
      region,
      only_vip: onlyVip,
    }),
    refetchInterval: 5000,
  });

  const filtered = useMemo(() => {
    const rows = watchQ.data?.visits ?? [];
    const s = search.trim().toLowerCase();
    return rows.filter(v => {
      if (sevFilter && v.severity !== sevFilter) return false;
      if (notifiedFilter === 'yes' && !v.notif) return false;
      if (notifiedFilter === 'no' && v.notif) return false;
      if (s && !v.title.toLowerCase().includes(s) && !v.vehicle_name.toLowerCase().includes(s) && !v.driver_name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [watchQ.data, search, notifiedFilter, sevFilter]);

  const summary = watchQ.data?.summary;

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* Header con totales por severidad */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <SummaryCard label="Total en riesgo" value={summary?.total ?? 0} icon={AlertTriangle} color="text-text-primary" onClick={() => setSevFilter('')} active={!sevFilter} />
        <SummaryCard label="Crítico" value={summary?.critico ?? 0} icon={Flame} color="text-accent-red" onClick={() => setSevFilter(sevFilter === 'CRITICO' ? '' : 'CRITICO')} active={sevFilter === 'CRITICO'} />
        <SummaryCard label="Alto" value={summary?.alto ?? 0} icon={Zap} color="text-accent-yellow" onClick={() => setSevFilter(sevFilter === 'ALTO' ? '' : 'ALTO')} active={sevFilter === 'ALTO'} />
        <SummaryCard label="Medio" value={summary?.medio ?? 0} icon={Clock} color="text-accent-blue" onClick={() => setSevFilter(sevFilter === 'MEDIO' ? '' : 'MEDIO')} active={sevFilter === 'MEDIO'} />
        <SummaryCard label="VIP en riesgo" value={summary?.vip_at_risk ?? 0} icon={Star} color="text-cmr" />
        <SummaryCard label="Sin notificar" value={summary?.not_notified ?? 0} icon={MessageSquare} color="text-accent-violet" onClick={() => setNotifiedFilter(notifiedFilter === 'no' ? '' : 'no')} active={notifiedFilter === 'no'} />
      </section>

      {/* Barra filtros */}
      <section className="panel">
        <div className="p-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 flex-1 min-w-[200px]">
            <Search size={13} className="text-text-muted" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cliente, vehículo o driver..."
              className="input flex-1"
            />
          </div>

          {!hideLocalFilters && (
            <>
              {/* Tabs región */}
              <div className="flex items-center gap-0 border border-line rounded overflow-hidden text-[11px]">
                {(['all', 'RM', 'regiones'] as RegionFilter[]).map(r => (
                  <button
                    key={r}
                    onClick={() => setRegionLocal(r)}
                    className={`px-2 py-1 ${region === r ? 'bg-brand text-white' : 'text-text-secondary hover:bg-bg-700/50'}`}
                  >
                    <MapIcon size={11} className="inline mr-1" />
                    {r === 'all' ? 'Todos' : r === 'RM' ? 'RM' : 'Regiones'}
                  </button>
                ))}
              </div>

              {/* Toggle Solo VIP */}
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVip}
                  onChange={e => setOnlyVipLocal(e.target.checked)}
                  className="accent-cmr"
                />
                <Star size={11} className="text-cmr" />
                Solo VIP
              </label>

              {isFalabella && (
                <select value={empresaFilter} onChange={e => setEmpresaFilterLocal(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="input">
                  <option value="all">Todas las empresas</option>
                  {empresasQ.data?.map(e => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
                </select>
              )}
            </>
          )}
          <select value={notifiedFilter} onChange={e => setNotifiedFilter(e.target.value as any)} className="input">
            <option value="">Notificación: todas</option>
            <option value="no">Solo sin notificar</option>
            <option value="yes">Solo ya notificadas</option>
          </select>
          <span className="text-[11px] text-text-muted ml-auto">
            Mostrando <span className="text-brand font-semibold">{filtered.length}</span> de {summary?.total ?? 0} · refresh 5s
          </span>
        </div>
      </section>

      {/* Cards de visitas */}
      <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full panel p-8 text-center text-text-muted text-sm">
            {watchQ.isLoading ? 'Cargando...' : '🎉 Sin visitas en riesgo con los filtros actuales.'}
          </div>
        )}
        {filtered.map(v => (
          <VisitCard key={v.tracking_id} v={v} onNotify={() => setNotifyFor(v)} isAdmin={isAdmin} />
        ))}
      </section>

      {notifyFor && <NotifyModal visit={notifyFor} onClose={() => setNotifyFor(null)} />}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color, onClick, active }: {
  label: string; value: number; icon: any; color: string; onClick?: () => void; active?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!clickable}
      className={`kpi-card text-left ${clickable ? 'cursor-pointer hover:border-brand transition-colors' : 'cursor-default'} ${active ? 'border-brand ring-1 ring-brand/40' : ''}`}
    >
      <div className="kpi-label flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className={`kpi-value tabular-nums ${color}`}>{value}</div>
    </button>
  );
}

function VisitCard({ v, onNotify, isAdmin }: { v: WatchlistVisit; onNotify: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  const sev = SEV_META[v.severity];
  const slackClass = v.slack_min < 0 ? 'text-accent-red' : v.slack_min < 30 ? 'text-accent-yellow' : 'text-brand';

  const priorityMut = useMutation({
    mutationFn: (p: Priority) => api.priorities.set(v.tracking_id, p, 'Elevada desde watchlist'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });
  const vipMut = useMutation({
    mutationFn: () => api.vip.create({ match_type: 'title', match_value: v.title, tier: 'VIP', notes: `Desde watchlist · ${v.tracking_id}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  // Densidad reducida: solo CRITICO mantiene borde rojo prominente; alto/medio
  // pasan a borde sutil. Severity como chip pequeño en esquina, sin header completo.
  const isCritical = v.severity === 'CRITICO';
  const cardBorder = isCritical ? sev.border + ' border-2' : 'border border-line';

  return (
    <div className={`panel ${cardBorder} flex flex-col overflow-hidden relative`}>
      {/* Sprint 6: ETA destacado esquina superior izquierda */}
      <div className="absolute top-2 left-2 bg-bg-700 text-text-primary text-[11px] px-1.5 py-0.5 rounded font-mono font-semibold flex items-center gap-1 z-10 border border-line">
        <Clock size={10} className="text-accent-blue" />
        ETA {v.estimated_time_arrival ? v.estimated_time_arrival.slice(0, 5) : '—'}
      </div>

      {/* Severity chip esquina superior derecha */}
      <div className={`absolute top-2 right-2 ${sev.bg} ${sev.color} text-[10px] px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 z-10`}>
        <Flame size={9} /> {sev.label} · {v.urgency_score.toFixed(0)}
      </div>

      {/* Cliente */}
      <div className="p-3 pb-2 pt-8 pr-20">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              {v.is_vip && <Crown size={12} className="text-cmr shrink-0" />}
              {v.alert_valuedata && <Zap size={11} className="text-accent-violet shrink-0" />}
              <span className="font-semibold text-sm truncate">{v.title}</span>
              {/* Sprint 6: chip de folio VIP destacado */}
              {v.is_vip && (
                <span
                  className="text-[10px] px-1.5 py-0.5 bg-cmr/15 text-cmr border border-cmr/40 rounded font-mono font-semibold inline-flex items-center gap-0.5"
                  title={`Tracking VIP ${v.tracking_id}`}
                >
                  <Crown size={9} /> #{v.tracking_id.slice(-8)}
                </span>
              )}
              {v.is_vip && v.vip_deadline_time && (
                <span
                  className="text-[9px] px-1 py-0.5 bg-accent-red/20 text-accent-red border border-accent-red/40 rounded font-mono inline-flex items-center gap-0.5"
                  title={`Deadline VIP: llegar antes de ${v.vip_deadline_time}`}
                >
                  <Clock size={9} />
                  {v.vip_deadline_time}
                </span>
              )}
            </div>
            <div className="text-[11px] text-text-muted truncate" title={v.address}>{v.address}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-semibold text-accent-red tabular-nums">{(v.p_fallo * 100).toFixed(0)}%</div>
            <div className="text-[9px] uppercase tracking-wider text-text-muted">P(fallo)</div>
          </div>
        </div>
      </div>

      {/* Driver + ETA */}
      <div className="px-3 pb-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="text-text-muted flex items-center gap-1"><Truck size={10} />Vehículo</div>
        <div className="font-mono">{v.vehicle_name} · #{v.order}</div>
        <div className="text-text-muted flex items-center gap-1"><User size={10} />Driver</div>
        <div className="truncate">{v.driver_name}</div>
        {v.empresa_nombre && (
          <>
            <div className="text-text-muted flex items-center gap-1"><Building2 size={10} />Empresa</div>
            <div>{v.empresa_nombre}</div>
          </>
        )}
        <div className="text-text-muted flex items-center gap-1"><Clock size={10} />ETA / Window</div>
        <div className="tabular-nums"><span className="text-text-primary">{v.estimated_time_arrival.slice(0, 5)}</span> / {v.window_end.slice(0, 5)}</div>
        <div className="text-text-muted">Slack</div>
        <div className={`tabular-nums font-semibold ${slackClass}`}>{v.slack_min.toFixed(0)} min</div>
      </div>

      {/* Razones (max 2 visibles + +N más) */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {v.reasons.slice(0, 2).map((r, i) => (
          <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 bg-bg-700 border border-line/60 rounded text-text-secondary">
            {r}
          </span>
        ))}
        {v.reasons.length > 2 && (
          <span
            className="inline-block text-[10px] px-1.5 py-0.5 bg-bg-700/60 border border-line/40 rounded text-text-muted"
            title={v.reasons.slice(2).join(' · ')}
          >
            +{v.reasons.length - 2} más
          </span>
        )}
      </div>

      {/* Notif status */}
      {v.notif ? (
        <div className={`px-3 py-1 text-[10px] flex items-center gap-1 border-t border-line ${
          v.notif.last_status === 'sent' ? 'text-brand bg-brand/5'
          : v.notif.last_status === 'dry_run' ? 'text-accent-yellow bg-accent-yellow/5'
          : 'text-accent-red bg-accent-red/5'
        }`}>
          <MessageSquare size={11} />
          <span className="font-semibold">{v.notif.sent_count}/{v.notif.count} enviadas</span>
          <span className="text-text-muted">· último: {v.notif.last_status} · {new Date(v.notif.last_created_at).toLocaleTimeString('es-CL', { hour12: false })}</span>
        </div>
      ) : (
        <div className="px-3 py-1 text-[10px] text-text-muted bg-bg-700/40 border-t border-line">
          Sin notificaciones aún
        </div>
      )}

      {/* Acciones */}
      <div className="px-3 py-2 flex items-center gap-1 border-t border-line bg-bg-800">
        <button onClick={onNotify} className="btn-primary flex items-center gap-1 text-[11px] flex-1 justify-center">
          <Phone size={11} /> Notificar
        </button>
        {isAdmin && v.priority !== 'high' && v.priority !== 'vip' && (
          <button
            onClick={() => priorityMut.mutate('high')}
            className="btn flex items-center gap-1 text-[11px]"
            disabled={priorityMut.isPending}
            title="Elevar a prioridad alta"
          >
            <AlertTriangle size={11} /> Escalar
          </button>
        )}
        {isAdmin && !v.is_vip && (
          <button
            onClick={() => vipMut.mutate()}
            className="btn flex items-center gap-1 text-[11px] hover:text-cmr"
            disabled={vipMut.isPending}
            title="Marcar cliente como VIP"
          >
            <Star size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function NotifyModal({ visit, onClose }: { visit: WatchlistVisit; onClose: () => void }) {
  const qc = useQueryClient();
  const [numbers, setNumbers] = useState('');
  const defaultBody =
    `[Falabella ValueData] Alerta\n` +
    `Cliente: ${visit.title}\n` +
    `Vehículo: ${visit.vehicle_name} (${visit.driver_name})\n` +
    `ETA: ${visit.estimated_time_arrival.slice(0, 5)} · Window: ${visit.window_end.slice(0, 5)} · Slack: ${visit.slack_min.toFixed(0)}m\n` +
    `Riesgo: ${(visit.p_fallo * 100).toFixed(0)}% · ${visit.reasons[0] ?? ''}`;
  const [body, setBody] = useState(defaultBody);

  const sendMut = useMutation({
    mutationFn: () => api.notif.send({
      body,
      to_numbers: numbers.split(',').map(s => s.trim()).filter(Boolean),
      tracking_id: visit.tracking_id,
      subject: `Alerta ${visit.title}`,
      triggered_by: 'manual',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-lg panel" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold">Notificar: {visit.title}</h3>
          <button onClick={onClose} className="text-text-muted hover:text-accent-red"><X size={16} /></button>
        </div>
        <div className="p-4 flex flex-col gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Destinatarios (E.164 separados por coma)</span>
            <input value={numbers} onChange={e => setNumbers(e.target.value)} placeholder="+56912345678, +56987654321" className="input" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted">Mensaje</span>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={7} className="input font-mono text-[11px] resize-none" />
          </label>
          <div className="flex items-center gap-2 pt-2 border-t border-line">
            <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !numbers.trim()} className="btn-primary flex items-center gap-2">
              {sendMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Phone size={12} />}
              Enviar WhatsApp
            </button>
            <button onClick={onClose} className="btn">Cancelar</button>
            {sendMut.isError && <span className="text-[11px] text-accent-red">{String(sendMut.error)}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
