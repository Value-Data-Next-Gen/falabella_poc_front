import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listDias, createDia, ingestFalabellaXlsx } from '@/api/sdk.gen'
import type { DiaOut, DiaCreate, IngestResult } from '@/api'
import { Badge } from '@/components/Badge'
import { SlidePanel } from '@/components/SlidePanel'
import { FormField, Input, Select, SubmitButton } from '@/components/FormField'
import { useEmpresas } from '@/lib/use-empresas'
import { useAuthStore } from '@/lib/auth-store'
import { Link } from 'react-router-dom'
import { Plus, CalendarClock, Upload, CheckCircle } from 'lucide-react'
import { ESTADO_BADGE } from './lib/dia-state-machine'
import type { FormEvent } from 'react'

export function DiasListPage() {
  const qc = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const canImport = user?.role === 'falabella_admin' || user?.role === 'falabella_ops'
  const [empresaFilter, setEmpresaFilter] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<IngestResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const { data: empresas } = useEmpresas()
  const empresaMap = new Map((empresas ?? []).map((e) => [e.empresa_id, e.nombre]))

  const { data, isLoading } = useQuery({
    queryKey: ['dias', empresaFilter],
    queryFn: () => listDias(empresaFilter ? { query: { empresa_id: Number(empresaFilter) } } : {}),
  })
  const dias = (data?.data ?? []) as DiaOut[]

  // Group días by date (newest first) so an operator sees ALL empresas for a
  // given day together, instead of a flat per-empresa list.
  const grouped = useMemo(() => {
    const m = new Map<string, DiaOut[]>()
    for (const d of dias) {
      const arr = m.get(d.fecha) ?? []
      arr.push(d)
      m.set(d.fecha, arr)
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, ds]) => ({
        fecha,
        dias: [...ds].sort((a, b) =>
          (empresaMap.get(a.empresa_id) ?? '').localeCompare(empresaMap.get(b.empresa_id) ?? '')),
      }))
  }, [dias, empresaMap])

  const createMut = useMutation({
    mutationFn: (body: DiaCreate) => createDia({ body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['dias'] }); setShowCreate(false) },
  })

  const importMut = useMutation({
    mutationFn: (file: File) => ingestFalabellaXlsx({ body: { file } }),
    onSuccess: (res) => {
      const err = (res as { error?: unknown }).error
      if (err) {
        const detail =
          typeof err === 'object' && err !== null && 'detail' in err
            ? String((err as Record<string, unknown>).detail)
            : 'Error en la importacion'
        setImportError(detail)
        return
      }
      const data = (res as { data?: IngestResult }).data
      if (data) {
        setImportResult(data)
        setImportError(null)
        setTimeout(() => {
          void qc.invalidateQueries({ queryKey: ['dias'] })
          setShowImport(false)
          setImportFile(null)
          setImportResult(null)
        }, 3000)
      }
    },
    onError: (err: unknown) => {
      const detail =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>).message)
          : 'Error en la importacion'
      setImportError(detail)
    },
  })

  function handleImportSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!importFile) return
    setImportError(null)
    setImportResult(null)
    importMut.mutate(importFile)
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createMut.mutate({
      empresa_id: Number(fd.get('empresa_id')),
      fecha: fd.get('fecha') as string,
      notas: (fd.get('notas') as string) || undefined,
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Operacion</h1>
          <select value={empresaFilter} onChange={(e) => setEmpresaFilter(e.target.value)} className="rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider focus:outline-none focus:border-brand-500">
            <option value="">Todas las empresas</option>
            {(empresas ?? []).map((e) => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
          </select>
          <span className="text-[11px] text-text-muted">{dias.length} dias</span>
        </div>
        <div className="flex gap-2">
          {canImport && (
            <button onClick={() => { setShowImport(true); setImportFile(null); setImportResult(null); setImportError(null) }} className="flex items-center gap-1.5 border border-line bg-bg-700 text-text-primary rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-bg-800 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Importar Falabella XLSX
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nuevo Dia
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
      ) : dias.length === 0 ? (
        <div className="text-center py-16">
          <CalendarClock className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-[13px] text-text-secondary">Sin dias operativos</p>
          <p className="text-[11px] text-text-muted">Crea un dia para comenzar a planificar entregas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => {
            const dayEnt = g.dias.reduce((s, d) => s + (d.visitas_entregadas ?? 0), 0)
            const dayFail = g.dias.reduce((s, d) => s + (d.visitas_no_entregadas ?? 0), 0)
            const daySuccess = dayEnt + dayFail > 0 ? Math.round((dayEnt / (dayEnt + dayFail)) * 100) : null
            return (
            <div key={g.fecha}>
              <div className="flex items-baseline gap-2 mb-2 pb-1 border-b border-line/60">
                <span className="text-[12px] font-semibold text-text-primary uppercase tracking-wider">
                  {new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
                <span className="text-[10px] text-text-muted">
                  {g.dias.length} {g.dias.length === 1 ? 'empresa' : 'empresas'} · {g.dias.reduce((s, d) => s + (d.visitas_count ?? 0), 0)} visitas
                  {daySuccess != null && <span className="text-accent-green font-semibold"> · {daySuccess}% éxito</span>}
                </span>
              </div>
              <div className="space-y-2">
          {g.dias.map((d) => {
            const badge = ESTADO_BADGE[d.estado] ?? ESTADO_BADGE.BORRADOR!
            const total = d.visitas_count ?? 0
            const done = (d.visitas_entregadas ?? 0) + (d.visitas_no_entregadas ?? 0)
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <Link key={d.dia_id} to={`/operacion/${d.dia_id}`} className="block bg-bg-800 rounded-md border border-line p-4 shadow-sm hover:border-brand-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-[13px] font-semibold text-text-primary">{empresaMap.get(d.empresa_id) ?? `Empresa ${d.empresa_id}`}</div>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <div className="text-lg font-semibold text-text-primary">{d.rutas_count}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">Rutas</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-text-primary">{total}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">Visitas</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-accent-green">{d.visitas_entregadas}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">OK</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-accent-red">{d.visitas_no_entregadas}</div>
                      <div className="text-[10px] text-text-muted uppercase tracking-wider">Fail</div>
                    </div>
                    {total > 0 && (
                      <div>
                        <div className="text-lg font-semibold text-brand-500">{pct}%</div>
                        <div className="text-[10px] text-text-muted uppercase tracking-wider">Avance</div>
                      </div>
                    )}
                  </div>
                </div>
                {total > 0 && (
                  <div className="mt-3 h-1.5 bg-bg-700 rounded-full overflow-hidden">
                    <div className="h-full flex">
                      <div className="bg-accent-green h-full" style={{ width: `${((d.visitas_entregadas ?? 0) / total) * 100}%` }} />
                      <div className="bg-accent-red h-full" style={{ width: `${((d.visitas_no_entregadas ?? 0) / total) * 100}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            )
          })}
              </div>
            </div>
            )
          })}
        </div>
      )}

      <SlidePanel open={showImport} onClose={() => { if (!importMut.isPending) { setShowImport(false); setImportFile(null); setImportResult(null); setImportError(null) } }} title="Importar Falabella XLSX">
        {importResult ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-accent-green">
              <CheckCircle className="w-5 h-5" />
              <span className="text-[13px] font-semibold uppercase tracking-wider">Importacion completa</span>
            </div>
            <div className="bg-bg-700/50 rounded-md p-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Empresas procesadas</span><span className="font-semibold text-text-primary tabular-nums">{importResult.empresas_procesadas}</span></div>
              <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Rutas creadas</span><span className="font-semibold text-text-primary tabular-nums">{importResult.rutas_creadas}</span></div>
              <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Visitas creadas</span><span className="font-semibold text-text-primary tabular-nums">{importResult.visitas_creadas}</span></div>
              <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Clientes nuevos</span><span className="font-semibold text-text-primary tabular-nums">{importResult.clientes_creados}</span></div>
              <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Clientes reusados</span><span className="font-semibold text-text-primary tabular-nums">{importResult.clientes_reusados}</span></div>
              {importResult.vehiculos_creados != null && (
                <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Vehiculos creados</span><span className="font-semibold text-text-primary tabular-nums">{importResult.vehiculos_creados}</span></div>
              )}
              {importResult.drivers_creados != null && (
                <div className="flex justify-between"><span className="text-text-muted uppercase tracking-wider text-[10px]">Conductores creados</span><span className="font-semibold text-text-primary tabular-nums">{importResult.drivers_creados}</span></div>
              )}
            </div>
            {importResult.geocoding_en_progreso && (
              <p className="text-[11px] text-accent-blue">Geocoding en progreso — veras los puntos aparecer en el mapa.</p>
            )}
            {importResult.advertencias && importResult.advertencias.length > 0 && (
              <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-md p-2">
                <div className="text-[10px] text-accent-yellow uppercase tracking-wider mb-1">Advertencias</div>
                <ul className="text-[11px] text-text-secondary list-disc pl-4 space-y-0.5">
                  {importResult.advertencias.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <p className="text-[10px] text-text-muted">Cerrando automaticamente...</p>
          </div>
        ) : (
          <form onSubmit={handleImportSubmit} className="space-y-3">
            <div className="bg-bg-700/50 rounded-md p-3 text-[11px] text-text-secondary">
              El archivo debe tener sheet <span className="font-mono text-text-primary">Geo</span> con las 16 columnas del formato Falabella. Se geocodificara en background con Nominatim (puede tardar ~30-40 min).
            </div>
            <FormField label="Archivo XLSX">
              <input
                type="file"
                accept=".xlsx"
                required
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="w-full text-[12px] text-text-primary file:mr-2 file:rounded file:border file:border-line file:bg-bg-700 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:uppercase file:tracking-wider file:text-text-primary hover:file:bg-bg-800 file:cursor-pointer"
              />
            </FormField>
            <SubmitButton loading={importMut.isPending} label="Importar" />
            {importError && <p className="text-[11px] text-accent-red mt-2">{importError}</p>}
          </form>
        )}
      </SlidePanel>

      <SlidePanel open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Dia Operativo">
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-1">
          <FormField label="Empresa">
            <Select name="empresa_id" required>
              <option value="">Seleccionar...</option>
              {(empresas ?? []).map((e) => <option key={e.empresa_id} value={e.empresa_id}>{e.nombre}</option>)}
            </Select>
          </FormField>
          <FormField label="Fecha"><Input name="fecha" type="date" required /></FormField>
          <FormField label="Notas"><Input name="notas" placeholder="Notas opcionales" /></FormField>
          <SubmitButton loading={createMut.isPending} />
          {createMut.error && <p className="text-[11px] text-accent-red mt-2">Error: ya existe un dia para esa empresa y fecha</p>}
        </form>
      </SlidePanel>
    </div>
  )
}
