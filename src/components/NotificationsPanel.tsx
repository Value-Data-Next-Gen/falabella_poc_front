import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle2, Globe, MessageSquare, Plus, Shield, ShieldAlert, Star, Trash2, TriangleAlert, User, Users, XCircle,
} from 'lucide-react';
import { api } from '../api';
import { AccessLogRow, MatchType, NotificationLogRow, Priority, VipClient } from '../types';
import { useAuth } from '../hooks/useAuth';

export function NotificationsPanel() {
  const { isAdmin } = useAuth();
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <VipSection />
        <PrioritiesSection />
      </div>
      <LogSection />
      {isAdmin && <AccessLogSection />}
    </div>
  );
}

// ------------------- VIP -------------------
function VipSection() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const vipsQ = useQuery({ queryKey: ['vip-list'], queryFn: api.vip.list });
  const [matchType, setMatchType] = useState<MatchType>('title');
  const [matchValue, setMatchValue] = useState('');
  const [notes, setNotes] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.vip.create({
      match_type: matchType,
      match_value: matchValue.trim(),
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => {
      setMatchValue(''); setNotes('');
      qc.invalidateQueries({ queryKey: ['vip-list'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.vip.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vip-list'] }),
  });

  return (
    <div className="panel">
      <div className="panel-title flex items-center gap-1">
        <Star size={12} className="text-cmr" /> Clientes VIP
      </div>

      {isAdmin && (
        <div className="p-2 border-b border-line flex flex-wrap gap-2 items-center">
          <select
            value={matchType}
            onChange={e => setMatchType(e.target.value as MatchType)}
            className="input"
          >
            <option value="title">Title</option>
            <option value="customer_id">Customer ID</option>
            <option value="reference">Reference</option>
          </select>
          <input
            placeholder="Match value"
            value={matchValue}
            onChange={e => setMatchValue(e.target.value)}
            className="input flex-1 min-w-[180px]"
          />
          <input
            placeholder="Notas (opcional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input flex-1 min-w-[140px]"
          />
          <button
            onClick={() => createMut.mutate()}
            disabled={!matchValue.trim() || createMut.isPending}
            className="btn-primary flex items-center gap-1"
          >
            <Plus size={12} /> Agregar
          </button>
        </div>
      )}

      <div className="max-h-80 overflow-y-auto">
        {vipsQ.data?.length ? (
          <table className="w-full text-xs">
            <thead className="text-text-muted uppercase tracking-wider text-[10px] border-b border-line sticky top-0 bg-bg-800">
              <tr>
                <th className="text-left px-2 py-1">Tipo</th>
                <th className="text-left px-2 py-1">Valor</th>
                <th className="text-left px-2 py-1">Empresa</th>
                <th className="text-left px-2 py-1">Tier</th>
                <th className="text-left px-2 py-1">Notas</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {vipsQ.data.map(v => <VipRow key={v.vip_id} v={v} onDelete={id => deleteMut.mutate(id)} isAdmin={isAdmin} />)}
            </tbody>
          </table>
        ) : (
          <div className="text-text-muted italic p-4 text-xs">Sin clientes VIP</div>
        )}
      </div>
    </div>
  );
}

function VipRow({ v, onDelete, isAdmin }: { v: VipClient; onDelete: (id: number) => void; isAdmin: boolean }) {
  return (
    <tr className="border-t border-line/50 hover:bg-bg-700/40">
      <td className="px-2 py-1"><span className="pill pill-yellow">{v.match_type}</span></td>
      <td className="px-2 py-1 font-medium">{v.match_value}</td>
      <td className="px-2 py-1 text-text-muted">{v.empresa_id ?? 'Global'}</td>
      <td className="px-2 py-1"><span className="pill pill-violet">{v.tier}</span></td>
      <td className="px-2 py-1 text-text-muted text-[11px] max-w-[200px] truncate">{v.notes}</td>
      {isAdmin && (
        <td className="px-2 py-1 text-right">
          <button onClick={() => onDelete(v.vip_id)} className="text-text-muted hover:text-accent-red" title="Eliminar">
            <Trash2 size={12} />
          </button>
        </td>
      )}
    </tr>
  );
}

// ------------------- Prioridades -------------------
function PrioritiesSection() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Priority | ''>('');
  const listQ = useQuery({
    queryKey: ['priorities', filter],
    queryFn: () => api.priorities.list(filter || undefined),
  });
  const clearMut = useMutation({
    mutationFn: (tid: string) => api.priorities.clear(tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['priorities'] }),
  });

  return (
    <div className="panel">
      <div className="panel-title flex items-center gap-1">
        <TriangleAlert size={12} className="text-accent-yellow" /> Overrides de prioridad
      </div>
      <div className="p-2 border-b border-line flex gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value as Priority | '')} className="input">
          <option value="">Todas</option>
          <option value="vip">VIP</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <span className="text-[10px] text-text-muted ml-auto self-center">
          {listQ.data?.length ?? 0} overrides
        </span>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {listQ.data?.length ? (
          <table className="w-full text-xs">
            <thead className="text-text-muted uppercase tracking-wider text-[10px] border-b border-line sticky top-0 bg-bg-800">
              <tr>
                <th className="text-left px-2 py-1">Tracking</th>
                <th className="text-left px-2 py-1">Prioridad</th>
                <th className="text-left px-2 py-1">Motivo</th>
                <th className="text-left px-2 py-1">Por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listQ.data.map(p => (
                <tr key={p.tracking_id} className="border-t border-line/50 hover:bg-bg-700/40">
                  <td className="px-2 py-1 font-mono text-[10px]">{p.tracking_id}</td>
                  <td className="px-2 py-1"><PriorityBadge p={p.priority} /></td>
                  <td className="px-2 py-1 text-text-muted text-[11px]">{p.reason}</td>
                  <td className="px-2 py-1 text-text-muted text-[11px]">{p.set_by_name}</td>
                  <td className="px-2 py-1 text-right">
                    <button onClick={() => clearMut.mutate(p.tracking_id)} className="text-text-muted hover:text-accent-red">
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-text-muted italic p-4 text-xs">Sin overrides</div>
        )}
      </div>
    </div>
  );
}

export function PriorityBadge({ p }: { p: Priority }) {
  const map: Record<Priority, string> = {
    vip: 'bg-cmr/20 text-cmr border-cmr/40',
    high: 'bg-accent-red/20 text-accent-red border-accent-red/40',
    normal: 'bg-bg-700 text-text-secondary border-line',
    low: 'bg-bg-700 text-text-muted border-line',
  };
  return (
    <span className={`pill border ${map[p]}`}>{p.toUpperCase()}</span>
  );
}

// ------------------- Log -------------------
function LogSection() {
  const logQ = useQuery({ queryKey: ['notif-log'], queryFn: () => api.notif.log(50), refetchInterval: 10_000 });

  const stats = useMemo(() => {
    const rows = logQ.data ?? [];
    return {
      total: rows.length,
      sent: rows.filter(r => r.status === 'sent').length,
      dry: rows.filter(r => r.status === 'dry_run').length,
      err: rows.filter(r => r.status === 'error').length,
    };
  }, [logQ.data]);

  return (
    <div className="panel">
      <div className="panel-title flex items-center gap-1">
        <MessageSquare size={12} className="text-brand" /> Log de notificaciones
        <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-text-muted">
          {stats.total} total · {stats.sent} enviadas · {stats.dry} dry-run · {stats.err} errores
        </span>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="text-text-muted uppercase tracking-wider text-[10px] border-b border-line sticky top-0 bg-bg-800">
            <tr>
              <th className="text-left px-2 py-1">Cuándo</th>
              <th className="text-left px-2 py-1">Destino</th>
              <th className="text-left px-2 py-1">Trigger</th>
              <th className="text-left px-2 py-1">Status</th>
              <th className="text-left px-2 py-1">Body</th>
            </tr>
          </thead>
          <tbody>
            {logQ.data?.map(r => <LogRow key={r.notification_id} r={r} />)}
            {!logQ.data?.length && (
              <tr><td colSpan={5} className="text-center text-text-muted italic p-6">Sin envíos registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogRow({ r }: { r: NotificationLogRow }) {
  const StatusIcon = r.status === 'sent' ? CheckCircle2 : r.status === 'error' ? XCircle : Bell;
  const statusClass =
    r.status === 'sent' ? 'text-brand'
    : r.status === 'error' ? 'text-accent-red'
    : 'text-accent-yellow';
  const dt = new Date(r.created_at);
  return (
    <tr className="border-t border-line/50 hover:bg-bg-700/40">
      <td className="px-2 py-1 text-text-muted text-[10px] tabular-nums whitespace-nowrap">
        {dt.toLocaleString('es-CL', { hour12: false })}
      </td>
      <td className="px-2 py-1 font-mono text-[11px]">{r.to_number}</td>
      <td className="px-2 py-1"><span className="pill pill-blue">{r.triggered_by}</span></td>
      <td className="px-2 py-1">
        <span className={`flex items-center gap-1 ${statusClass}`}>
          <StatusIcon size={11} /> {r.status}
        </span>
      </td>
      <td className="px-2 py-1 text-[11px] max-w-[400px] truncate" title={r.body}>{r.body}</td>
    </tr>
  );
}

// ------------------- Access log (audit) -------------------
function AccessLogSection() {
  const [filter, setFilter] = useState<'' | 'login_success' | 'login_failed'>('');
  const logQ = useQuery({
    queryKey: ['access-log', filter],
    queryFn: () => api.accessLog({ limit: 100, event_type: filter || undefined }),
    refetchInterval: 15_000,
  });
  const sumQ = useQuery({
    queryKey: ['access-summary'],
    queryFn: api.accessSummary,
    refetchInterval: 30_000,
  });

  return (
    <div className="panel">
      <div className="panel-title flex items-center gap-1">
        <Shield size={12} className="text-brand" /> Auditoría de accesos
        <span className="ml-auto text-[11px] font-normal normal-case tracking-normal text-text-muted">
          últimas 24h: <b className="text-text-primary">{sumQ.data?.total_24h ?? 0}</b> intentos ·
          {' '}<b className="text-brand">{sumQ.data?.success_24h ?? 0}</b> ok ·
          {' '}<b className="text-accent-red">{sumQ.data?.failed_24h ?? 0}</b> fail ·
          {' '}<b>{sumQ.data?.unique_users_24h ?? 0}</b> users ·
          {' '}<b>{sumQ.data?.unique_ips_24h ?? 0}</b> ips
        </span>
      </div>
      <div className="p-2 border-b border-line flex gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="input">
          <option value="">Todos los eventos</option>
          <option value="login_success">Solo exitosos</option>
          <option value="login_failed">Solo fallidos</option>
        </select>
        <span className="text-[10px] text-text-muted ml-auto self-center">{logQ.data?.length ?? 0} registros · refresh 15s</span>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-800 text-text-muted uppercase tracking-wider text-[10px] border-b border-line">
            <tr>
              <th className="text-left px-2 py-1">Cuándo</th>
              <th className="text-left px-2 py-1">Evento</th>
              <th className="text-left px-2 py-1">Usuario</th>
              <th className="text-left px-2 py-1">IP</th>
              <th className="text-left px-2 py-1">Browser / dispositivo</th>
              <th className="text-left px-2 py-1">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {logQ.data?.map(r => <AccessRow key={r.log_id} r={r} />)}
            {!logQ.data?.length && (
              <tr><td colSpan={6} className="text-center text-text-muted italic p-6">Sin registros</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccessRow({ r }: { r: AccessLogRow }) {
  const isOk = r.event_type === 'login_success';
  const dt = new Date(r.created_at + 'Z');
  const ua = parseUserAgent(r.user_agent);
  return (
    <tr className="border-t border-line/40 hover:bg-bg-700/30">
      <td className="px-2 py-1 font-mono text-[10px] text-text-muted whitespace-nowrap tabular-nums">
        {dt.toLocaleString('es-CL', { hour12: false })}
      </td>
      <td className="px-2 py-1">
        <span className={`flex items-center gap-1 text-[11px] ${isOk ? 'text-brand' : 'text-accent-red'}`}>
          {isOk ? <CheckCircle2 size={11} /> : <ShieldAlert size={11} />}
          {isOk ? 'OK' : 'FAIL'}
        </span>
      </td>
      <td className="px-2 py-1">
        {r.user_display_name ? (
          <div className="flex flex-col">
            <span className="font-semibold text-[11px]">{r.user_display_name}</span>
            <span className="text-[10px] text-text-muted">{r.user_email} · {r.user_role}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-text-muted text-[11px] italic">usuario desconocido</span>
            {r.email_attempted && <span className="text-[10px] text-text-muted">intento: {r.email_attempted}</span>}
          </div>
        )}
      </td>
      <td className="px-2 py-1 font-mono text-[11px]">
        <span className="flex items-center gap-1">
          <Globe size={10} className="text-text-muted" />
          {r.ip_address || '—'}
        </span>
      </td>
      <td className="px-2 py-1 text-[11px] text-text-secondary truncate max-w-[220px]" title={r.user_agent ?? ''}>
        {ua}
      </td>
      <td className="px-2 py-1 text-[11px] text-accent-red truncate max-w-[160px]" title={r.error_detail ?? ''}>
        {r.error_detail ?? ''}
      </td>
    </tr>
  );
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return '—';
  // Extractor simple: browser + OS
  let browser = 'Otro';
  if (/Chrome\//.test(ua) && !/Edg|OPR/.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/curl\//i.test(ua)) browser = 'curl';
  else if (/python/i.test(ua)) browser = 'python';

  let os = '';
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iOS/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return os ? `${browser} · ${os}` : browser;
}
