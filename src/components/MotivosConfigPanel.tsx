import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Bell, BellOff, BookOpen, Building2, ChevronDown, ChevronRight,
  Globe2, Loader2, RotateCcw, Save, ShieldAlert, Sparkles, X,
} from 'lucide-react';
import { api } from '../api';
import { MotivoAlertConfig, MotivoSeverity } from '../types';
import { useAuth } from '../hooks/useAuth';

const SEVERITY_META: Record<MotivoSeverity, { label: string; cls: string }> = {
  low:      { label: 'Baja',     cls: 'bg-bg-700 text-text-secondary border-line' },
  medium:   { label: 'Media',    cls: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40' },
  high:     { label: 'Alta',     cls: 'bg-accent-red/15 text-accent-red border-accent-red/40' },
  critical: { label: 'Crítica',  cls: 'bg-accent-violet/15 text-accent-violet border-accent-violet/40' },
};

const SEVERITY_ORDER: MotivoSeverity[] = ['low', 'medium', 'high', 'critical'];

export function MotivosConfigPanel() {
  const { user, isFalabella } = useAuth();
  const qc = useQueryClient();
  const [scope, setScope] = useState<'global' | 'empresa'>(
    isFalabella ? 'global' : 'empresa',
  );
  const [promptOpen, setPromptOpen] = useState(false);

  const empresasQ = useQuery({
    queryKey: ['empresas-mc'],
    queryFn: api.empresas,
    enabled: isFalabella,
  });

  const [empresaId, setEmpresaId] = useState<number | null>(
    !isFalabella ? user?.empresa_id ?? null : null,
  );

  const targetEmpresa = scope === 'empresa' ? empresaId ?? undefined : undefined;

  const cfgQ = useQuery({
    queryKey: ['motivos-alert-config', scope, targetEmpresa ?? 'global'],
    queryFn: () => api.motivos.alertConfig(targetEmpresa),
    refetchOnMount: true,
  });

  const setMut = useMutation({
    mutationFn: (req: {
      motivo: string;
      alertable: boolean;
      severity: MotivoSeverity;
      description?: string | null;
      reset_description?: boolean;
    }) =>
      api.motivos.setAlertConfig(req.motivo, {
        alertable: req.alertable,
        severity: req.severity,
        empresa_id: scope === 'empresa' ? empresaId ?? null : null,
        description: req.description,
        reset_description: req.reset_description,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motivos-alert-config'] }),
  });

  const rows = cfgQ.data ?? [];
  const alertablesCount = useMemo(
    () => rows.filter(r => r.alertable).length,
    [rows],
  );
  const customCount = useMemo(
    () => rows.filter(r => r.description_is_custom).length,
    [rows],
  );

  const canEdit = isFalabella;

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle size={14} className="text-accent-yellow" />
              Motivos · alertas y prompt del LLM
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Cuando un transportista reporta una visita con un motivo marcado como
              alertable, se dispara un evento (y notificación si está habilitada).
              La descripción de cada motivo es lo que el LLM usa para clasificar
              comentarios libres.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-text-muted">
              <div>
                <span className="font-mono text-accent-yellow">{alertablesCount}</span>{' '}
                / {rows.length} alertables
              </div>
              <div>
                <span className="font-mono text-accent-violet">{customCount}</span>{' '}
                descripciones personalizadas
              </div>
            </div>
            <button
              className="btn flex items-center gap-1"
              onClick={() => setPromptOpen(true)}
              title="Ver el system prompt completo que se manda al LLM"
            >
              <BookOpen size={12} /> Ver prompt
            </button>
          </div>
        </div>

        {isFalabella && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">Alcance:</span>
            <button
              className={`btn flex items-center gap-1 ${scope === 'global' ? 'btn-primary' : ''}`}
              onClick={() => setScope('global')}
            >
              <Globe2 size={12} /> Global (por defecto)
            </button>
            <button
              className={`btn flex items-center gap-1 ${scope === 'empresa' ? 'btn-primary' : ''}`}
              onClick={() => setScope('empresa')}
            >
              <Building2 size={12} /> Por empresa
            </button>
            {scope === 'empresa' && (
              <select
                className="input ml-2"
                value={empresaId ?? ''}
                onChange={e => setEmpresaId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— elegir empresa —</option>
                {(empresasQ.data ?? []).map(e => (
                  <option key={e.empresa_id} value={e.empresa_id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!isFalabella && (
          <div className="text-[11px] text-text-muted flex items-center gap-1">
            <ShieldAlert size={12} className="text-accent-yellow" />
            Solo lectura. La configuración la administran perfiles Falabella.
          </div>
        )}
      </div>

      <div className="panel">
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-bg-700 text-text-muted uppercase tracking-wider text-[10px]">
              <tr>
                <th className="w-6"></th>
                <th className="text-left px-3 py-2">Motivo</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">Severidad</th>
                <th className="text-left px-3 py-2">Descripción (prompt)</th>
                <th className="text-left px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cfgQ.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                    <Loader2 size={14} className="inline animate-spin mr-2" />
                    Cargando…
                  </td>
                </tr>
              )}
              {!cfgQ.isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                    Sin motivos.
                  </td>
                </tr>
              )}
              {rows.map(r => (
                <MotivoRow
                  key={r.motivo}
                  cfg={r}
                  canEdit={canEdit && (scope === 'global' || empresaId != null)}
                  onSave={(alertable, severity, descUpdate) =>
                    setMut.mutate({
                      motivo: r.motivo,
                      alertable,
                      severity,
                      description: descUpdate.description,
                      reset_description: descUpdate.reset,
                    })
                  }
                  busy={setMut.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {promptOpen && <SystemPromptModal onClose={() => setPromptOpen(false)} />}
    </div>
  );
}

function MotivoRow({
  cfg,
  canEdit,
  onSave,
  busy,
}: {
  cfg: MotivoAlertConfig;
  canEdit: boolean;
  onSave: (
    alertable: boolean,
    severity: MotivoSeverity,
    descUpdate: { description?: string | null; reset?: boolean },
  ) => void;
  busy: boolean;
}) {
  const meta = SEVERITY_META[cfg.severity];
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(cfg.description);

  const dirty = draft !== cfg.description;

  const handleAlertable = (checked: boolean) =>
    onSave(checked, cfg.severity, {});
  const handleSeverity = (sev: MotivoSeverity) =>
    onSave(cfg.alertable, sev, {});
  const handleSaveDesc = () =>
    onSave(cfg.alertable, cfg.severity, { description: draft });
  const handleReset = () => {
    setDraft(cfg.default_description);
    onSave(cfg.alertable, cfg.severity, { reset: true });
  };

  return (
    <>
      <tr className="border-t border-line hover:bg-bg-700/30">
        <td
          className="px-2 py-2 cursor-pointer text-text-muted"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </td>
        <td className="px-3 py-2 font-mono text-[11px]">{cfg.motivo}</td>
        <td className="px-3 py-2">
          {cfg.alertable ? (
            <span className="pill bg-accent-red/15 text-accent-red border border-accent-red/40 flex items-center gap-1 w-fit">
              <Bell size={10} /> Alerta
            </span>
          ) : (
            <span className="pill bg-bg-700 text-text-muted border border-line flex items-center gap-1 w-fit">
              <BellOff size={10} /> Silenciado
            </span>
          )}
        </td>
        <td className="px-3 py-2">
          <span className={`pill border ${meta.cls}`}>{meta.label}</span>
        </td>
        <td className="px-3 py-2 max-w-[400px]">
          <div
            className="text-[11px] text-text-secondary truncate"
            title={cfg.description}
          >
            {cfg.description}
          </div>
          <div className="text-[9px] mt-0.5 flex items-center gap-1">
            {cfg.description_is_custom ? (
              <span className="pill bg-accent-violet/15 text-accent-violet border border-accent-violet/40 text-[9px]">
                personalizada
              </span>
            ) : (
              <span className="pill bg-bg-700 text-text-muted border border-line text-[9px]">
                default
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          {canEdit ? (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-1 text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={cfg.alertable}
                  disabled={busy}
                  onChange={e => handleAlertable(e.target.checked)}
                  className="accent-accent-red"
                />
                Alertable
              </label>
              <select
                className="input text-[11px] py-1"
                value={cfg.severity}
                disabled={busy}
                onChange={e => handleSeverity(e.target.value as MotivoSeverity)}
              >
                {SEVERITY_ORDER.map(s => (
                  <option key={s} value={s}>
                    {SEVERITY_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-[10px] text-text-muted">solo lectura</span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-bg-700/30 border-t border-line">
          <td></td>
          <td colSpan={5} className="px-3 py-3">
            <div className="flex flex-col gap-2">
              <div className="text-[11px] uppercase tracking-wider text-text-muted flex items-center gap-1">
                <Sparkles size={11} className="text-accent-violet" />
                Descripción usada por el LLM al clasificar
              </div>
              <textarea
                className="input min-h-[120px] text-[11px] font-mono"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={!canEdit || busy}
                maxLength={4000}
                placeholder="Texto que el LLM lee como manual para este motivo"
              />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] text-text-muted">
                  {draft.length}/4000 caracteres
                </span>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      className="btn flex items-center gap-1 text-[11px]"
                      onClick={() => setDraft(cfg.description)}
                      disabled={busy || !dirty}
                      title="Descartar cambios"
                    >
                      Descartar
                    </button>
                    <button
                      className="btn flex items-center gap-1 text-[11px]"
                      onClick={handleReset}
                      disabled={busy || !cfg.description_is_custom}
                      title="Volver al texto default del catálogo"
                    >
                      <RotateCcw size={11} /> Restaurar default
                    </button>
                    <button
                      className="btn-primary flex items-center gap-1 text-[11px]"
                      onClick={handleSaveDesc}
                      disabled={busy || !dirty}
                    >
                      {busy ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Save size={11} />
                      )}
                      Guardar descripción
                    </button>
                  </div>
                )}
              </div>
              {cfg.description_is_custom && (
                <div className="text-[10px] text-text-muted">
                  Predeterminado del catálogo (referencia):{' '}
                  <span className="italic">{cfg.default_description.slice(0, 200)}…</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function SystemPromptModal({ onClose }: { onClose: () => void }) {
  const promptQ = useQuery({
    queryKey: ['motivos-system-prompt'],
    queryFn: api.motivos.systemPrompt,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={14} className="text-accent-violet" />
            System prompt actual del LLM
          </div>
          <div className="flex items-center gap-2">
            {promptQ.data && (
              <span
                className={
                  'pill border text-[10px] ' +
                  (promptQ.data.has_llm_creds
                    ? 'bg-accent-violet/15 text-accent-violet border-accent-violet/40'
                    : 'bg-bg-700 text-text-muted border-line')
                }
              >
                {promptQ.data.has_llm_creds ? 'LLM activo' : 'sin creds (fallback keywords)'}
              </span>
            )}
            <button onClick={onClose} className="text-text-muted hover:text-accent-red">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-auto">
          {promptQ.isLoading && (
            <div className="text-text-muted text-xs">Cargando…</div>
          )}
          {promptQ.data && (
            <pre className="text-[11px] font-mono whitespace-pre-wrap text-text-secondary leading-relaxed">
              {promptQ.data.system_prompt}
            </pre>
          )}
        </div>
        <div className="px-4 py-2 border-t border-line text-[10px] text-text-muted">
          Cambiá la descripción de cualquier motivo expandiendo su fila —
          el prompt se reconstruye en cada llamada al LLM, no necesita reinicio.
        </div>
      </div>
    </div>
  );
}
