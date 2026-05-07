import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, BellOff, CheckCircle2, Loader2, MessageSquare,
  Sparkles, Wand2, Send, RefreshCw, Truck,
} from 'lucide-react';
import { api } from '../api';
import { ClassifyResponse, MotivoSeverity, PlanDriver, PlanVisit } from '../types';

const SEV_CLS: Record<MotivoSeverity, string> = {
  low:      'bg-bg-700 text-text-secondary border-line',
  medium:   'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40',
  high:     'bg-accent-red/15 text-accent-red border-accent-red/40',
  critical: 'bg-accent-violet/15 text-accent-violet border-accent-violet/40',
};

const CONF_CLS: Record<string, string> = {
  alta:  'bg-accent-green/15 text-accent-green border-accent-green/40',
  media: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40',
  baja:  'bg-accent-red/15 text-accent-red border-accent-red/40',
};

const EJEMPLOS: { label: string; texto: string }[] = [
  {
    label: 'Choque en ruta',
    texto: 'Choque leve en Av. Apoquindo, esperando a carabineros. No puedo seguir la ruta hasta que llegue el seguro.',
  },
  {
    label: 'Sin moradores',
    texto: 'Toqué el timbre 3 veces, no atiende nadie. Llamé al teléfono que figura y suena buzón. Casa con luces apagadas.',
  },
  {
    label: 'Cliente anula por daño (causa raíz)',
    texto: 'El cliente abrió la caja, vio que el producto venía roto y anuló la compra. Me pidió que devolviera el envío.',
  },
  {
    label: 'Producto no cargó',
    texto: 'Llegué al cliente y revisando el camión me doy cuenta de que el producto quedó en bodega, no fue cargado en origen.',
  },
  {
    label: 'Sospecha de fraude',
    texto: 'cliente sospechoso, datos no coinciden con RUT, intentó usar tarjeta clonada, no entregamos.',
  },
  {
    label: 'Detención urgente Falabella',
    texto: 'centro de distribución me llamó: detener entrega de inmediato, devolver al CD.',
  },
  {
    label: 'Comentario ambiguo',
    texto: 'no se pudo entregar',
  },
];

export function AsistenteIAPanel({ driver }: { driver: PlanDriver | null }) {
  const qc = useQueryClient();

  const visitsPending = useMemo(
    () => (driver?.visits ?? []).filter(v => v.status === 'pending'),
    [driver],
  );

  const [selectedTid, setSelectedTid] = useState<string>('');
  const [comentario, setComentario] = useState('');
  const [override, setOverride] = useState<string>('');
  const [result, setResult] = useState<ClassifyResponse | null>(null);

  // Auto-pick primer visit pending al cambiar driver
  useEffect(() => {
    if (visitsPending.length && !visitsPending.some(v => v.tracking_id === selectedTid)) {
      setSelectedTid(visitsPending[0].tracking_id);
    }
  }, [visitsPending]);

  const motivosQ = useQuery({ queryKey: ['motivos-catalog'], queryFn: api.motivos.list });

  const classifyMut = useMutation({
    mutationFn: () => api.motivos.classify(comentario),
    onSuccess: r => {
      setResult(r);
      setOverride(r.motivo);
    },
  });

  const submitMut = useMutation({
    mutationFn: () =>
      api.comments.add(selectedTid, {
        motivo: override || result?.motivo || '',
        comentario,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events-live'] });
      qc.invalidateQueries({ queryKey: ['comments-recent'] });
      qc.invalidateQueries({ queryKey: ['comment-sim-stats'] });
      // Mantenemos el resultado visible y ofrecemos limpiar manualmente
    },
  });

  const recentQ = useQuery({
    queryKey: ['comments-recent', driver?.vehicle_id],
    queryFn: () => api.comments.recent({ limit: 10 }),
    refetchInterval: 5000,
  });

  if (!driver) {
    return (
      <div className="panel p-6 text-center text-text-muted text-sm">
        Seleccioná un driver a la izquierda para usar el asistente.
      </div>
    );
  }

  const finalMotivo = override || result?.motivo || '';
  const finalSeverity =
    finalMotivo === result?.motivo ? result?.severity : undefined;
  const willAlert =
    finalMotivo === result?.motivo ? !!result?.alertable : undefined;

  const reset = () => {
    setComentario('');
    setOverride('');
    setResult(null);
    submitMut.reset();
    classifyMut.reset();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Columna izquierda: input */}
      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <Sparkles size={13} className="text-accent-violet" />
          Asistente de motivos (IA)
          <span className="ml-auto text-[10px] text-text-muted normal-case tracking-normal">
            simula transportista escribiendo libre
          </span>
        </div>

        <div className="p-3 flex flex-col gap-3">
          {/* Selector de visita */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1">
              <Truck size={11} /> Visita pendiente
            </span>
            <select
              className="input"
              value={selectedTid}
              onChange={e => setSelectedTid(e.target.value)}
            >
              {visitsPending.length === 0 && (
                <option value="">— sin visitas pendientes —</option>
              )}
              {visitsPending.map(v => (
                <option key={v.tracking_id} value={v.tracking_id}>
                  #{v.order} · {v.title}
                </option>
              ))}
            </select>
          </label>

          {/* Textarea */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1">
              <MessageSquare size={11} /> Contame qué pasó
            </span>
            <textarea
              className="input min-h-[120px]"
              value={comentario}
              onChange={e => {
                setComentario(e.target.value);
                if (result) setResult(null);
              }}
              placeholder="Ej: no había nadie y tampoco contesta el teléfono…"
              maxLength={2000}
            />
            <span className="text-[10px] text-text-muted text-right">
              {comentario.length}/2000
            </span>
          </label>

          {/* Ejemplos rápidos */}
          <div className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">
              Ejemplos rápidos
            </div>
            <div className="flex flex-wrap gap-1">
              {EJEMPLOS.map(e => (
                <button
                  key={e.label}
                  className="btn text-[10px] !py-1 !px-2"
                  onClick={() => {
                    setComentario(e.texto);
                    setResult(null);
                  }}
                  title={e.texto}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <button
              className="btn-primary flex items-center gap-1"
              onClick={() => classifyMut.mutate()}
              disabled={!comentario.trim() || classifyMut.isPending}
            >
              {classifyMut.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Wand2 size={12} />
              )}
              Sugerir motivo con IA
            </button>
            <button className="btn flex items-center gap-1" onClick={reset}>
              <RefreshCw size={12} /> Limpiar
            </button>
            {classifyMut.isError && (
              <span className="text-[11px] text-accent-red">
                {(classifyMut.error as Error).message}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Columna derecha: resultado + confirm */}
      <div className="panel">
        <div className="panel-title flex items-center gap-2">
          <Sparkles size={13} className="text-accent-violet" />
          Sugerencia de la IA
          {result?.fallback && (
            <span
              className="ml-auto pill bg-bg-700 text-text-muted border border-line text-[10px]"
              title="Sin Azure OpenAI configurado: usando matching por keywords"
            >
              fallback keywords
            </span>
          )}
          {result && !result.fallback && (
            <span className="ml-auto pill bg-accent-violet/15 text-accent-violet border border-accent-violet/40 text-[10px]">
              gpt-4o-mini
            </span>
          )}
        </div>

        <div className="p-3 flex flex-col gap-3">
          {!result && (
            <div className="text-text-muted text-xs py-8 text-center border border-dashed border-line rounded">
              Escribí un comentario y dale "Sugerir motivo con IA".
            </div>
          )}

          {result && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`pill border text-xs ${SEV_CLS[result.severity]}`}>
                  {result.motivo}
                </div>
                <div
                  className={`pill border text-[10px] ${CONF_CLS[result.confianza] ?? 'bg-bg-700 border-line'}`}
                >
                  Confianza {result.confianza}
                </div>
                <div className={`pill border text-[10px] ${SEV_CLS[result.severity]}`}>
                  Severidad {result.severity}
                </div>
                {result.alertable ? (
                  <div className="pill bg-accent-red/15 text-accent-red border border-accent-red/40 text-[10px] flex items-center gap-1">
                    <Bell size={10} /> Dispara alerta
                  </div>
                ) : (
                  <div className="pill bg-bg-700 text-text-muted border border-line text-[10px] flex items-center gap-1">
                    <BellOff size={10} /> No alerta
                  </div>
                )}
              </div>

              <div className="text-[11px] text-text-secondary border-l-2 border-accent-violet/40 pl-2">
                <span className="text-text-muted">Razonamiento:</span> {result.razonamiento}
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-wider text-text-muted">
                  Override (si no estás de acuerdo)
                </span>
                <select
                  className="input"
                  value={override}
                  onChange={e => setOverride(e.target.value)}
                >
                  {(motivosQ.data ?? []).map(m => (
                    <option key={m.motivo} value={m.motivo}>
                      {m.default_alertable ? '🔔 ' : ''}
                      {m.motivo}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <button
                  className="btn-primary flex items-center gap-1"
                  onClick={() => submitMut.mutate()}
                  disabled={!finalMotivo || !comentario.trim() || !selectedTid || submitMut.isPending}
                >
                  {submitMut.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  Confirmar y registrar
                </button>
                {submitMut.isSuccess && (
                  <span className="text-[11px] text-brand flex items-center gap-1">
                    <CheckCircle2 size={11} /> Registrado · #
                    {submitMut.data.comment_id}
                  </span>
                )}
                {submitMut.isError && (
                  <span className="text-[11px] text-accent-red">
                    {(submitMut.error as Error).message}
                  </span>
                )}
              </div>
              {willAlert && (
                <div className="rounded border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-[11px] text-accent-red flex items-center gap-2">
                  <AlertTriangle size={12} />
                  Al confirmar se dispara alerta (severidad {finalSeverity}). Operadores
                  serán notificados (WhatsApp si está habilitado).
                </div>
              )}
            </>
          )}
        </div>

        {/* Histórico breve */}
        <div className="border-t border-line p-3">
          <div className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
            Últimos reportes
          </div>
          <div className="flex flex-col gap-1 max-h-[180px] overflow-auto">
            {(recentQ.data ?? []).slice(0, 8).map(c => (
              <div
                key={c.comment_id}
                className="text-[11px] flex items-center gap-2 border-b border-line/40 py-1"
              >
                <span className="font-mono text-text-muted">{c.created_at.slice(11, 16)}</span>
                <span
                  className={`pill border text-[10px] ${
                    c.severity ? SEV_CLS[c.severity] : 'bg-bg-700 border-line'
                  }`}
                >
                  {c.motivo}
                </span>
                <span className="truncate text-text-secondary flex-1" title={c.comentario}>
                  {c.comentario}
                </span>
              </div>
            ))}
            {!recentQ.data?.length && (
              <span className="text-text-muted text-[11px]">Sin reportes aún.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
