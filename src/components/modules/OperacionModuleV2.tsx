import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Flame, Map as MapIcon,
  Radio, Star, Truck, XCircle,
} from 'lucide-react';
import { api } from '../../api';
import { RegionFilter } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { SubTabs, SubTabDef } from '../layout/SubTabs';
import { PlanDiarioPanel } from '../PlanDiarioPanel';
import { WatchlistPanel } from '../WatchlistPanel';
import { OperationsMap } from '../OperationsMap';
import { EventStream } from '../EventStream';

const SUBS: Record<string, true> = { plan: true, watchlist: true, mapa: true, alertas: true };

export function OperacionModuleV2({ sub, setSub }: { sub: string | null; setSub: (s: string) => void }) {
  const { isFalabella } = useAuth();
  const active = sub && SUBS[sub] ? sub : 'plan';

  const [region, setRegion] = useState<RegionFilter>('all');
  const [empresaId, setEmpresaId] = useState<number | 'all'>('all');
  const [onlyVip, setOnlyVip] = useState(false);

  const empresasQ = useQuery({
    queryKey: ['empresas-contactos-empresas-list'],
    queryFn: api.empresaContactos.listEmpresas,
    enabled: isFalabella,
  });

  const planQ = useQuery({
    queryKey: ['plan-diario-mod-kpi-v2', empresaId, region, onlyVip],
    queryFn: () => api.planDiario({
      empresa_id: empresaId === 'all' ? undefined : empresaId,
      region,
      only_vip: onlyVip,
    }),
    refetchInterval: 10_000,
  });

  const totals = (() => {
    const empresas = planQ.data?.empresas ?? [];
    const total = empresas.reduce((s, e) => s + e.total_visitas, 0);
    const completadas = empresas.reduce((s, e) => s + e.completadas, 0);
    const fallidas = empresas.reduce((s, e) => s + e.fallidas, 0);
    const enRiesgo = empresas.reduce((s, e) => s + e.en_riesgo, 0);
    const cumplPct = total ? (completadas / total) * 100 : 0;
    return { total, completadas, fallidas, enRiesgo, cumplPct };
  })();

  const tabs: SubTabDef[] = [
    { key: 'plan',      label: 'Plan en ejecución', icon: CalendarClock },
    { key: 'watchlist', label: 'Watchlist',         icon: Flame },
    { key: 'mapa',      label: 'Mapa',              icon: MapIcon },
    { key: 'alertas',   label: 'Alertas en vivo',   icon: Radio },
  ];

  const filterProps = { region, onlyVip, empresaId, hideLocalFilters: true };

  return (
    <div className="h-full flex flex-col">
      {/* Filtros globales */}
      <div className="border-b border-line/60 bg-bg-800/50">
        <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-text-muted uppercase tracking-wider text-[10px] mr-2">Filtros</span>

          <select
            value={region}
            onChange={e => setRegion(e.target.value as RegionFilter)}
            className="input text-[11px] py-1"
            title="Filtrar por región"
          >
            <option value="all">Todas las regiones</option>
            <option value="RM">Región Metropolitana</option>
            <option value="regiones">Todas excepto RM</option>
            <option disabled>──────────</option>
            <option value="Valparaíso">Valparaíso</option>
            <option value="Biobío">Biobío</option>
            <option value="Coquimbo">Coquimbo</option>
            <option value="Maule">Maule</option>
            <option value="Araucanía">Araucanía</option>
            <option value="O'Higgins">O'Higgins</option>
            <option value="Antofagasta">Antofagasta</option>
          </select>

          {isFalabella && (
            <select
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="input text-[11px] py-1"
            >
              <option value="all">Todas las empresas</option>
              {empresasQ.data?.map(e => (
                <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyVip}
              onChange={e => setOnlyVip(e.target.checked)}
              className="accent-cmr"
            />
            <Star size={11} className="text-cmr" />
            <span>Solo VIP</span>
          </label>

          <span className="ml-auto text-text-muted">
            {planQ.data?.planned_date && <>Día <span className="text-text-secondary tabular-nums">{planQ.data.planned_date}</span></>}
          </span>
        </div>

        <div className="px-4 pb-3 flex items-center gap-4 text-[11px]">
          <KpiInline label="Visitas" value={totals.total} icon={Truck} color="text-text-primary" />
          <KpiInline label="OK" value={totals.completadas} icon={CheckCircle2} color="text-brand" />
          <KpiInline label="Fallidas" value={totals.fallidas} icon={XCircle} color="text-accent-red" />
          <KpiInline label="En riesgo" value={totals.enRiesgo} icon={AlertTriangle} color="text-accent-yellow" />
          <KpiInline
            label="% cumpl."
            value={`${totals.cumplPct.toFixed(0)}%`}
            icon={Flame}
            color={totals.cumplPct >= 90 ? 'text-brand' : totals.cumplPct >= 75 ? 'text-accent-yellow' : 'text-accent-red'}
          />
        </div>
      </div>

      <SubTabs tabs={tabs} active={active} onChange={setSub} />

      <div className="flex-1 overflow-auto">
        {active === 'plan' && <PlanDiarioPanel filters={filterProps} mode="live" />}
        {active === 'watchlist' && <WatchlistPanel filters={filterProps} />}
        {active === 'mapa' && <MapaTab />}
        {active === 'alertas' && <div className="h-full"><EventStream /></div>}
      </div>
    </div>
  );
}

function KpiInline({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: any; color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={12} className={color} />
      <span className="text-text-muted text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function MapaTab() {
  const stateQ = useQuery({ queryKey: ['state'], queryFn: api.state, refetchInterval: 5_000 });
  const allVehicles = stateQ.data?.vehicles ?? [];
  return (
    <div className="p-3 h-full flex flex-col">
      <div className="panel flex-1 flex flex-col">
        <div className="panel-title">
          <span>Mapa operacional</span>
          <span className="text-text-muted normal-case tracking-normal text-[11px]">
            color = p(fallo) · borde violeta = alerta VD
          </span>
        </div>
        <div className="flex-1 min-h-[500px]">
          <OperationsMap selectedVehicles={allVehicles} />
        </div>
      </div>
    </div>
  );
}
