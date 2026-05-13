import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Database,
  LogOut,
  Settings,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api';

export type ModuleKey =
  | 'onboarding'
  | 'planificacion'
  | 'operacion'
  | 'auditoria-ia'
  | 'control'
  | 'ia'
  | 'configuracion';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  hint: string;
  icon: any;
  group: 'data' | 'ops' | 'analytics' | 'system';
}

export const MODULES: ModuleDef[] = [
  { key: 'onboarding',     label: 'Onboarding',     hint: 'Empresas, vehículos, drivers, clientes VIP, usuarios, motivos', icon: Database,     group: 'data' },
  { key: 'planificacion',  label: 'Planificación',  hint: 'Día operativo y calendario',                                     icon: CalendarDays, group: 'ops' },
  { key: 'operacion',      label: 'Operación',      hint: 'Mapa y alertas en vivo',                                         icon: Truck,        group: 'ops' },
  { key: 'auditoria-ia',   label: 'Auditoría IA',   hint: 'Alertas IA, copiloto, correcciones de motivo',                   icon: Bot,          group: 'analytics' },
  { key: 'control',        label: 'Control',        hint: 'KPIs, scorecard de drivers, log de notificaciones',              icon: BarChart3,    group: 'analytics' },
  { key: 'ia',             label: 'IA / Modelo',    hint: 'Modelo XGB, métricas, calibración',                              icon: Brain,        group: 'analytics' },
  { key: 'configuracion',  label: 'Configuración',  hint: 'Alertas, WhatsApp, LLM, integraciones',                          icon: Settings,     group: 'system' },
];

const COLLAPSE_KEY = 'fpoc.sidebar.collapsed';

export function Sidebar({
  current,
  onChange,
}: {
  current: ModuleKey;
  onChange: (k: ModuleKey) => void;
}) {
  const { user, logout, isFalabella } = useAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch {}
  }, [collapsed]);

  // P4: badge de correcciones LLM pendientes. Polling cada 15s. Incluye las
  // sugerencias creadas vía WhatsApp por drivers, así el ops ve en el sidebar
  // que hay revisión sin tener que abrir el panel. Si la query falla, no
  // mostramos badge (no bloquea la nav).
  const pendingCorrectionsQ = useQuery({
    queryKey: ['sidebar-pending-corrections-count'],
    queryFn: () => api.motivoCorrections.list({ status: 'pending', limit: 100 }),
    refetchInterval: 15_000,
    retry: false,
  });
  const pendingCount = pendingCorrectionsQ.data?.length ?? 0;
  const badgeByModule: Partial<Record<ModuleKey, number>> = {
    'auditoria-ia': pendingCount,
  };

  const widthCls = collapsed ? 'w-16' : 'w-60';

  // Group separators: data | ops | analytics | system
  const groupBoundaries: Record<string, boolean> = { data: true, ops: false, analytics: false, system: false };

  return (
    <aside
      className={`${widthCls} shrink-0 border-r border-line bg-bg-800 flex flex-col transition-all duration-150`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2 px-3 border-b border-line/60">
        <div className="w-9 h-9 rounded-md bg-brand text-white flex items-center justify-center font-bold shrink-0">
          VD
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-[12px] font-semibold tracking-wide truncate">ValueData</span>
            <span className="text-[10px] text-text-muted truncate">× Falabella</span>
          </div>
        )}
      </div>

      {/* Module list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {MODULES.map((m, idx) => {
          const Icon = m.icon;
          const active = current === m.key;
          const showSeparator = idx > 0 && MODULES[idx - 1].group !== m.group;
          return (
            <div key={m.key}>
              {showSeparator && (
                <div className="mx-3 my-2 border-t border-line/30" />
              )}
              <button
                onClick={() => onChange(m.key)}
                title={m.hint}
                data-tour-id={`sidebar-${m.key}`}
                className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] transition-colors rounded-md mx-2 my-0.5 relative ${
                  active
                    ? 'bg-brand/15 text-brand font-medium'
                    : 'text-text-secondary hover:bg-bg-700/50 hover:text-text-primary'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{m.label}</span>}
                {(badgeByModule[m.key] ?? 0) > 0 && (
                  <span
                    className={`${collapsed
                      ? 'absolute top-1 right-1 w-2 h-2'
                      : 'ml-auto px-1.5 py-0.5 min-w-[18px] text-center'} `
                      + 'rounded-full bg-accent-red text-white text-[10px] font-bold shrink-0'}
                    title={`${badgeByModule[m.key]} correcciones pendientes`}
                  >
                    {collapsed ? '' : (badgeByModule[m.key]! > 99 ? '99+' : badgeByModule[m.key])}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Footer: user + collapse */}
      <div className="border-t border-line/60 p-2">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-bg-700/40">
            <div className="w-8 h-8 rounded-full bg-bg-700 text-text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
              {(user?.display_name || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[12px] font-medium truncate">{user?.display_name}</div>
              <div className="text-[10px] text-text-muted truncate">
                {isFalabella ? (user?.role === 'falabella_admin' ? 'Admin Falabella' : 'Ops Falabella') : (user?.empresa_nombre || 'Transportista')}
              </div>
            </div>
            <button
              onClick={logout}
              className="text-text-muted hover:text-accent-red"
              title="Cerrar sesión"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center py-2 rounded-md text-text-muted hover:bg-bg-700/40 hover:text-accent-red"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        )}

        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center mt-1 py-1.5 rounded-md text-text-muted hover:bg-bg-700/40 hover:text-text-primary"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
