import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Ban, Clock, Loader2, MessageSquare, Save, Settings, X,
} from 'lucide-react';
import { api } from '../../api';

interface Props { fecha: string; }

export function ConfigDelDiaPanel({ fecha }: Props) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['day-config', fecha],
    queryFn: () => api.planificacion.getDayConfig(fecha),
  });

  const empresasQ = useQuery({
    queryKey: ['admin-empresas-day-config'],
    queryFn: api.admin.listEmpresas,
  });
  const vehiclesQ = useQuery({
    queryKey: ['admin-vehicles-day-config'],
    queryFn: api.admin.listVehicles,
  });

  const [cutoff, setCutoff] = useState('');
  const [msg, setMsg] = useState('');
  const [threshold, setThreshold] = useState<string>('');
  const [slack, setSlack] = useState<string>('');
  const [restrictedVeh, setRestrictedVeh] = useState<Set<number>>(new Set());
  const [restrictedEmp, setRestrictedEmp] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (q.data) {
      setCutoff(q.data.cutoff_time?.slice(0, 5) ?? '');
      setMsg(q.data.message_to_drivers ?? '');
      setThreshold(q.data.alert_threshold_override?.toString() ?? '');
      setSlack(q.data.slack_min_override?.toString() ?? '');
      setRestrictedVeh(new Set(q.data.restricted_vehicle_ids ?? []));
      setRestrictedEmp(new Set(q.data.restricted_empresa_ids ?? []));
    }
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => api.planificacion.putDayConfig(fecha, {
      cutoff_time: cutoff || null,
      message_to_drivers: msg || null,
      alert_threshold_override: threshold ? parseFloat(threshold) : null,
      slack_min_override: slack ? parseInt(slack, 10) : null,
      restricted_vehicle_ids: Array.from(restrictedVeh),
      restricted_empresa_ids: Array.from(restrictedEmp),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-config', fecha] });
    },
  });

  if (q.isLoading) {
    return <div className="panel p-6 text-text-muted text-[12px] flex items-center gap-2">
      <Loader2 size={12} className="animate-spin" /> Cargando…
    </div>;
  }

  const dirty = !!q.data && (
    (cutoff || null) !== (q.data.cutoff_time?.slice(0, 5) || null) ||
    (msg || null) !== (q.data.message_to_drivers || null) ||
    (threshold ? parseFloat(threshold) : null) !== q.data.alert_threshold_override ||
    (slack ? parseInt(slack, 10) : null) !== q.data.slack_min_override ||
    JSON.stringify(Array.from(restrictedVeh).sort()) !== JSON.stringify((q.data.restricted_vehicle_ids ?? []).sort()) ||
    JSON.stringify(Array.from(restrictedEmp).sort()) !== JSON.stringify((q.data.restricted_empresa_ids ?? []).sort())
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
              <Settings size={14} /> Configuración del día
            </h2>
            <div className="text-[11px] text-text-muted mt-0.5">
              Overrides específicos para {fecha}. Si están vacíos se usan los valores globales.
            </div>
          </div>
          {q.data?.updated_at && (
            <div className="text-[10px] text-text-muted">
              Última edición: {q.data.updated_at.slice(0, 16).replace('T', ' ')}
            </div>
          )}
        </div>
      </div>

      {/* Cutoff + mensaje */}
      <div className="panel p-4 flex flex-col gap-4">
        <Field label="Horario de cierre del día" icon={Clock}
               hint="Visitas pendientes después de esta hora se marcan como failed (cron pendiente).">
          <input type="time" value={cutoff} onChange={e => setCutoff(e.target.value)}
                 className="input text-[12px] w-32 font-mono" />
        </Field>

        <Field label="Mensaje del día para drivers" icon={MessageSquare}
               hint="Texto que el agente WhatsApp inyecta al saludo de los conductores cuando se conectan hoy.">
          <textarea value={msg} onChange={e => setMsg(e.target.value)}
                    rows={3} maxLength={500}
                    placeholder="Ej. 'Hoy hay corte de luz en Vitacura desde las 14h, evitar entregas en esa comuna después de esa hora.'"
                    className="input text-[12px] w-full" />
          <div className="text-[10px] text-text-muted">{msg.length} / 500</div>
        </Field>
      </div>

      {/* Umbrales */}
      <div className="panel p-4 flex flex-col gap-3">
        <div className="text-[12px] font-semibold flex items-center gap-2">
          <AlertTriangle size={12} /> Umbrales de alerta (override)
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="P(fallo) crítico" hint="Umbral para considerar visita en riesgo (default 0.7). Rango 0–1.">
            <input type="number" step="0.05" min={0} max={1}
                   value={threshold} onChange={e => setThreshold(e.target.value)}
                   placeholder="default 0.7"
                   className="input text-[12px] w-28 font-mono" />
          </Field>
          <Field label="Slack mínimo (min)" hint="Default 15. Cuando el slack baja de este número, se alerta.">
            <input type="number" step={1} min={0} max={240}
                   value={slack} onChange={e => setSlack(e.target.value)}
                   placeholder="default 15"
                   className="input text-[12px] w-28 font-mono" />
          </Field>
        </div>
      </div>

      {/* Restricciones */}
      <div className="panel p-4 flex flex-col gap-3">
        <div className="text-[12px] font-semibold flex items-center gap-2">
          <Ban size={12} /> Restricciones del día
        </div>
        <Field label="Empresas NO operativas hoy"
               hint="Sus visitas se marcarán como afectadas en el Plan del día.">
          <MultiSelect
            options={(empresasQ.data ?? []).map(e => ({ id: e.empresa_id, label: e.nombre }))}
            selected={restrictedEmp}
            onChange={setRestrictedEmp}
          />
        </Field>
        <Field label="Vehículos NO operativos hoy"
               hint="Útil para mantenimiento programado, paros, etc.">
          <MultiSelect
            options={(vehiclesQ.data ?? []).map(v => ({ id: v.vehicle_id, label: `${v.plate ?? '—'} (${v.name ?? '—'})` }))}
            selected={restrictedVeh}
            onChange={setRestrictedVeh}
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-bg-900/95 p-2 -mx-2 border-t border-line">
        {dirty && (
          <span className="text-[11px] text-accent-yellow flex items-center gap-1 mr-2">
            <AlertTriangle size={11} /> hay cambios sin guardar
          </span>
        )}
        {mut.error && (
          <span className="text-[10px] text-accent-red">{(mut.error as Error).message}</span>
        )}
        <button disabled={!dirty || mut.isPending}
                onClick={() => mut.mutate()}
                className="btn-primary text-[12px] flex items-center gap-1">
          {mut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Guardar configuración
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, icon: Icon, children }: {
  label: string; hint?: string; icon?: any; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] font-medium uppercase tracking-wider text-text-secondary flex items-center gap-1">
        {Icon && <Icon size={11} />} {label}
      </div>
      {hint && <div className="text-[10px] text-text-muted">{hint}</div>}
      {children}
    </div>
  );
}

function MultiSelect({ options, selected, onChange }: {
  options: { id: number; label: string }[];
  selected: Set<number>;
  onChange: (s: Set<number>) => void;
}) {
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto border border-line/40 rounded p-2 bg-bg-700/20">
      {options.length === 0 && <span className="text-[10px] text-text-muted italic">sin opciones</span>}
      {options.map(o => {
        const on = selected.has(o.id);
        return (
          <button key={o.id} onClick={() => toggle(o.id)}
                  className={`px-2 py-0.5 rounded text-[10px] border ${
                    on
                      ? 'bg-accent-red/15 text-accent-red border-accent-red/40'
                      : 'bg-bg-700 text-text-secondary border-line hover:border-text-muted'
                  }`}>
            {on && <X size={9} className="inline mr-0.5" />} {o.label}
          </button>
        );
      })}
    </div>
  );
}
