import { useEffect, useState } from 'react';
import { Sidebar, ModuleKey, MODULES } from './Sidebar';
import { Topbar } from './Topbar';
import { MaestrosModule } from '../modules/MaestrosModule';
import { PlanificacionModule } from '../modules/PlanificacionModule';
import { OperacionModuleV2 } from '../modules/OperacionModuleV2';
import { SeguimientoIAModule } from '../modules/SeguimientoIAModule';
import { AnaliticaModule } from '../modules/AnaliticaModule';
import { ConfiguracionSystemModule } from '../modules/ConfiguracionSystemModule';
import { OnboardingTour, shouldShowTour } from '../OnboardingTour';

interface NavState {
  module: ModuleKey;
  sub: string | null;
}

function readHash(): NavState {
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  if (!hash) return { module: 'operacion', sub: null };
  const [mod, sub] = hash.split('/');
  const valid = MODULES.find(m => m.key === mod)?.key ?? 'operacion';
  return { module: valid, sub: sub || null };
}

function writeHash(s: NavState): void {
  const h = s.sub ? `#/${s.module}/${s.sub}` : `#/${s.module}`;
  if (window.location.hash !== h) {
    window.history.replaceState(null, '', h);
  }
}

export function AppShell() {
  const [nav, setNav] = useState<NavState>(() => readHash());
  const [tourOpen, setTourOpen] = useState(false);

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

  // Pretty label for breadcrumb
  const subLabel = nav.sub
    ? nav.sub
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
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
          {nav.module === 'maestros' && <MaestrosModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'planificacion' && <PlanificacionModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'operacion' && <OperacionModuleV2 sub={nav.sub} setSub={setSub} />}
          {nav.module === 'seguimiento_ia' && <SeguimientoIAModule sub={nav.sub} setSub={setSub} />}
          {nav.module === 'analitica' && <AnaliticaModule sub={nav.sub} setSub={setSub} />}
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
