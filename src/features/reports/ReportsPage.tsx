import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDias, getDiaReport } from '@/api/sdk.gen'
import type { DiaOut, DiaReport } from '@/api'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { useEmpresas } from '@/lib/use-empresas'
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`)
const num = (v: number | null | undefined) => (v == null ? '—' : String(v))

/** Signed delta with up/down arrow; `pp` for percentage-point metrics. */
function Delta({ value, unit = 'pp' }: { value: number | null | undefined; unit?: string }) {
  if (value == null) return <span className="text-text-muted text-[11px]">sin comparación</span>
  const up = value > 0
  const flat = value === 0
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown
  const color = flat ? 'text-text-muted' : up ? 'text-accent-green' : 'text-accent-red'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {value > 0 ? '+' : ''}{value}{unit}
    </span>
  )
}

function KpiCard({ label, value, delta }: { label: string; value: string; delta?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-bg-800 p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">{label}</div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      {delta != null && <div className="mt-1">{delta}</div>}
    </div>
  )
}

export function ReportsPage() {
  const { data: empresas } = useEmpresas()
  const empresaMap = useMemo(
    () => new Map((empresas ?? []).map((e) => [e.empresa_id, e.nombre])),
    [empresas],
  )

  const { data: diasData } = useQuery({
    queryKey: ['dias', 'all'],
    queryFn: () => listDias({}),
    select: (res) => res.data ?? [],
  })
  const dias = useMemo(
    () => [...((diasData ?? []) as DiaOut[])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [diasData],
  )

  const [diaId, setDiaId] = useState<number | null>(null)
  const selectedDia = diaId ?? dias[0]?.dia_id ?? null

  const reportQ = useQuery({
    queryKey: ['report', 'dia', selectedDia],
    queryFn: () => getDiaReport({ path: { dia_id: selectedDia as number } }),
    select: (res) => res.data as DiaReport,
    enabled: selectedDia != null,
  })
  const r = reportQ.data

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-5 h-5 text-brand-400" />
          <h1 className="text-base font-semibold text-text-primary uppercase tracking-wider">Reportes</h1>
        </div>
        <select
          value={selectedDia ?? ''}
          onChange={(e) => setDiaId(Number(e.target.value))}
          className="rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500"
        >
          {dias.map((d) => (
            <option key={d.dia_id} value={d.dia_id}>
              {d.fecha} · {empresaMap.get(d.empresa_id) ?? `Empresa ${d.empresa_id}`} · {d.estado}
            </option>
          ))}
        </select>
      </div>

      {reportQ.isLoading && (
        <div className="text-text-muted text-xs uppercase tracking-wider py-12 text-center">Cargando…</div>
      )}
      {reportQ.isError && (
        <div className="text-accent-red text-[13px] bg-accent-red/10 rounded px-3 py-2">
          No se pudo cargar el reporte.
        </div>
      )}

      {r && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-text-secondary">
            <span className="font-semibold text-text-primary">{r.empresa_nombre}</span>
            <span>·</span><span>{r.fecha}</span>
            <Badge variant={r.estado === 'CERRADO' ? 'gray' : r.estado === 'EN_CURSO' ? 'blue' : 'yellow'}>
              {r.estado}
            </Badge>
            {r.comparison.prev_dia_id != null && (
              <span className="text-text-muted">· vs día anterior ({r.comparison.prev_fecha})</span>
            )}
          </div>

          {/* KPI cards with day-over-day deltas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Visitas" value={num(r.totals.visitas)}
              delta={<Delta value={r.comparison.visitas_delta} unit="" />} />
            <KpiCard label="Éxito de entrega" value={pct(r.totals.success_pct)}
              delta={<Delta value={r.comparison.success_pct_delta} />} />
            <KpiCard label="Puntualidad" value={pct(r.on_time.on_time_pct)}
              delta={<Delta value={r.comparison.on_time_pct_delta} />} />
            <KpiCard label="VIP" value={`${r.vip.entregado}/${r.vip.visitas}`}
              delta={<span className="text-[11px] text-text-muted">éxito {pct(r.vip.success_pct)}</span>} />
          </div>

          {/* Outcome breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Entregado" value={num(r.totals.entregado)} />
            <KpiCard label="No entregado" value={num(r.totals.no_entregado)} />
            <KpiCard label="Cancelado" value={num(r.totals.cancelado)} />
            <KpiCard label="Pendiente" value={num(r.totals.pendiente)} />
          </div>

          {/* By region */}
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Por región</h2>
            <DataTable
              data={r.by_region}
              keyFn={(row) => row.region ?? '∅'}
              emptyMessage="Sin datos de región"
              columns={[
                { header: 'Región', accessor: (row) => row.region ?? '—' },
                { header: 'Visitas', accessor: (row) => row.visitas },
                { header: 'Entregado', accessor: (row) => row.entregado },
                { header: 'No entreg.', accessor: (row) => row.no_entregado },
                { header: 'Éxito', accessor: (row) => pct(row.success_pct) },
              ]}
            />
          </section>

          {/* Driver behavior */}
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Comportamiento por conductor</h2>
            <DataTable
              data={r.by_driver}
              keyFn={(row) => row.driver_id ?? '∅'}
              emptyMessage="Sin conductores"
              columns={[
                { header: 'Conductor', accessor: (row) => (
                    <span>{row.nombre ?? '—'} <span className="text-text-muted">{row.driver_id ?? ''}</span></span>
                  ) },
                { header: 'Visitas', accessor: (row) => row.visitas },
                { header: 'Éxito', accessor: (row) => pct(row.success_pct) },
                { header: 'Puntualidad', accessor: (row) => pct(row.on_time_pct) },
                { header: 'Atraso prom. (min)', accessor: (row) => num(row.avg_delay_min) },
              ]}
            />
          </section>

          {/* Non-delivery reasons */}
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Motivos de no entrega</h2>
            {r.by_motivo.length === 0 ? (
              <div className="text-text-muted text-xs uppercase tracking-wider">Sin motivos registrados</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {r.by_motivo.map((m) => (
                  <span key={m.motivo ?? '∅'} className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-800 px-3 py-1.5 text-[12px]">
                    <span className="text-text-secondary">{m.motivo ?? '—'}</span>
                    <span className="font-semibold text-accent-red">{m.count}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
