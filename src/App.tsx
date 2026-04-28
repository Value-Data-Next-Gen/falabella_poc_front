import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  Database,
  Flame,
  LineChart,
  Map as MapIcon,
  Radio,
  Route,
  Settings,
  Truck,
} from 'lucide-react';
import { api } from './api';
import { Header } from './components/Header';
import { LoginPage } from './components/LoginPage';
import { Sidebar } from './components/Sidebar';
import { KPIBar } from './components/KPIBar';
import { OperationsMap } from './components/OperationsMap';
import { AlertsPanel } from './components/AlertsPanel';
import { VisitsTable } from './components/VisitsTable';
import { ModelPanel } from './components/ModelPanel';
import { VehiclesPanel } from './components/VehiclesPanel';
import { EventStream } from './components/EventStream';
import { MastersPanel } from './components/MastersPanel';
import { DayConfigPanel } from './components/DayConfigPanel';
import { LivePanel } from './components/LivePanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { PlanDiarioPanel } from './components/PlanDiarioPanel';
import { RouteOpsPanel } from './components/RouteOpsPanel';
import { SeguimientoPanel } from './components/SeguimientoPanel';
import { WatchlistPanel } from './components/WatchlistPanel';
import { useAuth } from './hooks/useAuth';

type Tab = 'config' | 'watchlist' | 'seguimiento' | 'plan' | 'route-ops' | 'live' | 'ops' | 'notif' | 'model' | 'fleet' | 'masters';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-900 text-text-muted text-sm">
        Cargando sesión…
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>('watchlist');
  const [selectedVehicles, setSelectedVehicles] = useState<number[]>([]);

  const stateQ = useQuery({
    queryKey: ['state'],
    queryFn: api.state,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (stateQ.data && selectedVehicles.length === 0) {
      setSelectedVehicles(stateQ.data.vehicles);
    }
  }, [stateQ.data]);

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'config', label: 'Inicio del día', icon: Settings },
    { key: 'watchlist', label: 'En riesgo', icon: Flame },
    { key: 'seguimiento', label: 'Seguimiento', icon: LineChart },
    { key: 'plan', label: 'Plan Diario', icon: CalendarClock },
    { key: 'route-ops', label: 'Operación de ruta', icon: Route },
    { key: 'live', label: 'En vivo', icon: Radio },
    { key: 'ops', label: 'Mapa ops', icon: Activity },
    { key: 'notif', label: 'Notificaciones', icon: Bell },
    { key: 'model', label: 'Modelo', icon: BarChart3 },
    { key: 'fleet', label: 'Flota', icon: Truck },
    { key: 'masters', label: 'Maestros', icon: Database },
  ];

  return (
    <div className="h-full flex flex-col bg-bg-900 text-text-primary">
      <Header state={stateQ.data} isLoading={stateQ.isLoading} isError={stateQ.isError} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          state={stateQ.data}
          selectedVehicles={selectedVehicles}
          onChangeVehicles={setSelectedVehicles}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex gap-1 px-4 pt-3 border-b border-line">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider rounded-t-md border-b-2 transition-colors ${
                  tab === key
                    ? 'border-brand text-brand bg-bg-800'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {tab === 'config' && <DayConfigPanel />}
            {tab === 'watchlist' && <WatchlistPanel />}
            {tab === 'seguimiento' && <SeguimientoPanel />}
            {tab === 'plan' && <PlanDiarioPanel />}
            {tab === 'route-ops' && <RouteOpsPanel />}
            {tab === 'live' && <LivePanel />}
            {tab === 'ops' && <div className="p-4"><OperationsView selectedVehicles={selectedVehicles} /></div>}
            {tab === 'notif' && <NotificationsPanel />}
            {tab === 'model' && <div className="p-4"><ModelPanel /></div>}
            {tab === 'fleet' && <div className="p-4"><VehiclesPanel /></div>}
            {tab === 'masters' && <div className="p-4"><MastersPanel /></div>}
          </div>
        </main>
      </div>
    </div>
  );
}

function OperationsView({ selectedVehicles }: { selectedVehicles: number[] }) {
  return (
    <div className="flex flex-col gap-4 min-h-full">
      <KPIBar selectedVehicles={selectedVehicles} />

      {/* Mapa + Alertas + Stream (3 columnas) */}
      <div className="grid grid-cols-12 gap-4" style={{ minHeight: 540 }}>
        <div className="col-span-7 panel flex flex-col">
          <div className="panel-title">
            <span className="flex items-center gap-2">
              <MapIcon size={14} /> Mapa operacional
            </span>
            <span className="text-text-muted normal-case tracking-normal">
              color = p(fallo) · borde violeta = alerta VD
            </span>
          </div>
          <div className="flex-1 min-h-[500px]">
            <OperationsMap selectedVehicles={selectedVehicles} />
          </div>
        </div>

        <div className="col-span-3 panel flex flex-col">
          <div className="panel-title">
            <span className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-accent-red" /> Alertas anticipadas
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <AlertsPanel />
          </div>
        </div>

        <div className="col-span-2 panel flex flex-col">
          <EventStream />
        </div>
      </div>

      <div className="panel flex flex-col">
        <div className="panel-title">
          <span>Detalle de visitas</span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: 400 }}>
          <VisitsTable selectedVehicles={selectedVehicles} />
        </div>
      </div>
    </div>
  );
}
