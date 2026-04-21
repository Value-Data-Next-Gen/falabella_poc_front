import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, ChevronRight,
  Clock, MapPin, Star, Truck, User, X,
} from 'lucide-react';
import { api } from '../api';
import { PlanVisit, Priority } from '../types';
import { useAuth } from '../hooks/useAuth';

export function PlanDiarioPanel() {
  const { isFalabella, isAdmin } = useAuth();
  const empresasQ = useQuery({ queryKey: ['empresas'], queryFn: api.empresas, enabled: isFalabella });
  const [selectedEmpresa, setSelectedEmpresa] = useState<number | 'all'>('all');

  const planQ = useQuery({
    queryKey: ['plan-diario', selectedEmpresa],
    queryFn: () => api.planDiario(selectedEmpresa === 'all' ? undefined : selectedEmpresa),
    refetchInterval: 5_000,  // live refresh cada 5s
  });

  const totals = useMemo(() => {
    const empresas = planQ.data?.empresas ?? [];
    return {
      empresas: empresas.length,
      drivers: empresas.reduce((s, e) => s + e.drivers.length, 0),
      visits: empresas.reduce((s, e) => s + e.total_visits, 0),
      completed: empresas.reduce((s, e) => s + e.completed, 0),
      red: empresas.reduce((s, e) => s + e.red_visits, 0),
      vip: empresas.reduce((s, e) => s + e.vip_visits, 0),
      high: empresas.reduce((s, e) => s + e.high_priority, 0),
    };
  }, [planQ.data]);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <span>Plan del día · {planQ.data?.planned_date ?? '—'}</span>
          {isFalabella && (
            <select
              value={selectedEmpresa}
              onChange={e => setSelectedEmpresa(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="input ml-auto normal-case tracking-normal"
            >
              <option value="all">Todas las empresas</option>
              {empresasQ.data?.map(e => (
                <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>
              ))}
            </select>
          )}
        </div>
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <Stat label="Empresas" value={totals.empresas} icon={Building2} />
          <Stat label="Drivers" value={totals.drivers} icon={Truck} />
          <Stat label="Visitas" value={totals.visits} icon={MapPin} />
          <Stat label="Completadas" value={totals.completed} icon={CheckCircle2} accent="text-brand" />
          <Stat label="RED pendientes" value={totals.red} icon={AlertTriangle} accent="text-accent-red" />
          <Stat label="VIP" value={totals.vip} icon={Star} accent="text-cmr" />
          <Stat label="High priority" value={totals.high} icon={AlertTriangle} accent="text-accent-yellow" />
        </div>
      </div>

      {/* Empresas → Drivers */}
      {planQ.data?.empresas.map(emp => (
        <EmpresaSection
          key={emp.empresa_id}
          empresa={emp}
          canMarkVip={isAdmin}
        />
      ))}

      {!planQ.data?.empresas.length && (
        <div className="panel p-6 text-center text-text-muted text-sm">
          No hay visitas planificadas para los filtros seleccionados.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: {
  label: string; value: number | string; icon: any; accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted flex items-center gap-1">
        <Icon size={10} /> {label}
      </span>
      <span className={`text-xl font-semibold tabular-nums ${accent ?? ''}`}>{value}</span>
    </div>
  );
}

function EmpresaSection({ empresa, canMarkVip }: { empresa: any; canMarkVip: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="panel">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full panel-title flex items-center gap-2 hover:bg-bg-700/30 transition-colors"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Building2 size={13} />
        <span>{empresa.nombre}</span>
        <span className="ml-auto flex items-center gap-3 text-[11px] font-normal normal-case tracking-normal text-text-muted">
          <span>{empresa.drivers.length} drivers</span>
          <span>{empresa.total_visits} visitas</span>
          {empresa.red_visits > 0 && (
            <span className="text-accent-red">{empresa.red_visits} RED</span>
          )}
          {empresa.vip_visits > 0 && (
            <span className="text-cmr">★ {empresa.vip_visits}</span>
          )}
        </span>
      </button>

      {open && (
        <div className="flex flex-col">
          {empresa.drivers.map((d: any) => (
            <DriverRow key={d.vehicle_id} driver={d} canMarkVip={canMarkVip} />
          ))}
        </div>
      )}
    </div>
  );
}

function DriverRow({ driver, canMarkVip }: { driver: any; canMarkVip: boolean }) {
  const [open, setOpen] = useState(false);
  const pct = driver.total_visits > 0 ? Math.round((driver.completed / driver.total_visits) * 100) : 0;
  const nextOrder = driver.visits.find((v: PlanVisit) => v.status === 'pending')?.order;
  const isActive = driver.pending > 0 && driver.completed > 0;  // en ruta

  return (
    <div className="border-t border-line">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-bg-700/30 text-xs transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Truck size={12} className={isActive ? 'text-brand animate-pulse' : 'text-text-secondary'} />
        <span className="font-mono">{driver.vehicle_name}</span>
        <User size={11} className="text-text-muted ml-2" />
        <span className="text-text-secondary">{driver.driver_name}</span>

        {/* Barra de progreso inline */}
        <div className="flex items-center gap-2 mx-4 flex-1 min-w-[140px] max-w-[320px]">
          <div className="flex-1 h-1.5 bg-bg-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                pct === 100 ? 'bg-brand'
                : pct >= 50 ? 'bg-brand'
                : pct > 0 ? 'bg-accent-yellow'
                : 'bg-bg-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-text-muted tabular-nums text-[11px] shrink-0">{pct}%</span>
        </div>

        <span className="flex items-center gap-3 text-text-muted text-[11px]">
          <span>{driver.completed}/{driver.total_visits}</span>
          {nextOrder != null && <span className="text-brand">▶ #{nextOrder}</span>}
          {driver.red_visits > 0 && <span className="text-accent-red">{driver.red_visits} RED</span>}
          {driver.vip_visits > 0 && <span className="text-cmr">★ {driver.vip_visits}</span>}
          {driver.high_priority > 0 && <span className="text-accent-yellow">▲ {driver.high_priority}</span>}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-text-muted uppercase tracking-wider text-[10px] border-t border-b border-line bg-bg-700/40">
              <tr>
                <th className="px-2 py-1 text-left w-10">#</th>
                <th className="px-2 py-1 text-left">Cliente</th>
                <th className="px-2 py-1 text-left">Dirección</th>
                <th className="px-2 py-1 text-left">ETA</th>
                <th className="px-2 py-1 text-right">Slack</th>
                <th className="px-2 py-1 text-right">P(fallo)</th>
                <th className="px-2 py-1 text-center">Status</th>
                <th className="px-2 py-1 text-center">Prioridad</th>
                <th className="px-2 py-1 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {driver.visits.map((v: PlanVisit) => (
                <VisitRow
                  key={v.tracking_id}
                  v={v}
                  canMarkVip={canMarkVip}
                  isNext={v.order === nextOrder}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VisitRow({ v, canMarkVip, isNext = false }: { v: PlanVisit; canMarkVip: boolean; isNext?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const setPriorityMut = useMutation({
    mutationFn: (req: { priority: Priority; reason?: string }) =>
      api.priorities.set(v.tracking_id, req.priority, req.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plan-diario'] });
      setEditing(false);
    },
  });

  const markVipMut = useMutation({
    mutationFn: () => api.vip.create({
      match_type: 'title',
      match_value: v.title,
      tier: 'VIP',
      notes: `Marcado desde Plan Diario · ${v.tracking_id}`,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plan-diario'] }),
  });

  const slackClass =
    v.slack_min < 0 ? 'text-accent-red'
    : v.slack_min < 20 ? 'text-accent-yellow'
    : 'text-brand';
  const rowClass =
    v.status === 'completed' ? 'opacity-70'
    : isNext ? 'bg-brand/10 border-l-2 border-l-brand'
    : v.is_vip ? 'bg-cmr/5'
    : v.priority === 'high' ? 'bg-accent-red/5'
    : '';

  return (
    <tr className={`border-t border-line/40 hover:bg-bg-700/30 ${rowClass}`}>
      <td className="px-2 py-1 font-mono text-text-muted">
        {isNext && <span className="text-brand mr-1">▶</span>}
        {v.order}
      </td>
      <td className="px-2 py-1 flex items-center gap-1">
        {v.is_vip && <Star size={11} className="text-cmr" />}
        {v.alert_valuedata && <AlertTriangle size={10} className="text-accent-violet" />}
        <span className="font-medium truncate">{v.title}</span>
      </td>
      <td className="px-2 py-1 text-text-muted truncate max-w-[240px]" title={v.address}>{v.address}</td>
      <td className="px-2 py-1 tabular-nums"><Clock size={10} className="inline mr-1" />{v.estimated_time_arrival.slice(0, 5)}</td>
      <td className={`px-2 py-1 text-right tabular-nums ${slackClass}`}>{v.slack_min.toFixed(0)}</td>
      <td className="px-2 py-1 text-right tabular-nums">
        <span className={v.p_fallo >= 0.5 ? 'text-accent-red' : v.p_fallo >= 0.2 ? 'text-accent-yellow' : 'text-text-secondary'}>
          {(v.p_fallo * 100).toFixed(0)}%
        </span>
      </td>
      <td className="px-2 py-1 text-center">
        <span className={`pill ${v.status === 'completed' ? 'pill-green' : v.alert_slack === 'RED' ? 'pill-red' : v.alert_slack === 'YELLOW' ? 'pill-yellow' : 'pill-blue'}`}>
          {v.status === 'completed' ? 'OK' : v.alert_slack}
        </span>
      </td>
      <td className="px-2 py-1 text-center">
        <PriorityPill p={v.priority} />
      </td>
      <td className="px-2 py-1 text-center">
        <div className="flex items-center justify-center gap-1">
          {editing ? (
            <PriorityEditor
              current={v.priority}
              onSave={(p, reason) => setPriorityMut.mutate({ priority: p, reason })}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-text-muted hover:text-brand"
                title="Cambiar prioridad"
              >
                ▲
              </button>
              {canMarkVip && !v.is_vip && (
                <button
                  onClick={() => markVipMut.mutate()}
                  disabled={markVipMut.isPending}
                  className="text-text-muted hover:text-cmr"
                  title="Marcar cliente como VIP (title match)"
                >
                  <Star size={11} />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function PriorityPill({ p }: { p: PlanVisit['priority'] }) {
  const cls: Record<PlanVisit['priority'], string> = {
    vip: 'bg-cmr/20 text-cmr border-cmr/40',
    high: 'bg-accent-red/20 text-accent-red border-accent-red/40',
    normal: 'bg-bg-700 text-text-secondary border-line',
    low: 'bg-bg-700 text-text-muted border-line',
  };
  return <span className={`pill border ${cls[p]}`}>{p.toUpperCase()}</span>;
}

function PriorityEditor({ current, onSave, onCancel }: {
  current: Priority; onSave: (p: Priority, reason?: string) => void; onCancel: () => void;
}) {
  const [p, setP] = useState<Priority>(current);
  const [reason, setReason] = useState('');
  return (
    <div className="absolute bg-bg-800 border border-line rounded-md shadow-xl p-2 flex flex-col gap-1 z-10"
         style={{ transform: 'translate(-50%, -50%)', position: 'fixed', top: '50%', left: '50%' }}>
      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-text-muted">Prioridad:</span>
        {(['low', 'normal', 'high', 'vip'] as Priority[]).map(pp => (
          <button
            key={pp}
            onClick={() => setP(pp)}
            className={`px-2 py-0.5 rounded border text-[10px] ${p === pp ? 'bg-brand/20 border-brand text-brand' : 'border-line text-text-secondary'}`}
          >
            {pp}
          </button>
        ))}
      </div>
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motivo (opcional)"
        className="input text-[11px]"
      />
      <div className="flex items-center gap-1">
        <button onClick={() => onSave(p, reason || undefined)} className="btn-primary text-[10px]">Guardar</button>
        <button onClick={onCancel} className="btn text-[10px]"><X size={10} /></button>
      </div>
    </div>
  );
}
