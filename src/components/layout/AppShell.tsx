import { useEffect, useState } from 'react';
import { Sidebar, ModuleKey, MODULES } from './Sidebar';
import { Topbar } from './Topbar';
import { OnboardingModule } from '../modules/OnboardingModule';
import { PlanificacionModule } from '../modules/PlanificacionModule';
import { OperacionModuleV2 } from '../modules/OperacionModuleV2';
import { SeguimientoIAModule } from '../modules/SeguimientoIAModule';
import { AnaliticaModule } from '../modules/AnaliticaModule';
import { IAModule } from '../modules/IAModule';
import { ConfiguracionSystemModule } from '../modules/ConfiguracionSystemModule';
import { DriverDashboardPage } from '../pages/DriverDashboardPage';
import { OnboardingTour, shouldShowTour } from '../OnboardingTour';
import { useAuth } from '../../hooks/useAuth';
import { AgentDock } from '../AgentDock';
import { DiaActivoProvider } from '../../hooks/useDiaActivo';

interface NavState {
  module: ModuleKey;
  sub: string | null;
}

// Redirects de rutas legacy → nuevas. Mantener acá hasta migrar links externos.
const LEGACY_MODULE_REDIRECTS: Record<string, ModuleKey> = {
  maestros: 'onboarding',
  seguimiento_ia: 'auditoria-ia',
  'seguimiento-ia': 'auditoria-ia',  // R2 → R3
  analitica: 'control',
};

function readHash(): NavState {
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  if (!hash) return { module: 'operacion', sub: null };
  const slash = hash.indexOf('/');
  const modRaw = slash === -1 ? hash : hash.slice(0, slash);
  let mod = LEGACY_MODULE_REDIRECTS[modRaw] ?? modRaw;
  let sub = slash === -1 ? null : (hash.slice(slash + 1) || null);
  // R7: Copiloto operativo se movió de Auditoría IA → Operación.
  if (mod === 'auditoria-ia' && (sub === 'copiloto' || sub === 'asistente')) {
    mod = 'operacion';
    sub = 'copiloto';
  }
  const valid = MODULES.find(m => m.key === mod)?.key ?? 'operacion';
  if (modRaw !== mod || (slash !== -1 && sub !== hash.slice(slash + 1))) {
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
    // Planificación. En Ronda 3 todos los slugs legacy (carga/dotacion/plan/
    // clientes/configdia) caen dentro de la tab 'Día operativo' como cards.
    dia: 'Día operativo',
    calendario: 'Calendario',
    carga: 'Día operativo',
    dotacion: 'Día operativo',
    plan: 'Día operativo',
    clientes: 'Día operativo',
    configdia: 'Día operativo',
    // Operación (R3: 2 tabs; plan/watchlist viven como drawers dentro de mapa)
    watchlist: 'Mapa',
    mapa: 'Mapa',
    alertas: 'Alertas en vivo',
    // Auditoría IA
    comentarios: 'Alertas IA',
    correcciones: 'Correcciones de motivo',
    // Operación
    copiloto: 'Copiloto operativo',
    asistente: 'Copiloto operativo',
    // Control
    kpis: 'KPIs',
    visitas: 'Tabla de visitas',
    'scorecard-drivers': 'Scorecard de drivers',
    'log-notificaciones': 'Log de notificaciones',
    log: 'Log de notificaciones',
    // IA / Modelo
    modelo: 'Modelo XGB',
    'modelo-xgb': 'Modelo XGB',
  };
  const subLabel = nav.sub
    ? (SUB_LABELS[nav.sub] ?? nav.sub
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase()))
    : null;

  return (
    <DiaActivoProvider>
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
          {nav.module === 'auditoria-ia' && <SeguimientoIAModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'control' && <AnaliticaModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'ia' && <IAModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'configuracion' && <ConfiguracionSystemModule sub={nav.sub} setSub={setSub} />}
        </main>
      </div>
      <OnboardingTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        onNavigate={(module, sub) => navigate(module as ModuleKey, sub)}
      />
      <AgentDock />
    </div>
    </DiaActivoProvider>
  );
}
