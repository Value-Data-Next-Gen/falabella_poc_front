import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { api } from '../../api';
import { DotacionDiariaRow, DotacionEstado } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { BulkXlsxButtons } from '../shared/BulkXlsxButtons';

const ESTADOS: { value: DotacionEstado; label: string; tone: 'ok' | 'warn' | 'bad' }[] = [
  { value: 'disponible', label: 'Disponible',  tone: 'ok'   },
  { value: 'reemplazo',  label: 'Reemplazo',   tone: 'ok'   },
  { value: 'ausente',    label: 'Ausente',     tone: 'warn' },
  { value: 'licencia',   label: 'Licencia',    tone: 'warn' },
  { value: 'mantencion', label: 'Mantención',  tone: 'warn' },
  { value: 'baja',       label: 'Baja',        tone: 'bad'  },
];

const TONE_PILL: Record<'ok' | 'warn' | 'bad', string> = {
  ok:   'pill-green',
  warn: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40 border',
  bad:  'pill-red',
};

function todayISO(): string {
  // YYYY-MM-DD en Chile timezone (UTC-4 / UTC-3 según DST). Usamos local date.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface DotacionPanelProps {
  initialFecha?: string;
}

export function DotacionPanel({ initialFecha }: DotacionPanelProps = {}) {
  const { user, isFalabella } = useAuth();
  const qc = useQueryClient();

  const [fecha, setFecha] = useState(initialFecha ?? todayISO());
  const [empresaId, setEmpresaId] = useState<number | ''>(
    isFalabella ? '' : (user?.empresa_id ?? '')
  );
  const [onlyNoOperable, setOnlyNoOperable] = useState(false);

  const empresasQ = useQuery({
    queryKey: ['admin-empresas'],
    queryFn: api.admin.listEmpresas,
    enabled: isFalabella,
  });

  const dotacionQ = useQuery({
    queryKey: ['dotacion-diaria', fecha, empresaId],
    queryFn: () => api.admin.listDotacion({
      fecha,
      empresa_id: typeof empresaId === 'number' ? empresaId : undefined,
    }),
    enabled: isFalabella || empresaId !== '',
  });

  const upsertMut = useMutation({
    mutationFn: api.admin.upsertDotacion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dotacion-diaria', fecha, empresaId] }),
  });

  const rows = useMemo(() => {
    const data = dotacionQ.data ?? [];
    if (!onlyNoOperable) return data;
    return data.filter(r => r.estado !== 'disponible' && r.estado !== 'reemplazo');
  }, [dotacionQ.data, onlyNoOperable]);

  if (!isFalabella && user?.role !== 'transport_manager') {
    return (
      <div className="panel p-6 text-center text-text-muted">
        <ShieldAlert size={32} className="mx-auto mb-2 text-accent-yellow" />
        <div>Esta sección requiere rol falabella o transport_manager.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
              <Calendar size={16} /> Dotación del día
            </h2>
            <p className="text-xs text-text-muted mt-1">
              Marcá disponibilidad de drivers y vehículos para la operación del día.
              Las rutas con baja, ausencia o mantención se marcan como <strong>no operables</strong> en el plan.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Fecha</span>
              <input
                type="date"
                className="input !py-1 font-mono"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </label>
            {isFalabella && (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">Empresa</span>
                <select
                  className="input !py-1"
                  value={empresaId}
                  onChange={e => setEmpresaId(e.target.value === '' ? '' : Number(e.target.value))}
                >
                  <option value="">Todas</option>
                  {empresasQ.data?.map(em => (
                    <option key={em.empresa_id} value={em.empresa_id}>
                      #{em.empresa_id} — {em.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5 mt-4">
              <input
                type="checkbox"
                checked={onlyNoOperable}
                onChange={e => setOnlyNoOperable(e.target.checked)}
              />
              <span>Solo no operables</span>
            </label>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="panel">
        <div className="panel-title flex items-center justify-between">
          <span>{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</span>
          <div className="flex items-center gap-2">
            {dotacionQ.isFetching && (
              <span className="text-[10px] text-text-muted flex items-center gap-1">
                <Loader2 size={10} className="animate-spin" /> actualizando…
              </span>
            )}
            <BulkXlsxButtons
              downloadPath={`/admin/dotacion-diaria/template?fecha=${fecha}${typeof empresaId === 'number' ? `&empresa_id=${empresaId}` : ''}`}
              filename={`dotacion_${fecha}${typeof empresaId === 'number' ? `_emp${empresaId}` : ''}.xlsx`}
              uploadPath={`/admin/dotacion-diaria/upload?fecha=${fecha}`}
              onUploaded={() => qc.invalidateQueries({ queryKey: ['dotacion-diaria', fecha, empresaId] })}
            />
          </div>
        </div>
        {dotacionQ.isLoading ? (
          <div className="p-4 text-text-muted text-xs">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-text-muted text-xs">
            {onlyNoOperable
              ? 'No hay drivers con problemas para esta fecha.'
              : 'No hay drivers configurados para esta fecha/empresa.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-line">
              <tr className="text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-3 py-2 text-left">Vehículo</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Motivo</th>
                <th className="px-3 py-2 text-right">Última edición</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <DotacionRow
                  key={`${r.empresa_id}-${r.driver_id ?? r.vehicle_id}`}
                  row={r}
                  fecha={fecha}
                  saving={upsertMut.isPending}
                  onChange={(estado, motivo) =>
                    upsertMut.mutate({
                      fecha,
                      empresa_id: r.empresa_id,
                      driver_id: r.driver_id,
                      vehicle_id: r.vehicle_id,
                      estado,
                      motivo,
                    })
                  }
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface DotacionRowProps {
  row: DotacionDiariaRow;
  fecha: string;
  saving: boolean;
  onChange: (estado: DotacionEstado, motivo: string | null) => void;
}

function DotacionRow({ row, fecha, saving, onChange }: DotacionRowProps) {
  const [estado, setEstado] = useState<DotacionEstado>(row.estado);
  const [motivo, setMotivo] = useState(row.motivo ?? '');
  const [showSaved, setShowSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEstado(row.estado); }, [row.estado]);
  useEffect(() => { setMotivo(row.motivo ?? ''); }, [row.motivo]);
  useEffect(() => {
    if (!saving && (estado !== row.estado || motivo !== (row.motivo ?? ''))) {
      // viene de un guardado pendiente; mostrar checkmark efímero al sincronizar
    }
  }, [saving, estado, motivo, row]);

  const tone = ESTADOS.find(e => e.value === estado)?.tone ?? 'ok';

  const flushSaved = () => {
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 1500);
  };

  const onEstadoChange = (next: DotacionEstado) => {
    setEstado(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(next, motivo.trim() ? motivo.trim() : null);
    flushSaved();
  };

  const onMotivoBlur = () => {
    if (motivo === (row.motivo ?? '')) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onChange(estado, motivo.trim() ? motivo.trim() : null);
    flushSaved();
  };

  return (
    <tr className={`border-b border-line/50 ${tone === 'bad' || tone === 'warn' ? 'bg-bg-700/30' : ''}`}>
      <td className="px-3 py-2 text-text-secondary">
        <div className="font-medium">{row.empresa_nombre ?? `#${row.empresa_id}`}</div>
        <div className="text-[10px] text-text-muted">#{row.empresa_id}</div>
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold">{row.driver_name ?? '—'}</div>
        {row.driver_id && <div className="text-[10px] text-text-muted font-mono">{row.driver_id}</div>}
        {!row.driver_active && <span className="pill pill-red text-[9px]">inactivo</span>}
      </td>
      <td className="px-3 py-2">
        {row.vehicle_id ? (
          <>
            <div>{row.vehicle_name ?? `#${row.vehicle_id}`}</div>
            {row.plate && <div className="text-[10px] text-text-muted font-mono">{row.plate}</div>}
            {row.vehicle_id !== row.default_vehicle_id && row.default_vehicle_id != null && (
              <div className="text-[9px] text-accent-blue">reemplazo (default #{row.default_vehicle_id})</div>
            )}
          </>
        ) : (
          <span className="text-text-muted">sin asignar</span>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          className={`input !py-1 !text-[11px] pill ${TONE_PILL[tone]}`}
          value={estado}
          onChange={e => onEstadoChange(e.target.value as DotacionEstado)}
          disabled={saving}
        >
          {ESTADOS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <textarea
          className="input !py-1 !text-[11px] w-full"
          rows={1}
          maxLength={500}
          placeholder={estado === 'disponible' ? '— (opcional)' : 'Ej: Licencia médica hasta el viernes'}
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          onBlur={onMotivoBlur}
        />
      </td>
      <td className="px-3 py-2 text-right text-text-muted text-[10px]">
        <div className="flex items-center justify-end gap-1">
          {showSaved && <CheckCircle2 size={11} className="text-accent-green" />}
          {row.updated_at ? new Date(row.updated_at).toLocaleString('es-CL') : '—'}
        </div>
      </td>
    </tr>
  );
}
