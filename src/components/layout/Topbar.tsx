import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, Search, X } from 'lucide-react';
import { api } from '../../api';
import { ModuleKey, MODULES } from './Sidebar';
import { StreamEvent } from '../../types';

const NOTIF_SEEN_KEY = 'fpoc.notif.lastSeenId';

export function Topbar({
  moduleKey,
  subTab,
  onNavigate,
}: {
  moduleKey: ModuleKey;
  subTab: string | null;
  onNavigate: (m: ModuleKey, sub?: string) => void;
}) {
  const moduleDef = MODULES.find(m => m.key === moduleKey);

  // Search
  const [searchInput, setSearchInput] = useState('');
  const [searchDeb, setSearchDeb] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDeb(searchInput.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const vipQ = useQuery({
    queryKey: ['topbar-search-vip', searchDeb],
    queryFn: () => api.vip.list({ q: searchDeb }),
    enabled: searchDeb.length >= 2,
  });

  // Notifications bell
  const eventsQ = useQuery({
    queryKey: ['topbar-events'],
    queryFn: () => api.events(20),
    refetchInterval: 5000,
  });
  const [bellOpen, setBellOpen] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(() => {
    try { return localStorage.getItem(NOTIF_SEEN_KEY); } catch { return null; }
  });
  const events = eventsQ.data ?? [];
  const unread = lastSeenId
    ? events.findIndex(e => e.event_id === lastSeenId)
    : events.length;
  const unreadCount = unread === -1 ? events.length : unread;

  const markAllSeen = () => {
    if (events.length === 0) return;
    setLastSeenId(events[0].event_id);
    try { localStorage.setItem(NOTIF_SEEN_KEY, events[0].event_id); } catch {}
  };

  const showResults = searchDeb.length >= 2;

  return (
    <header className="h-14 border-b border-line bg-bg-800 px-4 flex items-center gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] min-w-0">
        <span className="text-text-muted">{moduleDef?.label ?? '—'}</span>
        {subTab && (
          <>
            <span className="text-text-muted">/</span>
            <span className="text-text-primary font-medium truncate">{subTab}</span>
          </>
        )}
      </div>

      {/* Search (centered) */}
      <div className="flex-1 max-w-[480px] relative">
        <div className="flex items-center gap-2 input py-1.5">
          <Search size={13} className="text-text-muted shrink-0" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar VIP, empresa, driver, tracking…"
            className="bg-transparent flex-1 outline-none text-[12px]"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="text-text-muted hover:text-text-primary"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 panel max-h-[300px] overflow-auto z-30 shadow-xl">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted border-b border-line/60">
              {vipQ.data?.length ?? 0} VIPs encontrados
            </div>
            {(vipQ.data ?? []).slice(0, 8).map(v => (
              <button
                key={v.vip_id}
                onClick={() => {
                  onNavigate('maestros', 'vips');
                  setSearchInput('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-bg-700/40 border-b border-line/30"
              >
                <div className="text-[12px] font-medium truncate">{v.match_value}</div>
                <div className="text-[10px] text-text-muted">{v.match_type} · {v.tier}</div>
              </button>
            ))}
            {(vipQ.data?.length ?? 0) === 0 && !vipQ.isLoading && (
              <div className="px-3 py-3 text-[12px] text-text-muted text-center">Sin coincidencias.</div>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => { setBellOpen(o => !o); if (!bellOpen) markAllSeen(); }}
            className="relative p-2 rounded-md hover:bg-bg-700/50 text-text-secondary"
            title="Notificaciones"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent-red text-white text-[9px] font-semibold rounded-full px-1 min-w-[16px] h-[16px] flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 top-full mt-1 w-[360px] panel max-h-[400px] overflow-auto z-30 shadow-xl">
              <div className="panel-title flex items-center justify-between">
                <span>Eventos recientes</span>
                <button
                  onClick={() => setBellOpen(false)}
                  className="text-text-muted hover:text-text-primary"
                ><X size={12} /></button>
              </div>
              {events.length === 0 ? (
                <div className="p-4 text-center text-[12px] text-text-muted">Sin eventos.</div>
              ) : (
                <div className="divide-y divide-line/40">
                  {events.slice(0, 10).map(e => <BellEventRow key={e.event_id} e={e} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BellEventRow({ e }: { e: StreamEvent }) {
  const hour = e.sim_ts.slice(11, 16);
  const label = labelForType(e.type);
  return (
    <div className="px-3 py-2 hover:bg-bg-700/30">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
        <span className="ml-auto text-[10px] tabular-nums text-text-muted">{hour}</span>
      </div>
      <div className="text-[12px] truncate">{e.title || e.reason || e.motivo || '—'}</div>
      {e.tracking_id && (
        <div className="text-[10px] text-text-muted font-mono truncate">{e.tracking_id}</div>
      )}
    </div>
  );
}

function labelForType(t: string): string {
  switch (t) {
    case 'comment_alert': return 'Motivo alertable';
    case 'vip_deadline_warning': return 'Deadline VIP';
    case 'motivo_correction_suggested': return 'Revisión IA';
    case 'motivo_correction_decided': return 'Decisión IA';
    case 'alert_triggered': return 'Alerta VD';
    case 'failed_delivery': return 'Falla';
    case 'delivery': return 'Entrega';
    case 'incident_manual': return 'Incidente';
    case 'red_simpli': return 'Rojo SimpliRoute';
    default: return t;
  }
}
