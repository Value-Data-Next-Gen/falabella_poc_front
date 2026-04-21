import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  Filter,
  Pause,
  Play,
  RefreshCcw,
  Rewind,
  FastForward,
} from 'lucide-react';
import { api } from '../api';
import { AppState } from '../types';

export function Sidebar({
  state,
  selectedVehicles,
  onChangeVehicles,
}: {
  state: AppState | undefined;
  selectedVehicles: number[];
  onChangeVehicles: (v: number[]) => void;
}) {
  const qc = useQueryClient();
  const refetchAll = () => qc.invalidateQueries();

  const incidentMut = useMutation({
    mutationFn: ({ v, m }: { v: number; m: number }) => api.postIncident(v, m),
    onSuccess: refetchAll,
  });

  const resetMut = useMutation({
    mutationFn: api.postReset,
    onSuccess: refetchAll,
  });

  const clockMut = useMutation({
    mutationFn: api.postClock,
    onSuccess: refetchAll,
  });

  const [incVehicle, setIncVehicle] = useState<number>(1);
  const [incMin, setIncMin] = useState<number>(30);

  const allVehicles = state?.vehicles ?? [];
  const incidents = state?.incidents ?? {};

  const toggleVehicle = (v: number) => {
    if (selectedVehicles.includes(v)) {
      onChangeVehicles(selectedVehicles.filter(x => x !== v));
    } else {
      onChangeVehicles([...selectedVehicles, v].sort((a, b) => a - b));
    }
  };

  const allSelected = selectedVehicles.length === allVehicles.length;

  return (
    <aside className="w-64 border-r border-line bg-bg-800 overflow-y-auto flex flex-col">
      {/* Reloj controles */}
      <section className="p-3 border-b border-line">
        <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
          Reloj simulado
        </h3>
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => clockMut.mutate({ offset_minutes: -30 })}
            className="btn flex-1 flex items-center justify-center gap-1"
          >
            <Rewind size={12} /> -30m
          </button>
          <button
            onClick={() =>
              clockMut.mutate({ auto_advance: !(state?.auto_advance ?? true) })
            }
            className={state?.auto_advance ? 'btn-danger flex-1' : 'btn-primary flex-1'}
            title={state?.auto_advance ? 'Pausar' : 'Reanudar'}
          >
            {state?.auto_advance ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            onClick={() => clockMut.mutate({ offset_minutes: 30 })}
            className="btn flex-1 flex items-center justify-center gap-1"
          >
            +30m <FastForward size={12} />
          </button>
        </div>
        <div className="text-[10px] text-text-muted">
          Auto-advance: {state?.auto_advance ? 'ON' : 'OFF'} · {state?.sim_minutes_per_tick}min/tick
        </div>
      </section>

      {/* Incidente */}
      <section className="p-3 border-b border-line">
        <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1">
          <AlertOctagon size={12} className="text-accent-yellow" /> Simular incidente
        </h3>
        <div className="flex flex-col gap-2">
          <select
            className="input"
            value={incVehicle}
            onChange={e => setIncVehicle(Number(e.target.value))}
          >
            {allVehicles.map(v => (
              <option key={v} value={v}>
                FAL-{1000 + v - 1}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="input"
            value={incMin}
            min={5}
            max={120}
            step={5}
            onChange={e => setIncMin(Number(e.target.value))}
          />
          <button
            onClick={() => incidentMut.mutate({ v: incVehicle, m: incMin })}
            className="btn-primary"
            disabled={incidentMut.isPending}
          >
            {incidentMut.isPending ? 'Aplicando...' : `Aplicar +${incMin}min`}
          </button>
        </div>

        {Object.keys(incidents).length > 0 && (
          <div className="mt-2 text-[11px] space-y-1">
            <div className="text-text-muted">Activos:</div>
            {Object.entries(incidents).map(([vid, m]) => (
              <div key={vid} className="flex justify-between text-accent-yellow">
                <span>FAL-{1000 + Number(vid) - 1}</span>
                <span>+{Math.round(m)}min</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reset */}
      <section className="p-3 border-b border-line">
        <button
          onClick={() => resetMut.mutate()}
          className="btn w-full flex items-center justify-center gap-2"
          disabled={resetMut.isPending}
        >
          <RefreshCcw size={12} /> Reiniciar día
        </button>
      </section>

      {/* Filtro vehiculos */}
      <section className="p-3 border-b border-line flex-1">
        <h3 className="text-[10px] uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Filter size={12} /> Filtrar vehículos
          </span>
          <button
            className="text-accent-blue hover:underline normal-case tracking-normal"
            onClick={() =>
              onChangeVehicles(allSelected ? [] : allVehicles.slice())
            }
          >
            {allSelected ? 'Ninguno' : 'Todos'}
          </button>
        </h3>
        <div className="flex flex-col gap-1">
          {allVehicles.map(v => {
            const selected = selectedVehicles.includes(v);
            const hasIncident = !!incidents[v.toString()];
            return (
              <label
                key={v}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs ${
                  selected ? 'bg-bg-700' : 'hover:bg-bg-700/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleVehicle(v)}
                  className="accent-accent-blue"
                />
                <span className="flex-1">FAL-{1000 + v - 1}</span>
                {hasIncident && (
                  <span className="pill pill-yellow text-[9px] px-1">
                    +{Math.round(incidents[v.toString()])}m
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      <section className="p-3 text-[10px] text-text-muted border-t border-line">
        Día sintético {state?.day_seed ?? 0} · {state?.total_visits ?? 0} visitas ·{' '}
        {allVehicles.length} vehículos
      </section>
    </aside>
  );
}
