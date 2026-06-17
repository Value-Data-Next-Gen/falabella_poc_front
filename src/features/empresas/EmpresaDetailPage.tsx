import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getEmpresa, getEmpresaSummary,
  listEmpresaContactos, createEmpresaContacto, updateEmpresaContacto, deactivateEmpresaContacto,
  listDrivers, createDriver, updateDriver, deactivateDriver,
  listVehicles, createVehicle, updateVehicle, deactivateVehicle,
  bulkImportConductores, bulkImportVehiculos, bulkImportContactos,
} from '@/api/sdk.gen'
import type {
  EmpresaContactoOut, EmpresaContactoCreate, EmpresaContactoUpdate,
  DriverOut, DriverCreate, DriverUpdate,
  VehicleOut, VehicleCreate, VehicleUpdate,
  ImportResult,
} from '@/api'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { SlidePanel } from '@/components/SlidePanel'
import { BulkUpload } from '@/components/BulkUpload'
import { DocumentsTab } from '@/components/DocumentsTab'
import { DriverDetailPanel } from '@/components/DriverDetailPanel'
import { ContactoDetailPanel } from '@/components/ContactoDetailPanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, Input, Select, SubmitButton } from '@/components/FormField'
import { Users, Truck, Contact, FileText, Plus, Pencil, Trash2 } from 'lucide-react'
import { InviteButton } from '@/components/InviteButton'
import { ActivationStatus } from '@/components/ActivationStatus'
import { clsx } from 'clsx'
import type { FormEvent } from 'react'

type Tab = 'conductores' | 'vehiculos' | 'contactos' | 'documentos'

export function EmpresaDetailPage() {
  const { empresaId } = useParams()
  const id = Number(empresaId)
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const _qtab = searchParams.get('tab')
  const [tab, setTab] = useState<Tab>(
    (['conductores', 'vehiculos', 'contactos', 'documentos'].includes(_qtab ?? '') ? _qtab : 'conductores') as Tab,
  )

  const empresa = useQuery({ queryKey: ['empresa', id], queryFn: () => getEmpresa({ path: { empresa_id: id } }) })
  const summary = useQuery({ queryKey: ['empresa-summary', id], queryFn: () => getEmpresaSummary({ path: { empresa_id: id } }) })

  const e = empresa.data?.data
  const s = summary.data?.data

  if (empresa.isLoading) return <div className="text-[11px] text-text-muted uppercase tracking-wider">Cargando...</div>
  if (!e) return <div className="text-[11px] text-accent-red">Empresa no encontrada</div>

  const tabs: { key: Tab; label: string; icon: typeof Users; count: number }[] = [
    { key: 'conductores', label: 'Conductores', icon: Users, count: s?.drivers_total ?? 0 },
    { key: 'vehiculos', label: 'Vehiculos', icon: Truck, count: s?.vehicles_total ?? 0 },
    { key: 'contactos', label: 'Contactos', icon: Contact, count: s?.contactos_total ?? 0 },
    { key: 'documentos', label: 'Documentos', icon: FileText, count: 0 },
  ]

  const activeTab = tabs.find((t) => t.key === tab)

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-6">
        <Link to="/empresas" className="text-text-muted hover:text-brand-500 transition-colors">Empresas</Link>
        <span className="text-text-muted">/</span>
        <span className="text-text-secondary">{e.nombre}</span>
        <span className="text-text-muted">/</span>
        <span className="text-brand-500 font-semibold">{activeTab?.label}</span>
      </nav>

      {/* Empresa header card */}
      <div className="bg-bg-800 rounded-md border border-line p-5 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-1">{e.nombre}</h1>
            <p className="text-[12px] text-text-secondary">{e.razon_social}</p>
            <div className="flex gap-4 mt-2 text-[11px] text-text-muted">
              <span>RUT {e.rut}</span>
              {e.region && <span>{e.region}{e.comuna ? `, ${e.comuna}` : ''}</span>}
              {e.central_phone && <span>Tel {e.central_phone}</span>}
            </div>
          </div>
          {/* Mini stats */}
          {s && (
            <div className="flex gap-4">
              {tabs.slice(0, 3).map((t) => (
                <div key={t.key} className="text-center">
                  <div className="text-lg font-semibold text-text-primary">{t.count}</div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">{t.label.substring(0, 5)}.</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center border-b border-line mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-[11px] uppercase tracking-wider transition-colors border-b-2 -mb-px',
              tab === t.key
                ? 'border-brand-500 text-brand-500 font-semibold'
                : 'border-transparent text-text-muted hover:text-text-primary hover:border-line',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.count > 0 && <span className="text-[10px] bg-bg-700 rounded-full px-1.5 py-0.5">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-8">
        {tab === 'conductores' && <DriversTab empresaId={id} qc={qc} />}
        {tab === 'vehiculos' && <VehiclesTab empresaId={id} qc={qc} />}
        {tab === 'contactos' && <ContactosTab empresaId={id} qc={qc} />}
        {tab === 'documentos' && <DocumentsTab entityType="empresa" entityId={String(id)} />}
      </div>
    </div>
  )
}

/* ─── Drivers Tab ─── */

function DriversTab({ empresaId, qc }: { empresaId: number; qc: ReturnType<typeof useQueryClient> }) {
  const [panel, setPanel] = useState<{ kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; d: DriverOut }>({ kind: 'closed' })
  const [detailDriver, setDetailDriver] = useState<DriverOut | null>(null)
  const [del, setDel] = useState<DriverOut | null>(null)

  const { data } = useQuery({ queryKey: ['drivers'], queryFn: () => listDrivers() })
  const drivers = (data?.data ?? []).filter((d: DriverOut) => d.empresa_id === empresaId)

  const { data: vehData } = useQuery({ queryKey: ['vehicles'], queryFn: () => listVehicles() })
  const allVehicles = (vehData?.data ?? []).filter((v: VehicleOut) => v.empresa_id === empresaId && v.activo)
  const vehicleMap = new Map(allVehicles.map((v) => [v.vehicle_id, v]))
  const assignedVehicleIds = new Set(drivers.filter((d) => d.vehicle_id && d.activo).map((d) => d.vehicle_id))

  const editing = panel.kind === 'edit' ? panel.d : null
  const availableVehicles = allVehicles.filter(
    (v) => !assignedVehicleIds.has(v.vehicle_id) || v.vehicle_id === editing?.vehicle_id,
  )

  const createMut = useMutation({
    mutationFn: (body: DriverCreate) => createDriver({ body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['drivers'] }); void qc.invalidateQueries({ queryKey: ['empresa-summary', empresaId] }); setPanel({ kind: 'closed' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: DriverUpdate }) => updateDriver({ path: { driver_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['drivers'] }); setPanel({ kind: 'closed' }) },
  })
  const delMut = useMutation({
    mutationFn: (id: string) => deactivateDriver({ path: { driver_id: id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['drivers'] }); void qc.invalidateQueries({ queryKey: ['empresa-summary', empresaId] }); setDel(null) },
  })

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const vehicleVal = fd.get('vehicle_id') as string
    if (panel.kind === 'create') {
      createMut.mutate({ empresa_id: empresaId, nombre: fd.get('nombre') as string, phone_e164: (fd.get('phone_e164') as string) || undefined, rut: (fd.get('rut') as string) || undefined, vehicle_id: vehicleVal ? Number(vehicleVal) : undefined })
    } else if (panel.kind === 'edit') {
      updateMut.mutate({ id: panel.d.driver_id, body: { nombre: fd.get('nombre') as string, phone_e164: (fd.get('phone_e164') as string) || undefined, rut: (fd.get('rut') as string) || undefined, vehicle_id: vehicleVal ? Number(vehicleVal) : null } })
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4" /> Conductores ({drivers.length})</h2>
        <div className="flex gap-2">
          <BulkUpload entity="Conductores" templateUrl="/api/v1/templates/conductores" uploadFn={async (f) => { const r = await bulkImportConductores({ path: { empresa_id: empresaId }, body: { file: f } }); return r.data as unknown as ImportResult }} invalidateKeys={[['drivers'], ['empresa-summary', String(empresaId)]]} />
          <button onClick={() => setPanel({ kind: 'create' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>
      <DataTable<DriverOut> keyFn={(d) => d.driver_id} data={drivers} emptyMessage="Sin conductores" columns={[
        { header: 'ID', accessor: (d) => <span className="font-mono text-[11px] text-text-secondary">{d.driver_id}</span>, className: 'w-24' },
        { header: 'Nombre', accessor: (d) => <button onClick={() => setDetailDriver(d)} className="text-brand-500 hover:text-brand-600 font-medium">{d.nombre}</button> },
        { header: 'Telefono', accessor: (d) => d.phone_e164 ?? '—' },
        { header: 'Vehiculo', accessor: (d) => { const v = d.vehicle_id ? vehicleMap.get(d.vehicle_id) : null; return v ? `${v.plate} (${v.nombre})` : '—' } },
        { header: 'RUT', accessor: (d) => d.rut ?? '—' },
        { header: 'WhatsApp', accessor: (d) => <ActivationStatus phone={d.phone_e164} activationToken={d.activation_token} optedInAt={d.opted_in_at} /> },
        { header: '', accessor: (d) => (
          <div className="flex gap-1.5 items-center justify-end">
            <InviteButton name={d.nombre} phone={d.phone_e164} activationToken={d.activation_token} optedIn={!!d.opted_in_at} />
            <button onClick={() => setPanel({ kind: 'edit', d })} className="p-1.5 hover:bg-bg-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-text-muted" /></button>
            {d.activo && <button onClick={() => setDel(d)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5 text-accent-red" /></button>}
          </div>
        ), className: 'w-36' },
      ]} />
      <SlidePanel open={panel.kind !== 'closed'} onClose={() => setPanel({ kind: 'closed' })} title={panel.kind === 'create' ? 'Nuevo Conductor' : 'Editar Conductor'}>
        <form onSubmit={(ev) => handleSubmit(ev)} className="space-y-1">
          <FormField label="Nombre"><Input name="nombre" required defaultValue={editing?.nombre ?? ''} /></FormField>
          <FormField label="Telefono (E.164)"><Input name="phone_e164" defaultValue={editing?.phone_e164 ?? ''} placeholder="+56912345678" /></FormField>
          <FormField label="RUT"><Input name="rut" defaultValue={editing?.rut ?? ''} placeholder="12.345.678-9" /></FormField>
          <FormField label="Vehiculo">
            <Select name="vehicle_id" defaultValue={editing?.vehicle_id ?? ''}>
              <option value="">Sin vehiculo asignado</option>
              {availableVehicles.map((v) => <option key={v.vehicle_id} value={v.vehicle_id}>{v.plate} — {v.nombre} ({v.tipo ?? ''})</option>)}
            </Select>
          </FormField>
          <SubmitButton loading={createMut.isPending || updateMut.isPending} />
        </form>
      </SlidePanel>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && delMut.mutate(del.driver_id)} title="Desactivar Conductor" message={`Se desactivara "${del?.nombre}".`} loading={delMut.isPending} />
      <DriverDetailPanel driver={detailDriver} onClose={() => setDetailDriver(null)} />
    </>
  )
}

/* ─── Vehicles Tab ─── */

function VehiclesTab({ empresaId, qc }: { empresaId: number; qc: ReturnType<typeof useQueryClient> }) {
  const [panel, setPanel] = useState<{ kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; v: VehicleOut }>({ kind: 'closed' })
  const [del, setDel] = useState<VehicleOut | null>(null)

  const { data } = useQuery({ queryKey: ['vehicles'], queryFn: () => listVehicles() })
  const vehicles = (data?.data ?? []).filter((v: VehicleOut) => v.empresa_id === empresaId)

  const createMut = useMutation({
    mutationFn: (body: VehicleCreate) => createVehicle({ body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['vehicles'] }); void qc.invalidateQueries({ queryKey: ['empresa-summary', empresaId] }); setPanel({ kind: 'closed' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: VehicleUpdate }) => updateVehicle({ path: { vehicle_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['vehicles'] }); setPanel({ kind: 'closed' }) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => deactivateVehicle({ path: { vehicle_id: id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['vehicles'] }); void qc.invalidateQueries({ queryKey: ['empresa-summary', empresaId] }); setDel(null) },
  })

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const nombre = fd.get('nombre') as string
    const plate = fd.get('plate') as string
    const tipo = (fd.get('tipo') as string) || undefined
    const cap = fd.get('capacity_m3') ? Number(fd.get('capacity_m3')) : undefined
    const descripcion = (fd.get('descripcion') as string) || undefined
    if (panel.kind === 'create') createMut.mutate({ empresa_id: empresaId, nombre, plate, tipo, capacity_m3: cap, descripcion })
    else if (panel.kind === 'edit') updateMut.mutate({ id: panel.v.vehicle_id, body: { nombre, plate, tipo, capacity_m3: cap, descripcion } })
  }

  const editing = panel.kind === 'edit' ? panel.v : null

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2"><Truck className="w-4 h-4" /> Vehiculos ({vehicles.length})</h2>
        <div className="flex gap-2">
          <BulkUpload entity="Vehiculos" templateUrl="/api/v1/templates/vehiculos" uploadFn={async (f) => { const r = await bulkImportVehiculos({ path: { empresa_id: empresaId }, body: { file: f } }); return r.data as unknown as ImportResult }} invalidateKeys={[['vehicles'], ['empresa-summary', String(empresaId)]]} />
          <button onClick={() => setPanel({ kind: 'create' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>
      <DataTable<VehicleOut> keyFn={(v) => v.vehicle_id} data={vehicles} emptyMessage="Sin vehiculos" columns={[
        { header: 'ID', accessor: (v) => v.vehicle_id, className: 'w-12' },
        { header: 'Nombre', accessor: (v) => v.nombre, className: 'font-medium' },
        { header: 'Patente', accessor: (v) => v.plate },
        { header: 'Tipo', accessor: (v) => v.tipo ?? '—' },
        { header: 'Cap. m3', accessor: (v) => v.capacity_m3 ?? '—', className: 'text-right' },
        { header: '', accessor: (v) => (
          <div className="flex gap-1 justify-end">
            <button onClick={() => setPanel({ kind: 'edit', v })} className="p-1.5 hover:bg-bg-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-text-muted" /></button>
            {v.activo && <button onClick={() => setDel(v)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5 text-accent-red" /></button>}
          </div>
        ), className: 'w-20' },
      ]} />
      <SlidePanel open={panel.kind !== 'closed'} onClose={() => setPanel({ kind: 'closed' })} title={panel.kind === 'create' ? 'Nuevo Vehiculo' : 'Editar Vehiculo'}>
        <form onSubmit={(ev) => handleSubmit(ev)} className="space-y-1">
          <FormField label="Nombre"><Input name="nombre" required defaultValue={editing?.nombre ?? ''} /></FormField>
          <FormField label="Patente"><Input name="plate" required defaultValue={editing?.plate ?? ''} /></FormField>
          <FormField label="Tipo"><Input name="tipo" defaultValue={editing?.tipo ?? ''} placeholder="Furgon Mediano" /></FormField>
          <FormField label="Capacidad m3"><Input name="capacity_m3" type="number" defaultValue={editing?.capacity_m3 ?? ''} /></FormField>
          <FormField label="Descripcion"><Input name="descripcion" defaultValue={editing?.descripcion ?? ''} placeholder="Hyundai Porter 2024 blanco" /></FormField>
          <SubmitButton loading={createMut.isPending || updateMut.isPending} />
        </form>
      </SlidePanel>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && delMut.mutate(del.vehicle_id)} title="Desactivar Vehiculo" message={`Se desactivara "${del?.nombre}" (${del?.plate}).`} loading={delMut.isPending} />
    </>
  )
}

/* ─── Contactos Tab ─── */

function ContactosTab({ empresaId, qc }: { empresaId: number; qc: ReturnType<typeof useQueryClient> }) {
  const [panel, setPanel] = useState<{ kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; c: EmpresaContactoOut }>({ kind: 'closed' })
  const [del, setDel] = useState<EmpresaContactoOut | null>(null)
  const [detailContacto, setDetailContacto] = useState<EmpresaContactoOut | null>(null)

  const { data } = useQuery({ queryKey: ['contactos', empresaId], queryFn: () => listEmpresaContactos({ path: { empresa_id: empresaId } }) })
  const contactos = (data?.data ?? []) as EmpresaContactoOut[]

  const createMut = useMutation({
    mutationFn: (body: EmpresaContactoCreate) => createEmpresaContacto({ path: { empresa_id: empresaId }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['contactos', empresaId] }); void qc.invalidateQueries({ queryKey: ['empresa-summary', empresaId] }); setPanel({ kind: 'closed' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: EmpresaContactoUpdate }) => updateEmpresaContacto({ path: { empresa_id: empresaId, contact_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['contactos', empresaId] }); setPanel({ kind: 'closed' }) },
  })
  const delMut = useMutation({
    mutationFn: (id: number) => deactivateEmpresaContacto({ path: { empresa_id: empresaId, contact_id: id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['contactos', empresaId] }); void qc.invalidateQueries({ queryKey: ['empresa-summary', empresaId] }); setDel(null) },
  })

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    const fd = new FormData(ev.currentTarget)
    const nombre = fd.get('nombre') as string
    const rol = fd.get('rol') as 'jefe' | 'coordinador' | 'otro'
    const phone_e164 = (fd.get('phone_e164') as string) || undefined
    const email = (fd.get('email') as string) || undefined
    if (panel.kind === 'create') createMut.mutate({ nombre, rol, phone_e164, email })
    else if (panel.kind === 'edit') updateMut.mutate({ id: panel.c.contact_id, body: { nombre, rol, phone_e164, email } })
  }

  const editing = panel.kind === 'edit' ? panel.c : null

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[12px] font-semibold text-text-primary uppercase tracking-wider flex items-center gap-2"><Contact className="w-4 h-4" /> Contactos ({contactos.length})</h2>
        <div className="flex gap-2">
          <BulkUpload entity="Contactos" templateUrl="/api/v1/templates/contactos" uploadFn={async (f) => { const r = await bulkImportContactos({ path: { empresa_id: empresaId }, body: { file: f } }); return r.data as unknown as ImportResult }} invalidateKeys={[['contactos', String(empresaId)], ['empresa-summary', String(empresaId)]]} />
          <button onClick={() => setPanel({ kind: 'create' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>
      <DataTable<EmpresaContactoOut> keyFn={(c) => c.contact_id} data={contactos} emptyMessage="Sin contactos" columns={[
        { header: 'Nombre', accessor: (c) => <button onClick={() => setDetailContacto(c)} className="text-brand-500 hover:text-brand-600 font-medium">{c.nombre}</button> },
        { header: 'Rol', accessor: (c) => { const labels: Record<string, string> = { jefe: 'Jefe', coordinador: 'Coordinador', otro: 'Otro' }; return <Badge variant={c.rol === 'jefe' ? 'blue' : c.rol === 'coordinador' ? 'yellow' : 'gray'}>{labels[c.rol] ?? c.rol}</Badge> } },
        { header: 'Telefono', accessor: (c) => c.phone_e164 ?? '—' },
        { header: 'Email', accessor: (c) => c.email ?? '—' },
        { header: 'WhatsApp', accessor: (c) => <ActivationStatus phone={c.phone_e164} activationToken={c.activation_token} optedInAt={c.opted_in_at} /> },
        { header: '', accessor: (c) => (
          <div className="flex gap-1.5 items-center justify-end">
            <InviteButton name={c.nombre} phone={c.phone_e164} activationToken={c.activation_token} optedIn={!!c.opted_in_at} />
            <button onClick={() => setPanel({ kind: 'edit', c })} className="p-1.5 hover:bg-bg-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-text-muted" /></button>
            {c.activo && <button onClick={() => setDel(c)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5 text-accent-red" /></button>}
          </div>
        ), className: 'w-36' },
      ]} />
      <SlidePanel open={panel.kind !== 'closed'} onClose={() => setPanel({ kind: 'closed' })} title={panel.kind === 'create' ? 'Nuevo Contacto' : 'Editar Contacto'}>
        <form onSubmit={(ev) => handleSubmit(ev)} className="space-y-1">
          <FormField label="Nombre"><Input name="nombre" required defaultValue={editing?.nombre ?? ''} /></FormField>
          <FormField label="Rol">
            <Select name="rol" required defaultValue={editing?.rol ?? ''}>
              <option value="">Seleccionar...</option>
              <option value="jefe">Jefe</option>
              <option value="coordinador">Coordinador</option>
              <option value="otro">Otro</option>
            </Select>
          </FormField>
          <FormField label="Telefono (E.164)"><Input name="phone_e164" defaultValue={editing?.phone_e164 ?? ''} placeholder="+56912345678" /></FormField>
          <FormField label="Email"><Input name="email" type="email" defaultValue={editing?.email ?? ''} /></FormField>
          <SubmitButton loading={createMut.isPending || updateMut.isPending} />
        </form>
      </SlidePanel>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={() => del && delMut.mutate(del.contact_id)} title="Desactivar Contacto" message={`Se desactivara "${del?.nombre}".`} loading={delMut.isPending} />
      <ContactoDetailPanel contacto={detailContacto} onClose={() => setDetailContacto(null)} />
    </>
  )
}
