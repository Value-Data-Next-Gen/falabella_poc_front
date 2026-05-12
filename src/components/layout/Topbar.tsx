import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, Building2, Crown, MessageSquare, Package,
  Search, Sparkles, Star, Truck, User, X,
} from 'lucide-react';
import { api } from '../../api';
import { ModuleKey, MODULES } from './Sidebar';
import { SearchHit, SearchKind, SearchResults, StreamEvent } from '../../types';

const NOTIF_SEEN_KEY = 'fpoc.notif.lastSeenId';

// =============================================================================
// Sprint 7: buscador global multi-entidad
// =============================================================================
interface SectionDef {
  kind: SearchKind;
  label: string;
  icon: typeof Building2;
  iconClass?: string;
  pickHits: (r: SearchResults) => SearchHit[];
}

const SECTIONS: SectionDef[] = [
  { kind: 'empresa',  label: 'Empresas',  icon: Building2,      pickHits: r => r.empresas },
  { kind: 'contacto', label: 'Contactos', icon: User,           pickHits: r => r.contactos },
  { kind: 'driver',   label: 'Drivers',   icon: Truck,          pickHits: r => r.drivers },
  { kind: 'visita',   label: 'Visitas',   icon: Package,        pickHits: r => r.visitas },
  { kind: 'vip',      label: 'VIPs',      icon: Crown,          iconClass: 'text-cmr', pickHits: r => r.vips },
  { kind: 'motivo',   label: 'Motivos',   icon: MessageSquare,  pickHits: r => r.motivos },
];

/** Aplana los hits de los SECTIONS en orden, manteniendo el indice global para
 * poder navegarlos con teclado (↑↓). */
function flattenHits(r: SearchResults | undefined): SearchHit[] {
  if (!r) return [];
  return SECTIONS.flatMap(s => s.pickHits(r));
}

export function Topbar({
  moduleKey,
  subTab,
  onNavigate,
  onOpenTour,
}: {
  moduleKey: ModuleKey;
  subTab: string | null;
  onNavigate: (m: ModuleKey, sub?: string) => void;
  onOpenTour?: () => void;
}) {
  const moduleDef = MODULES.find(m => m.key === moduleKey);

  // ---------- Search (global, multi-entidad) ----------
  const [searchInput, setSearchInput] = useState('');
  const [searchDeb, setSearchDeb] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Atajo global Ctrl/Cmd+K → focus en el buscador
  useEffect(() => {
    const onGlobal = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onGlobal);
    return () => window.removeEventListener('keydown', onGlobal);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchDeb(searchInput.trim()), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // Reset índice activo cuando cambian los resultados
  useEffect(() => { setActiveIdx(0); }, [searchDeb]);

  const searchQ = useQuery({
    queryKey: ['topbar-search-global', searchDeb],
    queryFn: () => api.search.global(searchDeb),
    enabled: searchDeb.length >= 2,
    staleTime: 5_000,
  });

  const flatHits = useMemo(() => flattenHits(searchQ.data), [searchQ.data]);
  const showResults = searchDeb.length >= 2;

  const closeAndClear = () => {
    setSearchInput('');
    setSearchDeb('');
  };

  /** Navega al módulo apropiado según el tipo de hit. */
  const handleHitClick = (hit: SearchHit) => {
    switch (hit.kind) {
      case 'empresa':
      case 'contacto':
        onNavigate('onboarding', 'empresas');
        break;
      case 'driver':
        onNavigate('onboarding', 'drivers');
        break;
      case 'vip':
        onNavigate('onboarding', 'vips');
        break;
      case 'motivo':
        onNavigate('onboarding', 'motivos');
        break;
      case 'visita':
        onNavigate('operacion', 'plan');
        break;
    }
    // Persistimos el término clickeado en localStorage para que la página
    // destino pueda destacar el hit (resaltar fila / abrir drawer / filtrar).
    try {
      const payload = JSON.stringify({
        kind: hit.kind, id: hit.id, label: hit.label,
        empresa_id: hit.empresa_id, tracking_id: hit.tracking_id,
        ts: Date.now(),
      });
      localStorage.setItem('fpoc.search.lastHit', payload);
    } catch {}
    closeAndClear();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || flatHits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatHits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatHits[activeIdx] ?? flatHits[0];
      if (target) handleHitClick(target);
    } else if (e.key === 'Escape') {
      closeAndClear();
    }
  };

  // Cerrar al click fuera
  useEffect(() => {
    if (!showResults) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // No cerramos si el click es dentro: deja que el botón haga su trabajo
        setSearchDeb('');
        setSearchInput('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showResults]);

  // ---------- Notifications bell ----------
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
      <div ref={containerRef} className="flex-1 max-w-[480px] relative">
        <div className="flex items-center gap-2 input py-1.5">
          <Search size={13} className="text-text-muted shrink-0" />
          <input
            ref={searchInputRef}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar empresa, contacto, driver, visita, VIP, motivo…"
            className="bg-transparent flex-1 outline-none text-[12px]"
          />
          {!searchInput && (
            <kbd className="hidden md:inline-flex text-[9px] font-mono px-1 py-0.5 bg-bg-700 border border-line rounded text-text-muted">
              Ctrl+K
            </kbd>
          )}
          {searchInput && (
            <button
              onClick={closeAndClear}
              className="text-text-muted hover:text-text-primary"
            >
              <X size={12} />
            </button>
          )}
        </div>
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 panel max-h-[420px] overflow-auto z-30 shadow-xl">
            <SearchDropdown
              q={searchDeb}
              data={searchQ.data}
              loading={searchQ.isLoading}
              activeIdx={activeIdx}
              onHitClick={handleHitClick}
              onHitHover={setActiveIdx}
            />
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Tour */}
        {onOpenTour && (
          <button
            onClick={onOpenTour}
            className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-bg-700/50 text-text-secondary text-[11px]"
            title="Ver tour guiado de la plataforma"
          >
            <Sparkles size={13} className="text-brand" />
            Tour
          </button>
        )}
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

// =============================================================================
// Search dropdown
// =============================================================================
function SearchDropdown({
  q, data, loading, activeIdx, onHitClick, onHitHover,
}: {
  q: string;
  data: SearchResults | undefined;
  loading: boolean;
  activeIdx: number;
  onHitClick: (h: SearchHit) => void;
  onHitHover: (idx: number) => void;
}) {
  const total = data
    ? data.empresas.length + data.contactos.length + data.drivers.length
      + data.visitas.length + data.vips.length + data.motivos.length
    : 0;

  if (loading) {
    return <div className="px-3 py-3 text-[12px] text-text-muted text-center">Buscando…</div>;
  }
  if (!data) return null;
  if (total === 0) {
    return (
      <div className="px-3 py-3 text-[12px] text-text-muted text-center">
        Sin resultados para «{q}».
      </div>
    );
  }

  // Recalculamos índices globales por sección para resaltar el activo.
  let globalIdx = 0;

  return (
    <div>
      {SECTIONS.map(section => {
        const hits = section.pickHits(data);
        if (hits.length === 0) return null;
        const Icon = section.icon;
        const sectionStart = globalIdx;
        globalIdx += hits.length;
        return (
          <div key={section.kind}>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-muted border-b border-line/60 bg-bg-700/20 flex items-center gap-1.5">
              <Icon size={11} className={section.iconClass} />
              <span>{section.label}</span>
              <span className="ml-auto tabular-nums">{hits.length}</span>
            </div>
            {hits.map((hit, i) => {
              const idx = sectionStart + i;
              const active = idx === activeIdx;
              return (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  onClick={() => onHitClick(hit)}
                  onMouseEnter={() => onHitHover(idx)}
                  className={`w-full text-left px-3 py-2 border-b border-line/30 ${
                    active ? 'bg-bg-700/60' : 'hover:bg-bg-700/40'
                  }`}
                >
                  <div className="text-[12px] font-medium truncate flex items-center gap-1.5">
                    {section.kind === 'vip' && <Star size={10} className="text-cmr shrink-0" />}
                    <span className="truncate">{hit.label}</span>
                  </div>
                  {hit.sublabel && (
                    <div className="text-[10px] text-text-muted truncate">{hit.sublabel}</div>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Bell row (sin cambios respecto a versión anterior)
// =============================================================================
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
