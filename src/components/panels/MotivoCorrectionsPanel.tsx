import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Bot, Check, ClipboardX, Inbox, Loader2, Sparkles, Truck, X,
} from 'lucide-react';
import { api } from '../../api';
import { CorrectionStatus, MotivoCorrection } from '../../types';

const STATUS_TABS: { key: CorrectionStatus | 'all'; label: string }[] = [
  { key: 'pending',  label: 'Pendientes' },
  { key: 'accepted', label: 'Aceptadas' },
  { key: 'rejected', label: 'Rechazadas' },
  { key: 'no_action', label: 'Archivadas' },
  { key: 'all',      label: 'Todas' },
];

export function MotivoCorrectionsPanel() {
  const [status, setStatus] = useState<CorrectionStatus | 'all'>('pending');
  const qc = useQueryClient();

  const listQ = useQuery({
    queryKey: ['motivo-corrections', status],
    queryFn: () => api.motivoCorrections.list({ status, limit: 100 }),
    refetchInterval: 8000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['motivo-corrections'] });

  const acceptMut  = useMutation({ mutationFn: api.motivoCorrections.accept,  onSuccess: refresh });
  const rejectMut  = useMutation({ mutationFn: api.motivoCorrections.reject,  onSuccess: refresh });
  const noActMut   = useMutation({ mutationFn: api.motivoCorrections.noAction, onSuccess: refresh });
  const renotMut   = useMutation({ mutationFn: api.motivoCorrections.renotifyDriver, onSuccess: refresh });

  const rows = listQ.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-brand" />
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight">Correcciones de motivo</h1>
            <p className="text-[12px] text-text-muted mt-0.5">
              Sugerencias del LLM cuando el motivo reportado no coincide con el comentario.
            </p>
          </div>
        </div>
      </header>

      {/* Status pills */}
      <div className="flex items-center gap-1 border-b border-line/40">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={`px-3 py-2 text-[12px] border-b-2 transition-colors ${
              status === t.key
                ? 'border-brand text-brand font-medium'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-text-muted pb-2">
          {listQ.isLoading ? 'Cargando…' : `${rows.length} resultado${rows.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="panel p-12 text-center">
          <Inbox size={36} className="mx-auto mb-2 text-text-muted/40" />
          <div className="text-[13px] text-text-secondary">Sin correcciones para este filtro.</div>
          <div className="text-[11px] text-text-muted mt-1">
            La IA solo propone cambios cuando el motivo reportado difiere del sugerido con confianza alta o media.
          </div>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50/5 border-b border-line/40 sticky top-0">
              <tr className="text-left text-text-muted uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2">Tracking</th>
                <th className="px-3 py-2">Reportado</th>
                <th className="px-3 py-2">IA sugiere</th>
                <th className="px-3 py-2">Razonamiento</th>
                <th className="px-3 py-2">Driver</th>
                <th className="px-3 py-2">Hora</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/30">
              {rows.map(c => (
                <CorrectionRow
                  key={c.correction_id}
                  c={c}
                  onAccept={() => acceptMut.mutate(c.correction_id)}
                  onReject={() => rejectMut.mutate(c.correction_id)}
                  onNoAction={() => noActMut.mutate(c.correction_id)}
                  onRenotify={() => renotMut.mutate(c.correction_id)}
                  busy={
                    acceptMut.isPending || rejectMut.isPending ||
                    noActMut.isPending || renotMut.isPending
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfianzaChip({ confianza }: { confianza: string }) {
  const cls =
    confianza === 'alta'  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' :
    confianza === 'media' ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30' :
                            'bg-slate-500/15 text-slate-400 ring-slate-500/30';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ring-1 ${cls}`}>
      <Sparkles size={10} className="mr-1" /> {confianza}
    </span>
  );
}

function StatusBadge({ status }: { status: CorrectionStatus }) {
  const cls =
    status === 'pending'   ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30' :
    status === 'accepted'  ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' :
    status === 'rejected'  ? 'bg-red-500/15 text-red-400 ring-red-500/30' :
                             'bg-slate-500/15 text-slate-400 ring-slate-500/30';
  const label = status === 'pending' ? 'Pendiente'
              : status === 'accepted' ? 'Aceptada'
              : status === 'rejected' ? 'Rechazada' : 'Archivada';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ring-1 ${cls}`}>
      {label}
    </span>
  );
}

function CorrectionRow({
  c, onAccept, onReject, onNoAction, onRenotify, busy,
}: {
  c: MotivoCorrection;
  onAccept: () => void;
  onReject: () => void;
  onNoAction: () => void;
  onRenotify: () => void;
  busy: boolean;
}) {
  const hour = c.created_at.slice(11, 16);
  const isPending = c.status === 'pending';

  return (
    <tr className="hover:bg-bg-700/20">
      <td className="px-3 py-2 align-top">
        <div className="font-mono text-[11px] text-text-secondary">{c.tracking_id}</div>
        {c.vehicle_name && (
          <div className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
            <Truck size={9} /> {c.vehicle_name}
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="text-[11px] text-text-secondary">{c.motivo_reportado}</div>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col gap-1">
          <div className="text-[11px] text-text-primary font-medium">{c.motivo_sugerido}</div>
          <ConfianzaChip confianza={c.confianza} />
        </div>
      </td>
      <td className="px-3 py-2 align-top max-w-[320px]">
        <div className="text-[11px] text-text-muted line-clamp-2" title={c.razonamiento}>
          {c.razonamiento}
        </div>
        {c.comentario && (
          <div className="text-[10px] italic text-text-muted/80 mt-1 line-clamp-1" title={c.comentario}>
            “{c.comentario}”
          </div>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="text-[11px]">{c.driver_name ?? '—'}</div>
        {c.driver_id && <div className="text-[10px] text-text-muted font-mono">{c.driver_id}</div>}
      </td>
      <td className="px-3 py-2 align-top">
        <div className="text-[11px] tabular-nums">{hour}</div>
        <StatusBadge status={c.status} />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center justify-end gap-1">
          {isPending && (
            <>
              <button
                onClick={onAccept}
                disabled={busy}
                title="Aceptar sugerencia"
                className="px-2 py-1 rounded-md text-[11px] bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1"
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aceptar
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                title="Rechazar sugerencia"
                className="px-2 py-1 rounded-md text-[11px] bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50 flex items-center gap-1"
              >
                <X size={11} /> Rechazar
              </button>
              <button
                onClick={onNoAction}
                disabled={busy}
                title="Archivar sin acción"
                className="px-2 py-1 rounded-md text-[11px] bg-slate-500/15 text-slate-400 hover:bg-slate-500/25 disabled:opacity-50 flex items-center gap-1"
              >
                <ClipboardX size={11} />
              </button>
            </>
          )}
          <button
            onClick={onRenotify}
            disabled={busy}
            title="Re-notificar driver"
            className="px-2 py-1 rounded-md text-[11px] text-text-muted hover:bg-bg-700/40 hover:text-text-primary disabled:opacity-50 flex items-center gap-1"
          >
            <Bell size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
}
