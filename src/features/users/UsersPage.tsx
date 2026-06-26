import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, createUser, updateUser, deactivateUser } from '@/api/sdk.gen'
import type { UserOut, UserCreate, UserUpdate } from '@/api'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/Badge'
import { SlidePanel } from '@/components/SlidePanel'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, Input, Select, SubmitButton } from '@/components/FormField'
import { useEmpresas } from '@/lib/use-empresas'
import { Plus, Pencil, Trash2, Shield, RotateCcw } from 'lucide-react'
import { InviteButton } from '@/components/InviteButton'
import { ActivationStatus } from '@/components/ActivationStatus'
import type { FormEvent } from 'react'

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; user: UserOut }

const ROLE_LABELS: Record<string, string> = {
  falabella_admin: 'Admin Falabella',
  falabella_ops: 'Operador Torre',
  transport_manager: 'Gerente Transporte',
}
const ROLE_COLORS: Record<string, 'blue' | 'yellow' | 'green' | 'gray'> = {
  falabella_admin: 'blue',
  falabella_ops: 'yellow',
  transport_manager: 'green',
}

export function UsersPage() {
  const qc = useQueryClient()
  const [mode, setMode] = useState<Mode>({ kind: 'closed' })
  const [delTarget, setDelTarget] = useState<UserOut | null>(null)
  const [selectedEmpresas, setSelectedEmpresas] = useState<number[]>([])
  const [showInactive, setShowInactive] = useState(false)

  const { data } = useQuery({ queryKey: ['users'], queryFn: () => listUsers() })
  const allUsers = (data?.data ?? []) as UserOut[]
  const users = showInactive ? allUsers : allUsers.filter((u) => u.activo)
  const { data: empresas } = useEmpresas()
  const empresaMap = new Map((empresas ?? []).map((e) => [e.empresa_id, e.nombre]))

  const editing = mode.kind === 'edit' ? mode.user : null

  useEffect(() => {
    if (mode.kind === 'edit') {
      setSelectedEmpresas(mode.user.empresa_ids ?? [])
    } else if (mode.kind === 'create') {
      setSelectedEmpresas([])
    }
  }, [mode])

  const createMut = useMutation({
    mutationFn: (body: UserCreate) => createUser({ body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); setMode({ kind: 'closed' }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UserUpdate }) => updateUser({ path: { user_id: id }, body }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); setMode({ kind: 'closed' }) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => deactivateUser({ path: { user_id: id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['users'] }); setDelTarget(null) },
  })

  function toggleEmpresa(id: number) {
    setSelectedEmpresas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const display_name = fd.get('display_name') as string
    const role = fd.get('role') as string
    const password = (fd.get('password') as string) || undefined

    const phone_e164 = (fd.get('phone_e164') as string) || undefined

    if (mode.kind === 'create') {
      createMut.mutate({
        email, display_name, role,
        password: password ?? 'changeme123',
        empresa_ids: selectedEmpresas,
        phone_e164,
      } as UserCreate)
    } else if (mode.kind === 'edit') {
      const body: Record<string, unknown> = { email, display_name, role: role as UserUpdate['role'], empresa_ids: selectedEmpresas, phone_e164 }
      if (password) body.password = password
      updateMut.mutate({ id: mode.user.user_id, body: body as UserUpdate })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Usuarios Plataforma</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-line" />
            Mostrar inactivos
          </label>
          <button onClick={() => setMode({ kind: 'create' })} className="flex items-center gap-1.5 bg-brand-500 text-white rounded px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-brand-600 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nuevo Usuario
          </button>
        </div>
      </div>

      <DataTable<UserOut>
        keyFn={(u) => u.user_id}
        data={users}
        rowClassName={(u) => !u.activo ? 'opacity-60' : ''}
        columns={[
          { header: '', accessor: () => (
            <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-brand-500" />
            </div>
          ), className: 'w-10' },
          { header: 'Nombre', accessor: (u) => u.display_name, className: 'font-medium' },
          { header: 'Email', accessor: (u) => u.email },
          {
            header: 'Rol',
            accessor: (u) => <Badge variant={ROLE_COLORS[u.role] ?? 'gray'}>{ROLE_LABELS[u.role] ?? u.role}</Badge>,
          },
          {
            header: 'Empresas',
            accessor: (u) => {
              if (u.role === 'falabella_admin' || u.role === 'falabella_ops') {
                if (!u.empresa_ids?.length) return <span className="text-text-muted">Todas</span>
              }
              const names = (u.empresa_ids ?? []).map((id) => empresaMap.get(id) ?? id)
              return names.length > 0
                ? <span className="text-[11px]">{names.join(', ')}</span>
                : <span className="text-text-muted">Ninguna</span>
            },
          },
          {
            header: 'WhatsApp',
            accessor: (u) => <ActivationStatus phone={u.phone_e164} activationToken={u.activation_token} optedInAt={u.activation_used_at} />,
          },
          {
            header: 'Estado',
            accessor: (u) => <Badge variant={u.activo ? 'green' : 'red'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>,
          },
          {
            header: '',
            accessor: (u) => (
              <div className="flex gap-1.5 items-center justify-end">
                <InviteButton name={u.display_name} phone={u.phone_e164} activationToken={u.activation_token} optedIn={!!u.notify_whatsapp} />
                <button onClick={() => setMode({ kind: 'edit', user: u })} className="p-1.5 hover:bg-bg-700 rounded transition-colors"><Pencil className="w-3.5 h-3.5 text-text-muted" /></button>
                {u.activo ? (
                  <button onClick={() => setDelTarget(u)} className="p-1.5 hover:bg-accent-red/10 rounded transition-colors" aria-label="Desactivar usuario"><Trash2 className="w-3.5 h-3.5 text-accent-red" /></button>
                ) : (
                  <button onClick={() => updateMut.mutate({ id: u.user_id, body: { activo: true } })} className="p-1.5 hover:bg-brand-500/10 rounded transition-colors" aria-label="Reactivar usuario"><RotateCcw className="w-3.5 h-3.5 text-brand-500" /></button>
                )}
              </div>
            ),
            className: 'w-20',
          },
        ]}
      />

      <SlidePanel open={mode.kind !== 'closed'} onClose={() => setMode({ kind: 'closed' })} title={mode.kind === 'create' ? 'Nuevo Usuario' : 'Editar Usuario'}>
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-1">
          <FormField label="Nombre completo"><Input name="display_name" required defaultValue={editing?.display_name ?? ''} /></FormField>
          <FormField label="Email"><Input name="email" type="email" required defaultValue={editing?.email ?? ''} /></FormField>
          <FormField label="Contrasena">{mode.kind === 'create' ? <Input name="password" required placeholder="Contrasena inicial" /> : <Input name="password" placeholder="Dejar vacio para no cambiar" />}</FormField>
          <FormField label="Rol">
            <Select name="role" required defaultValue={editing?.role ?? ''}>
              <option value="">Seleccionar...</option>
              <option value="falabella_admin">Admin Falabella — acceso total + configuracion</option>
              <option value="falabella_ops">Operador Torre — ve todo, sin configuracion</option>
              <option value="transport_manager">Gerente Transporte — solo empresas asignadas</option>
            </Select>
          </FormField>

          <FormField label="Telefono WhatsApp">
            <Input name="phone_e164" defaultValue={editing?.phone_e164 ?? ''} placeholder="+56912345678" />
          </FormField>

          {/* Activation link (if editing and has token) */}
          {editing?.activation_token && !editing?.notify_whatsapp && (
            <div className="bg-bg-700/50 rounded-md p-3 mb-2">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Link de activacion WhatsApp</div>
              <div className="flex gap-2">
                <input readOnly value={`https://wa.me/56957018982?text=ACTIVAR%20${editing.activation_token}`} className="flex-1 rounded border border-line bg-bg-800 px-2 py-1.5 text-[11px] text-text-secondary truncate" />
                <button type="button" onClick={() => { void navigator.clipboard.writeText(`https://wa.me/56957018982?text=ACTIVAR%20${editing.activation_token}`); }} className="rounded border border-line px-2 py-1.5 text-[11px] font-semibold text-text-primary uppercase tracking-wider hover:bg-bg-700">Copiar</button>
              </div>
            </div>
          )}

          {/* Empresa checkboxes */}
          <FormField label="Empresas asignadas">
            <div className="space-y-1.5 mt-1">
              {(empresas ?? []).map((emp) => (
                <label key={emp.empresa_id} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selectedEmpresas.includes(emp.empresa_id)}
                    onChange={() => toggleEmpresa(emp.empresa_id)}
                    className="w-4 h-4 rounded border-line text-brand-500 focus:ring-brand-500 accent-brand-500"
                  />
                  <span className="text-[13px] text-text-primary group-hover:text-brand-500 transition-colors">{emp.nombre}</span>
                  {emp.region && <span className="text-[10px] text-text-muted">{emp.region}</span>}
                </label>
              ))}
              {selectedEmpresas.length === 0 && (
                <div className="text-[11px] text-text-muted mt-1">Sin seleccion = acceso a todas (para admin/ops)</div>
              )}
            </div>
          </FormField>

          <SubmitButton loading={createMut.isPending || updateMut.isPending} />
        </form>
      </SlidePanel>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={() => delTarget && deleteMut.mutate(delTarget.user_id)} title="Desactivar Usuario" message={`Se desactivara "${delTarget?.display_name}" (${delTarget?.email}). No podra iniciar sesion.`} loading={deleteMut.isPending} />
    </div>
  )
}
