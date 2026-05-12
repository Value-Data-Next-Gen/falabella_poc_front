import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Crown, Loader2, MapPin, MessageSquare, Pencil, Route as RouteIcon,
  Save, Search, Star, X,
} from 'lucide-react';
import { api } from '../../api';

interface Props { fecha: string; }

export function ClientesDelDiaPanel({ fecha }: Props) {
  const qc = useQueryClient();
  const [onlyNoVip, setOnlyNoVip] = useState(false);
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [search, setSearch] = useState('');

  const q = useQuery({
    queryKey: ['clientes-del-dia', fecha, onlyNoVip, onlyWithNotes],
    queryFn: () => api.planificacion.clientesDelDia(fecha, {
      only_no_vip: onlyNoVip, only_with_notes: onlyWithNotes,
    }),
    refetchInterval: 30_000,
  });

  const items = (q.data ?? []).filter(c =>
    !search.trim() || c.cliente.toLowerCase().includes(search.toLowerCase())
  );

  const totalVip = (q.data ?? []).filter(c => c.is_vip).length;
  const totalWithNotes = (q.data ?? []).filter(c => c.notes).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Clientes del día</h2>
            <div className="text-[11px] text-text-muted mt-0.5">
              Todos los clientes únicos de la jornada {fecha}. Marca VIPs e ingresa notas específicas.
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="pill bg-bg-700 text-text-secondary border border-line">
              {q.data?.length ?? 0} clientes
            </span>
            <span className="pill bg-cmr/15 text-cmr border border-cmr/40">
              <Crown size={9} className="inline mr-1" /> {totalVip} VIP
            </span>
            <span className="pill bg-accent-blue/15 text-accent-blue border border-accent-blue/40">
              <MessageSquare size={9} className="inline mr-1" /> {totalWithNotes} con notas
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)}
                   placeholder="Buscar cliente…"
                   className="input pl-7 text-[12px] w-full" />
          </div>
          <label className="text-[11px] flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={onlyNoVip} onChange={e => setOnlyNoVip(e.target.checked)} />
            Solo no-VIP
          </label>
          <label className="text-[11px] flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={onlyWithNotes} onChange={e => setOnlyWithNotes(e.target.checked)} />
            Solo con notas
          </label>
        </div>
      </div>

      <div className="panel">
        {q.isLoading ? (
          <div className="p-6 text-text-muted text-[12px] flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" /> Cargando…
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-text-muted text-[12px]">
            Sin clientes para los filtros actuales.
          </div>
        ) : (
          <div className="divide-y divide-line/40">
            {items.map(c => (
              <ClienteRow key={c.cliente} c={c} fecha={fecha} onChange={() => {
                qc.invalidateQueries({ queryKey: ['clientes-del-dia', fecha] });
                qc.invalidateQueries({ queryKey: ['day-prep', fecha] });
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ClienteRow = NonNullable<ReturnType<typeof api.planificacion.clientesDelDia> extends Promise<infer T> ? T : never>[number];

function ClienteRow({ c, fecha, onChange }: {
  c: ClienteRow; fecha: string; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(c.notes ?? '');
  const [tier, setTier] = useState(c.vip_tier ?? 'VIP');

  const mut = useMutation({
    mutationFn: (req: Parameters<typeof api.planificacion.upsertClientDayNote>[0]) =>
      api.planificacion.upsertClientDayNote(req),
    onSuccess: () => { setEditing(false); onChange(); },
  });

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[13px]">{c.cliente}</span>
            {c.is_vip && (
              <span className="pill bg-cmr/15 text-cmr border border-cmr/40 flex items-center gap-0.5">
                <Crown size={10} /> {c.vip_tier ?? 'VIP'}
              </span>
            )}
            <span className="pill bg-bg-700 text-text-muted border border-line text-[10px]">
              {c.visitas} visita{c.visitas === 1 ? '' : 's'}
            </span>
            {c.priority_set_count > 0 && (
              <span className="pill bg-accent-yellow/15 text-accent-yellow border border-accent-yellow/40 text-[10px]">
                ▲ {c.priority_set_count} con prioridad
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-3 flex-wrap">
            {c.comunas.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {c.comunas.slice(0, 3).join(', ')}
                {c.comunas.length > 3 && ` +${c.comunas.length - 3}`}
              </span>
            )}
            {c.rutas.length > 0 && (
              <span className="flex items-center gap-1 font-mono">
                <RouteIcon size={10} /> {c.rutas.slice(0, 2).join(', ')}
                {c.rutas.length > 2 && ` +${c.rutas.length - 2}`}
              </span>
            )}
          </div>
          {c.notes && !editing && (
            <div className="text-[11px] text-text-secondary italic mt-1.5 bg-accent-blue/5 border-l-2 border-accent-blue/40 pl-2 py-1">
              {c.notes}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!c.is_vip && !editing && (
            <button
              onClick={() => mut.mutate({
                fecha, cliente: c.cliente,
                create_vip: true, vip_marked_here: true, vip_tier: 'VIP',
              })}
              disabled={mut.isPending}
              className="text-[10px] text-cmr hover:underline flex items-center gap-1"
              title="Marcar como VIP global"
            >
              <Star size={10} /> Marcar VIP
            </button>
          )}
          {!editing && (
            <button
              onClick={() => { setNotesDraft(c.notes ?? ''); setEditing(true); }}
              className="text-[10px] text-text-secondary hover:text-text-primary flex items-center gap-1"
              title="Editar notas del día"
            >
              <Pencil size={10} /> {c.notes ? 'Editar' : 'Nota'}
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2 flex flex-col gap-2 bg-bg-700/30 rounded p-2">
          <textarea
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            placeholder="Notas específicas de este día (ej. 'cliente solicitó entrega temprano antes 11am')"
            rows={2}
            maxLength={1000}
            className="input text-[11px]"
            autoFocus
          />
          {c.is_vip && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-text-muted">Tier VIP:</span>
              {(['VIP', 'PREMIUM', 'CRITICAL'] as const).map(t => (
                <button key={t} onClick={() => setTier(t)}
                        className={`px-2 py-0.5 rounded border ${
                          tier === t ? 'bg-cmr/20 text-cmr border-cmr/40' : 'border-line text-text-secondary'
                        }`}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setEditing(false)}
                    className="btn !py-1 text-[10px] flex items-center gap-1">
              <X size={10} /> Cancelar
            </button>
            <button
              disabled={mut.isPending}
              onClick={() => mut.mutate({
                fecha, cliente: c.cliente,
                notes: notesDraft.trim() || null,
                vip_marked_here: c.is_vip,
                vip_tier: c.is_vip ? tier : undefined,
              })}
              className="btn-primary !py-1 text-[10px] flex items-center gap-1">
              {mut.isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
