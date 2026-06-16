import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmpresas, createEmpresa, updateEmpresa, deactivateEmpresa, bulkImportEmpresas, getEmpresaSummary } from '@/api/sdk.gen'
import type { EmpresaOut, EmpresaCreate, EmpresaUpdate, ImportResult, EmpresaSummary } from '@/api'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { SlidePanel } from '@/components/SlidePanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, Input, SubmitButton } from '@/components/FormField'
import { BulkUpload } from '@/components/BulkUpload'
import { useAuthStore } from '@/lib/auth-store'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, LayoutGrid, List, Building2, Users, Truck, Contact, MapPin } from 'lucide-react'
import { clsx } from 'clsx'
import type { FormEvent } from 'react'

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; empresa: EmpresaOut }
type ViewMode = 'table' | 'cards'

function EmpresaCard({ empresa, onEdit, onDelete }: { empresa: EmpresaOut; onEdit: () => void; onDelete: () => void }) {
  const { data } = useQuery({
    queryKey: ['empresa-summary', empresa.empresa_id],
    queryFn: () => getEmpresaSummary({ path: { empresa_id: empresa.empresa_id } }),
  })
  const s = data?.data as EmpresaSummary | undefined

  return (
    <div className="bg-bg-800 rounded-md border border-line shadow-sm hover:border-brand-300 transition-colors">
      <Link to={`/empresas/${empresa.empresa_id}`} className="block p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13px] font-medium text-text-primary truncate">{empresa.nombre}</span>
              <Badge variant={empresa.activo ? 'green' : 'red'}>{empresa.activo ? 'Activo' : 'Inactivo'}</Badge>
            </div>
            <div className="text-[11px] text-text-muted">{empresa.rut}</div>
            {empresa.region && (
              <div className="flex items-center gap-1 mt-1 text-[11px] text-text-secondary">
                <MapPin className="w-3 h-3" /> {empresa.region}{empresa.comuna ? `, ${empresa.comuna}` : ''}
              </div>
            )}
          </div>
        </div>
        {s && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-line/50">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-text-muted uppercase tracking-wider"><Users className="w-3 h-3" /> Cond.</div>
              <div className="text-[14px] font-semibold text-text-primary">{s.drivers_total}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-text-muted uppercase tracking-wider"><Truck className="w-3 h-3" /> Veh.</div>
              <div className="text-[14px] font-semibold text-text-primary">{s.vehicles_total}</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] text-text-muted uppercase tracking-wider"><Contact className="w-3 h-3" /> Cont.</div>
              <div className="text-[14px] font-semibold text-text-primary">{s.contactos_total}</div>
            </div>
          </div>
        )}
      </Link>
      <div className="flex border-t border-line/50">
        <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-text-muted hover:text-brand-500 hover:bg-bg-700/50 transition-colors uppercase tracking-wider">
          <Pencil className="w-3 h-3" /> Editar
        </button>
        {empresa.activo && (
          <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] text-text-muted hover:text-accent-red hover:bg-accent-red/5 transition-colors uppercase tracking-wider border-l border-line/50">
            <Trash2 className="w-3 h-3" /> Desactivar
          </button>
        )}
      </div>
    </div>
  )
}

export function EmpresasPage() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })
  const [delTarget, setDelTarget] = useState<EmpresaOut | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const { data, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => listEmpresas(),
  })
  const allEmpresas = data?.data ?? []
  const regions = [...new Set(allEmpresas.map((e) => e.region).filter(Boolean))] as string[]
  const empresas = regionFilter ? allEmpresas.filter((e) => e.region === regionFilter) : allEmpresas

  const createMut = useMutation({
    mutationFn: (body: EmpresaCreate) => createEmpresa({ body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['empresas'] }); setMode({ kind: 'closed' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: EmpresaUpdate }) =>
      updateEmpresa({ path: { empresa_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['empresas'] }); setMode({ kind: 'closed' }) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => deactivateEmpresa({ path: { empresa_id: id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['empresas'] }); setDelTarget(null) },
  })

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nombre = fd.get('nombre') as string
    const rut = fd.get('rut') as string
    const razon_social = (fd.get('razon_social') as string) || undefined
    const region = (fd.get('region') as string) || undefined
    const comuna = (fd.get('comuna') as string) || undefined
    const central_phone = (fd.get('central_phone') as string) || undefined

    if (mode.kind === 'create') {
      createMut.mutate({ nombre, rut, razon_social, region, comuna, central_phone })
    } else if (mode.kind === 'edit') {
      updateMut.mutate({ id: mode.empresa.empresa_id, body: { nombre, rut, razon_social, region, comuna, central_phone } })
    }
  }

  const editing = mode.kind === 'edit' ? mode.empresa : null
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'falabella_admin'

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Empresas</h1>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="rounded border border-line bg-bg-700 px-2 py-1 text-[11px] text-text-primary uppercase tracking-wider focus:outline-none focus:border-brand-500"
          >
            <option value="">Todas las regiones</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="text-[11px] text-text-muted">{empresas.length} registros</span>
          {/* View toggle */}
          <div className="flex border border-line rounded overflow-hidden">
            <button
              onClick={() => setViewMode('cards')}
              className={clsx('p-1.5 transition-colors', viewMode === 'cards' ? 'bg-brand-500/15 text-brand-500' : 'text-text-muted hover:bg-bg-700')}
              title="Vista tarjetas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx('p-1.5 transition-colors border-l border-line', viewMode === 'table' ? 'bg-brand-500/15 text-brand-500' : 'text-text-muted hover:bg-bg-700')}
              title="Vista tabla"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <BulkUpload entity="Empresas" templateUrl="/api/v1/templates/empresas" uploadFn={async (f) => { const res = await bulkImportEmpresas({ body: { file: f } }); return res.data as unknown as ImportResult }} invalidateKeys={[['empresas']]} />
          )}
          <button onClick={() => setMode({ kind: 'create' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {empresas.map((e) => (
            <EmpresaCard
              key={e.empresa_id}
              empresa={e}
              onEdit={() => setMode({ kind: 'edit', empresa: e })}
              onDelete={() => setDelTarget(e)}
            />
          ))}
          {empresas.length === 0 && <div className="col-span-full text-center py-12 text-[11px] text-text-muted uppercase tracking-wider">Sin empresas</div>}
        </div>
      ) : (
        <DataTable<EmpresaOut>
          keyFn={(e) => e.empresa_id}
          data={empresas}
          columns={[
            { header: 'ID', accessor: (e) => e.empresa_id, className: 'w-12' },
            {
              header: 'Nombre',
              accessor: (e) => (
                <Link to={`/empresas/${e.empresa_id}`} className="text-brand-500 hover:text-brand-600 font-medium">
                  {e.nombre}
                </Link>
              ),
            },
            { header: 'RUT', accessor: (e) => e.rut ?? '—' },
            { header: 'Region', accessor: (e) => e.region ?? '—' },
            { header: 'Telefono', accessor: (e) => e.central_phone ?? '—' },
            {
              header: 'Estado',
              accessor: (e) => <Badge variant={e.activo ? 'green' : 'red'}>{e.activo ? 'Activo' : 'Inactivo'}</Badge>,
            },
            {
              header: '',
              accessor: (e) => (
                <div className="flex gap-1 justify-end">
                  <button onClick={() => setMode({ kind: 'edit', empresa: e })} className="p-1.5 hover:bg-bg-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-text-muted" /></button>
                  {e.activo && <button onClick={() => setDelTarget(e)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5 text-accent-red" /></button>}
                </div>
              ),
              className: 'w-20',
            },
          ]}
        />
      )}

      <SlidePanel open={mode.kind !== 'closed'} onClose={() => setMode({ kind: 'closed' })} title={mode.kind === 'create' ? 'Nueva Empresa' : 'Editar Empresa'}>
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-1">
          <FormField label="Nombre"><Input name="nombre" required defaultValue={editing?.nombre ?? ''} /></FormField>
          <FormField label="RUT"><Input name="rut" required defaultValue={editing?.rut ?? ''} placeholder="12.345.678-9" /></FormField>
          <FormField label="Razon Social"><Input name="razon_social" defaultValue={editing?.razon_social ?? ''} /></FormField>
          <FormField label="Region"><Input name="region" defaultValue={editing?.region ?? ''} placeholder="Metropolitana de Santiago" /></FormField>
          <FormField label="Comuna"><Input name="comuna" defaultValue={editing?.comuna ?? ''} placeholder="Santiago" /></FormField>
          <FormField label="Telefono Central"><Input name="central_phone" defaultValue={editing?.central_phone ?? ''} placeholder="+56..." /></FormField>
          <SubmitButton loading={createMut.isPending || updateMut.isPending} />
          {(createMut.error || updateMut.error) && <p className="text-[11px] text-accent-red mt-2">Error al guardar</p>}
        </form>
      </SlidePanel>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => delTarget && deleteMut.mutate(delTarget.empresa_id)} title="Desactivar Empresa" message={`Se desactivara "${delTarget?.nombre}". Los conductores y vehiculos asociados no se eliminan.`} loading={deleteMut.isPending} />
    </div>
  )
}
