import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api';

export function ModelPanel() {
  const metricsQ = useQuery({ queryKey: ['model-metrics'], queryFn: api.modelMetrics });
  const importanceQ = useQuery({
    queryKey: ['model-importance'],
    queryFn: () => api.modelImportance(15),
    refetchInterval: 10000,
  });

  if (metricsQ.isLoading || !metricsQ.data) {
    return <div className="text-text-muted">Cargando métricas del modelo...</div>;
  }

  const m = metricsQ.data;
  const cm = m.confusion_matrix;
  const tn = cm[0][0], fp = cm[0][1], fn = cm[1][0], tp = cm[1][1];
  const recall = tp / Math.max(1, tp + fn);
  const precision = tp / Math.max(1, tp + fp);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <Metric label="AUC" value={m.auc.toFixed(3)} sub="Validación (10 días)" color="text-accent-blue" />
        <Metric label="Brier score" value={m.brier.toFixed(4)} sub="Menor = mejor" />
        <Metric label="Recall (sensibilidad)" value={`${(recall * 100).toFixed(1)}%`} sub={`@ threshold 0.5`} color="text-accent-violet" />
        <Metric label="Precision" value={`${(precision * 100).toFixed(1)}%`} sub={`${tp} TP / ${tp + fp} alerts`} color="text-accent-green" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-title">Curva de calibración</div>
          <div className="p-3 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.calibration_curve}>
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="predicted"
                  stroke="rgb(var(--text-secondary))"
                  tickFormatter={v => v.toFixed(2)}
                  domain={[0, 1]}
                  type="number"
                  label={{ value: 'Prob. predicha', position: 'insideBottom', fill: 'rgb(var(--text-muted))', offset: -2 }}
                />
                <YAxis
                  stroke="rgb(var(--text-secondary))"
                  domain={[0, 1]}
                  tickFormatter={v => v.toFixed(2)}
                  label={{ value: 'Frac. real', angle: -90, position: 'insideLeft', fill: 'rgb(var(--text-muted))' }}
                />
                <Tooltip contentStyle={{ background: 'rgb(var(--bg-800))', border: '1px solid rgb(var(--line))', color: 'rgb(var(--text-primary))', fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="rgb(var(--accent-blue))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'rgb(var(--accent-blue))' }}
                />
                <Line
                  type="linear"
                  dataKey="predicted"
                  stroke="rgb(var(--text-muted))"
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Matriz de confusión @ 0.5</div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-1 text-center">
              <div></div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Pred OK</div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Pred FAIL</div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted text-right pr-2 self-center">Real OK</div>
              <CMCell value={tn} kind="tn" />
              <CMCell value={fp} kind="fp" />
              <div className="text-[10px] uppercase tracking-wider text-text-muted text-right pr-2 self-center">Real FAIL</div>
              <CMCell value={fn} kind="fn" />
              <CMCell value={tp} kind="tp" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <Stat label="Train" value={m.n_train} sub={`base rate ${(m.base_rate_train * 100).toFixed(1)}%`} />
              <Stat label="Validación" value={m.n_val} sub={`base rate ${(m.base_rate_val * 100).toFixed(1)}%`} />
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Importancia global de features (SHAP, top 15)</div>
        <div className="p-3 h-[420px]">
          {importanceQ.data && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={importanceQ.data.slice().reverse()} layout="vertical">
                <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="3 3" />
                <XAxis type="number" stroke="rgb(var(--text-secondary))" />
                <YAxis
                  type="category"
                  dataKey="display"
                  stroke="rgb(var(--text-secondary))"
                  width={220}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ background: 'rgb(var(--bg-800))', border: '1px solid rgb(var(--line))', color: 'rgb(var(--text-primary))', fontSize: 11 }}
                  formatter={(v: number) => v.toFixed(4)}
                />
                <Bar dataKey="importance" fill="rgb(var(--accent-violet))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="text-[11px] text-accent-yellow border border-accent-yellow/30 bg-accent-yellow/5 p-3 rounded">
        ⚠ Modelo entrenado con 60 días sintéticos. Las métricas de performance solo son válidas
        post-entrenamiento con histórico real de Falabella (mínimo 3 meses).
      </div>
    </div>
  );
}

function Metric({
  label, value, sub, color = 'text-text-primary',
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color} tabular-nums`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function CMCell({ value, kind }: { value: number; kind: 'tn' | 'fp' | 'fn' | 'tp' }) {
  const cls = {
    tn: 'bg-accent-green/15 text-accent-green',
    fp: 'bg-accent-yellow/15 text-accent-yellow',
    fn: 'bg-accent-red/15 text-accent-red',
    tp: 'bg-accent-violet/15 text-accent-violet',
  }[kind];
  const label = { tn: 'TN', fp: 'FP', fn: 'FN', tp: 'TP' }[kind];
  return (
    <div className={`p-4 rounded ${cls}`}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-bg-700 rounded p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="text-base tabular-nums">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}
