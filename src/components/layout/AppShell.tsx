import { useEffect, useState } from 'react';
import { Sidebar, ModuleKey, MODULES } from './Sidebar';
import { Topbar } from './Topbar';
import { OnboardingModule } from '../modules/OnboardingModule';
import { PlanificacionModule } from '../modules/PlanificacionModule';
import { OperacionModuleV2 } from '../modules/OperacionModuleV2';
import { SeguimientoIAModule } from '../modules/SeguimientoIAModule';
import { AnaliticaModule } from '../modules/AnaliticaModule';
import { ConfiguracionSystemModule } from '../modules/ConfiguracionSystemModule';
import { DriverDashboardPage } from '../pages/DriverDashboardPage';
import { OnboardingTour, shouldShowTour } from '../OnboardingTour';
import { useAuth } from '../../hooks/useAuth';

interface NavState {
  module: ModuleKey;
  sub: string | null;
}

// Redirects de rutas legacy → nuevas. Mantener acá hasta migrar links externos.
const LEGACY_MODULE_REDIRECTS: Record<string, ModuleKey> = {
  maestros: 'onboarding',
  seguimiento_ia: 'seguimiento-ia',
  analitica: 'control',
};

function readHash(): NavState {
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  if (!hash) return { module: 'operacion', sub: null };
  const slash = hash.indexOf('/');
  const modRaw = slash === -1 ? hash : hash.slice(0, slash);
  const mod = LEGACY_MODULE_REDIRECTS[modRaw] ?? modRaw;
  const sub = slash === -1 ? null : (hash.slice(slash + 1) || null);
  const valid = MODULES.find(m => m.key === mod)?.key ?? 'operacion';
  if (modRaw !== mod) {
    const h = sub ? `#/${valid}/${sub}` : `#/${valid}`;
    window.history.replaceState(null, '', h);
  }
  return { module: valid, sub };
}

function writeHash(s: NavState): void {
  const h = s.sub ? `#/${s.module}/${s.sub}` : `#/${s.module}`;
  if (window.location.hash !== h) {
    window.history.replaceState(null, '', h);
  }
}

export function AppShell() {
  const { isDriver } = useAuth();
  const [nav, setNav] = useState<NavState>(() => readHash());
  const [tourOpen, setTourOpen] = useState(false);

  // El rol driver tiene su propio dashboard sin sidebar/topbar/tour.
  if (isDriver) {
    return (
      <div className="h-full bg-bg-900 text-text-primary">
        <DriverDashboardPage />
      </div>
    );
  }

  // Mostrar tour la primera vez (post-login)
  useEffect(() => {
    if (shouldShowTour()) {
      const t = setTimeout(() => setTourOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Sync hash → state on hashchange
  useEffect(() => {
    const onHash = () => setNav(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Sync state → hash
  useEffect(() => {
    writeHash(nav);
  }, [nav]);

  const navigate = (module: ModuleKey, sub?: string) => {
    setNav({ module, sub: sub ?? null });
  };

  const setSub = (sub: string) => setNav(prev => ({ ...prev, sub }));

  // Pretty label for breadcrumb. Mapeo central de slug → label legible.
  // Si el slug no está acá, fallback a capitalizar el slug reemplazando '-' y '_'.
  const SUB_LABELS: Record<string, string> = {
    // Onboarding
    empresas: 'Empresas',
    vips: 'Clientes VIP',
    usuarios: 'Usuarios',
    motivos: 'Catálogo de motivos',
    drivers: 'Drivers',
    // Planificación
    dia: 'Día operativo',
    calendario: 'Calendario',
    carga: 'Carga de entregas',
    dotacion: 'Dotación',
    plan: 'Plan del día',
    clientes: 'Clientes del día',
    configdia: 'Config del día',
    // Operación
    watchlist: 'Watchlist',
    mapa: 'Mapa',
    alertas: 'Alertas en vivo',
    // Seguimiento IA
    comentarios: 'Alertas IA',
    asistente: 'Asistente IA',
    correcciones: 'Correcciones de motivo',
    // Control
    kpis: 'KPIs',
    'scorecard-drivers': 'Scorecard de drivers',
    'log-notificaciones': 'Log de notificaciones',
    'modelo-xgb': 'Modelo XGB',
  };
  const subLabel = nav.sub
    ? (SUB_LABELS[nav.sub] ?? nav.sub
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()))
    : null;

  return (
    <div className="h-full flex bg-bg-900 text-text-primary">
      <Sidebar current={nav.module} onChange={k => navigate(k)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          moduleKey={nav.module}
          subTab={subLabel}
          onNavigate={navigate}
          onOpenTour={() => setTourOpen(true)}
        />
        <main className="flex-1 overflow-hidden">
          {nav.module === 'onboarding' && <OnboardingModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'planificacion' && <PlanificacionModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'operacion' && <OperacionModuleV2 sub={nav.sub} setSub={setSub} />}
          {nav.module === 'seguimiento-ia' && <SeguimientoIAModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'control' && <AnaliticaModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'configuracion' && <ConfiguracionSystemModule sub={nav.sub} setSub={setSub} />}
        </main>
      </div>
      <OnboardingTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onNavigate={(module, sub) => navigate(module as ModuleKey, sub)}
      />
    </div>
  );
}
