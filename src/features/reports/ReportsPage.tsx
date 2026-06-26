import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDias, getDiaReport, getRangeReport } from '@/api/sdk.gen'
import type { DiaOut, DiaReport, RangeReport, RegionRow, DriverRow, MotivoRow, TrendPoint } from '@/api'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { useEmpresas } from '@/lib/use-empresas'
import { BarChart3, TrendingUp, TrendingDown, Minus, Calendar, CalendarRange } from 'lucide-react'
import { clsx } from 'clsx'

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

/** Region / driver / motivo tables — shared by the day and range reports. */
function Breakdowns({ by_region, by_driver, by_motivo }: {
  by_region: RegionRow[]; by_driver: DriverRow[]; by_motivo: MotivoRow[]
}) {
  return (
    <>
      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Por región</h2>
        <DataTable
          data={by_region}
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

      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Comportamiento por conductor</h2>
        <DataTable
          data={by_driver}
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

      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Motivos de no entrega</h2>
        {by_motivo.length === 0 ? (
          <div className="text-text-muted text-xs uppercase tracking-wider">Sin motivos registrados</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {by_motivo.map((m) => (
              <span key={m.motivo ?? '∅'} className="inline-flex items-center gap-2 rounded-md border border-line bg-bg-800 px-3 py-1.5 text-[12px]">
                <span className="text-text-secondary">{m.motivo ?? '—'}</span>
                <span className="font-semibold text-accent-red">{m.count}</span>
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

type Mode = 'dia' | 'rango'

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

  const [mode, setMode] = useState<Mode>('dia')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <BarChart3 className="w-5 h-5 text-brand-400" />
          <h1 className="text-base font-semibold text-text-primary uppercase tracking-wider">Reportes</h1>
        </div>
        <div className="inline-flex rounded-md border border-line overflow-hidden">
          {([['dia', 'Día', Calendar], ['rango', 'Rango', CalendarRange]] as const).map(([m, label, Icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold uppercase tracking-wider transition-colors',
                mode === m ? 'bg-brand-500 text-white' : 'bg-bg-700 text-text-muted hover:text-text-primary',
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'dia'
        ? <DiaReportView dias={dias} empresaMap={empresaMap} />
        : <RangeReportView empresas={empresas ?? []} dias={dias} empresaMap={empresaMap} />}
    </div>
  )
}

function DiaReportView({ dias, empresaMap }: { dias: DiaOut[]; empresaMap: Map<number, string> }) {
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
      <div className="flex justify-end">
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

      {reportQ.isLoading && <Loading />}
      {reportQ.isError && <LoadError />}

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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Entregado" value={num(r.totals.entregado)} />
            <KpiCard label="No entregado" value={num(r.totals.no_entregado)} />
            <KpiCard label="Cancelado" value={num(r.totals.cancelado)} />
            <KpiCard label="Pendiente" value={num(r.totals.pendiente)} />
          </div>

          <Breakdowns by_region={r.by_region} by_driver={r.by_driver} by_motivo={r.by_motivo} />
        </>
      )}
    </div>
  )
}

function RangeReportView({ empresas, dias, empresaMap }: {
  empresas: { empresa_id: number; nombre: string }[]
  dias: DiaOut[]
  empresaMap: Map<number, string>
}) {
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const empId = empresaId ?? empresas[0]?.empresa_id ?? null

  // Default the window to the span of known días for the chosen empresa.
  const empDias = useMemo(
    () => dias.filter((d) => d.empresa_id === empId).map((d) => d.fecha.slice(0, 10)).sort(),
    [dias, empId],
  )
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const effDesde = desde || empDias[0] || ''
  const effHasta = hasta || empDias[empDias.length - 1] || ''
  const invalid = !!effDesde && !!effHasta && effDesde > effHasta

  const reportQ = useQuery({
    queryKey: ['report', 'rango', empId, effDesde, effHasta],
    queryFn: () => getRangeReport({ query: { empresa_id: empId as number, desde: effDesde, hasta: effHasta } }),
    select: (res) => res.data as RangeReport,
    enabled: empId != null && !!effDesde && !!effHasta && !invalid,
  })
  const r = reportQ.data

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-end gap-3 flex-wrap">
        <Field label="Empresa">
          <select
            value={empId ?? ''}
            onChange={(e) => { setEmpresaId(Number(e.target.value)); setDesde(''); setHasta('') }}
            className="rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500"
          >
            {empresas.map((e) => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
          </select>
        </Field>
        <Field label="Desde">
          <input type="date" value={effDesde} onChange={(e) => setDesde(e.target.value)}
            className="rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500" />
        </Field>
        <Field label="Hasta">
          <input type="date" value={effHasta} onChange={(e) => setHasta(e.target.value)}
            className="rounded border border-line bg-bg-700 px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-brand-500" />
        </Field>
      </div>

      {invalid && (
        <div className="text-accent-red text-[13px] bg-accent-red/10 rounded px-3 py-2">
          La fecha «desde» debe ser anterior o igual a «hasta».
        </div>
      )}
      {reportQ.isLoading && <Loading />}
      {reportQ.isError && <LoadError />}

      {r && !invalid && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-text-secondary">
            <span className="font-semibold text-text-primary">{r.empresa_nombre ?? empresaMap.get(empId as number)}</span>
            <span>·</span><span>{r.desde} → {r.hasta}</span>
            <Badge variant="blue">{r.dias} {r.dias === 1 ? 'día' : 'días'}</Badge>
          </div>

          {r.dias === 0 ? (
            <div className="text-text-muted text-xs uppercase tracking-wider py-12 text-center">
              No hay días operativos en este rango
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Visitas" value={num(r.totals.visitas)} />
                <KpiCard label="Éxito de entrega" value={pct(r.totals.success_pct)} />
                <KpiCard label="Puntualidad" value={pct(r.on_time.on_time_pct)} />
                <KpiCard label="VIP" value={`${r.vip.entregado}/${r.vip.visitas}`}
                  delta={<span className="text-[11px] text-text-muted">éxito {pct(r.vip.success_pct)}</span>} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Entregado" value={num(r.totals.entregado)} />
                <KpiCard label="No entregado" value={num(r.totals.no_entregado)} />
                <KpiCard label="Cancelado" value={num(r.totals.cancelado)} />
                <KpiCard label="Pendiente" value={num(r.totals.pendiente)} />
              </div>

              <section className="space-y-2">
                <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold">Evolución diaria</h2>
                <Trend points={r.trend} />
              </section>

              <Breakdowns by_region={r.by_region} by_driver={r.by_driver} by_motivo={r.by_motivo} />
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Per-day trend: a compact table with an inline success-rate bar. */
function Trend({ points }: { points: TrendPoint[] }) {
  const maxV = Math.max(1, ...points.map((p) => p.visitas))
  return (
    <DataTable
      data={points}
      keyFn={(p) => String(p.dia_id)}
      emptyMessage="Sin días"
      columns={[
        { header: 'Fecha', accessor: (p) => p.fecha },
        { header: 'Visitas', accessor: (p) => (
            <span className="inline-flex items-center gap-2">
              <span className="tabular-nums">{p.visitas}</span>
              <span className="h-1.5 rounded bg-brand-500/60" style={{ width: `${Math.round((p.visitas / maxV) * 80)}px` }} />
            </span>
          ) },
        { header: 'Entregado', accessor: (p) => p.entregado },
        { header: 'Éxito', accessor: (p) => pct(p.success_pct) },
        { header: 'Puntualidad', accessor: (p) => pct(p.on_time_pct) },
      ]}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      {children}
    </label>
  )
}

function Loading() {
  return <div className="text-text-muted text-xs uppercase tracking-wider py-12 text-center">Cargando…</div>
}
function LoadError() {
  return <div className="text-accent-red text-[13px] bg-accent-red/10 rounded px-3 py-2">No se pudo cargar el reporte.</div>
}
