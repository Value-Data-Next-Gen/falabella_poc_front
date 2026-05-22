import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail, RefreshCw, ShieldAlert, Search, Pause, Play, Filter,
  User as UserIcon, Truck, ClipboardList, UserPlus,
} from 'lucide-react';
import {
  api,
  InvitationItem,
  InvitationState,
  InvitationTipo,
  InvitationsListOut,
} from '../api';
import { useAuth } from '../hooks/useAuth';
import { ActivationCell } from './shared/ActivationCell';
import { InviteWizardModal } from './shared/InviteWizardModal';

/** Dashboard centralizado de invitaciones wa.me.
 *
 *  Reemplaza la fragmentación de los 3 mantenedores (Usuarios / Drivers /
 *  Contactos) con una vista única sobre `GET /api/admin/invitations`.
 *  Permite filtrar por tipo/estado/empresa, buscar libre y regenerar el
 *  link de cada fila reusando los endpoints existentes según el `tipo`.
 *
 *  Auto-refresh: 30s (pausable). El usuario también puede refrescar manual.
 */
export function InvitacionesPanel() {
  const { isFalabella } = useAuth();
  const qc = useQueryClient();

  // Filtros
  const [tipo, setTipo] = useState<'todos' | InvitationTipo>('todos');
  const [state, setState] = useState<'todos' | InvitationState>('todos');
  const [empresaId, setEmpresaId] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Auto-refresh toggle
  const [autoRefresh, setAutoRefresh] = useState(true);
  // Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState<'tipo' | 'nombre' | 'empresa' | 'state'>('state');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Debounce search input (300ms)
  useEffect(() => {
    const id = window.setTimeout(() => setSearchDebounced(searchInput.trim()), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Lista de empresas para el filtro
  const empresasQ = useQuery({
    queryKey: ['invitaciones-empresas'],
    queryFn: api.empresaContactos.listEmpresas,
    enabled: isFalabella,
    staleTime: 60_000,
  });

  // Invitaciones — gate por rol, polling cada 30s si autoRefresh
  const invitationsKey = useMemo(
    () => [
      'admin-invitations',
      { tipo, state, empresaId, search: searchDebounced },
    ] as const,
    [tipo, state, empresaId, searchDebounced],
  );

  const invitationsQ = useQuery<InvitationsListOut>({
    queryKey: invitationsKey,
    queryFn: () =>
      api.admin.listInvitations({
        tipo: tipo === 'todos' ? undefined : tipo,
        state: state === 'todos' ? undefined : state,
        empresa_id: empresaId ?? undefined,
        search: searchDebounced || undefined,
        limit: 500,
      }),
    enabled: isFalabella,
    refetchInterval: autoRefresh ? 30_000 : false,
    retry: false,
  });

  // Refresca también el badge del sidebar de correcciones (no, ese es otro).
  const refetchAll = () => {
    qc.invalidateQueries({ queryKey: ['admin-invitations'] });
  };

  // Gate de rol
  if (!isFalabella) {
    return (
      <div className="panel p-6 text-center text-text-muted">
        <ShieldAlert size={32} className="mx-auto mb-2 text-accent-yellow" />
        <div>
          Esta sección requiere rol{' '}
          <span className="text-accent-yellow">falabella_admin</span> o{' '}
          <span className="text-accent-yellow">falabella_ops</span>.
        </div>
      </div>
    );
  }

  const items = invitationsQ.data?.items ?? [];
  const summary = invitationsQ.data?.summary ?? { pending: 0, activated: 0, no_link: 0 };
  const total = invitationsQ.data?.total ?? 0;

  // Sort items (server didn't sort; lo hacemos client-side sobre el set
  // filtrado ya recibido).
  const sortedItems = useMemo(() => {
    const arr = [...items];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortBy) {
        case 'tipo':    av = a.tipo;    bv = b.tipo;    break;
        case 'nombre':  av = a.nombre.toLowerCase(); bv = b.nombre.toLowerCase(); break;
        case 'empresa': av = (a.empresa_nombre ?? '').toLowerCase(); bv = (b.empresa_nombre ?? '').toLowerCase(); break;
        case 'state':   av = a.state;   bv = b.state;   break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      return 0;
    });
    return arr;
  }, [items, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  // Filtros de empresa: solo empresas que tienen al menos un contacto
  const empresaOptions = empresasQ.data ?? [];

  /** Llama al endpoint correspondiente según el tipo. El componente
   *  `ActivationCell` ya pinta toasts inline ("copiado") y abre WhatsApp; acá
   *  solo necesitamos disparar la regeneración y refrescar la lista. */
  const handleRegenerate = async (it: InvitationItem) => {
    if (it.tipo === 'user') {
      const idNum = Number(it.id);
      if (!Number.isFinite(idNum)) return;
      await api.admin.getUserActivationLink(idNum);
    } else if (it.tipo === 'driver') {
      await api.admin.getDriverActivationLink(it.id);
    } else if (it.tipo === 'contacto') {
      const cid = Number(it.id);
      if (!Number.isFinite(cid) || it.empresa_id == null) return;
      await api.empresaContactos.getActivationLink(it.empresa_id, cid);
    }
    await invitationsQ.refetch();
  };

  return (
    <div className="h-full flex flex-col p-4 gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-brand" />
          <h2 className="text-base font-semibold text-text-primary">Invitaciones</h2>
          <span className="text-[11px] text-text-muted">
            Vista unificada de activaciones WhatsApp (users / drivers / contactos)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWizardOpen(true)}
            className="btn-primary flex items-center gap-1"
            title="Crear una nueva invitación (driver, jefe o admin)"
          >
            <UserPlus size={12} /> Nueva invitación
          </button>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className="btn flex items-center gap-1"
            title={autoRefresh ? 'Pausar auto-refresh (30s)' : 'Reanudar auto-refresh (30s)'}
          >
            {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            {autoRefresh ? 'Auto 30s' : 'En pausa'}
          </button>
          <button
            onClick={refetchAll}
            disabled={invitationsQ.isFetching}
            className="btn flex items-center gap-1"
            title="Refrescar ahora"
          >
            <RefreshCw size={12} className={invitationsQ.isFetching ? 'animate-spin' : ''} />
            Refrescar
          </button>
        </div>
      </div>
      <InviteWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Summary cards (clic filtra) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <SummaryCard
          label="Pendientes"
          value={summary.pending}
          tone="yellow"
          active={state === 'pending'}
          onClick={() => setState(state === 'pending' ? 'todos' : 'pending')}
        />
        <SummaryCard
          label="Activadas"
          value={summary.activated}
          tone="green"
          active={state === 'activated'}
          onClick={() => setState(state === 'activated' ? 'todos' : 'activated')}
        />
        <SummaryCard
          label="Sin link"
          value={summary.no_link}
          tone="gray"
          active={state === 'no_link'}
          onClick={() => setState(state === 'no_link' ? 'todos' : 'no_link')}
        />
        <SummaryCard
          label="Total"
          value={total}
          tone="blue"
          active={state === 'todos'}
          onClick={() => setState('todos')}
        />
      </div>

      {/* Filtros */}
      <div className="panel p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-text-muted">
          <Filter size={12} />
          <span className="text-[11px] uppercase tracking-wider">Filtros</span>
        </div>

        <select
          value={tipo}
          onChange={e => setTipo(e.target.value as 'todos' | InvitationTipo)}
          className="input"
          title="Tipo de invitación"
        >
          <option value="todos">Todos los tipos</option>
          <option value="user">Usuarios</option>
          <option value="driver">Drivers</option>
          <option value="contacto">Contactos empresa</option>
        </select>

        <select
          value={state}
          onChange={e => setState(e.target.value as 'todos' | InvitationState)}
          className="input"
          title="Estado de la invitación"
        >
          <option value="todos">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="activated">Activadas</option>
          <option value="no_link">Sin link</option>
        </select>

        <select
          value={empresaId ?? ''}
          onChange={e => setEmpresaId(e.target.value ? Number(e.target.value) : null)}
          className="input min-w-[160px]"
          title="Filtrar por empresa transportista"
        >
          <option value="">Todas las empresas</option>
          {empresaOptions.map(emp => (
            <option key={emp.empresa_id} value={emp.empresa_id}>
              {emp.nombre}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar nombre, phone, empresa…"
            className="input pl-7 w-full"
          />
        </div>

        {(tipo !== 'todos' || state !== 'todos' || empresaId != null || searchInput) && (
          <button
            onClick={() => {
              setTipo('todos');
              setState('todos');
              setEmpresaId(null);
              setSearchInput('');
            }}
            className="btn"
            title="Limpiar filtros"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="panel flex-1 overflow-hidden flex flex-col">
        <div className="panel-title">
          <span>
            {sortedItems.length} invitaciones
            {invitationsQ.isFetching && (
              <span className="ml-2 text-text-muted normal-case tracking-normal">
                actualizando…
              </span>
            )}
          </span>
          {invitationsQ.error instanceof Error && (
            <span className="text-accent-red normal-case tracking-normal">
              Error: {invitationsQ.error.message}
            </span>
          )}
        </div>

        <div className="overflow-auto flex-1">
          {invitationsQ.isLoading ? (
            <SkeletonRows />
          ) : sortedItems.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              {invitationsQ.error
                ? 'No se pudo cargar la lista de invitaciones.'
                : 'No hay invitaciones que coincidan con los filtros.'}
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="bg-bg-700/40 sticky top-0 z-10">
                <tr className="text-text-muted text-[10px] uppercase tracking-wider">
                  <SortableTh label="Tipo"     col="tipo"    sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Nombre"   col="nombre"  sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <th className="text-left px-2 py-2">Phone</th>
                  <SortableTh label="Empresa"  col="empresa" sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <th className="text-left px-2 py-2">Rol</th>
                  <SortableTh label="Estado"   col="state"   sortBy={sortBy} sortDir={sortDir} onClick={toggleSort} />
                  <th className="text-left px-2 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map(it => (
                  <InvitationRow
                    key={`${it.tipo}-${it.id}`}
                    item={it}
                    onRegenerate={() => handleRegenerate(it)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Subcomponentes                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */

function SummaryCard({
  label, value, tone, active, onClick,
}: {
  label: string;
  value: number;
  tone: 'yellow' | 'green' | 'gray' | 'blue';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneCls =
    tone === 'yellow' ? 'border-accent-yellow/40 text-accent-yellow'
    : tone === 'green' ? 'border-accent-green/40 text-accent-green'
    : tone === 'blue'  ? 'border-accent-blue/40 text-accent-blue'
    : 'border-line text-text-secondary';

  return (
    <button
      onClick={onClick}
      className={`kpi-card text-left transition-all hover:bg-bg-700/40 ${toneCls} ${
        active ? 'ring-1 ring-brand' : ''
      }`}
    >
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone !== 'gray' ? '' : 'text-text-primary'}`}>{value}</div>
    </button>
  );
}

function SortableTh({
  label, col, sortBy, sortDir, onClick,
}: {
  label: string;
  col: 'tipo' | 'nombre' | 'empresa' | 'state';
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onClick: (c: 'tipo' | 'nombre' | 'empresa' | 'state') => void;
}) {
  const active = sortBy === col;
  return (
    <th
      onClick={() => onClick(col)}
      className={`text-left px-2 py-2 cursor-pointer select-none hover:text-text-primary ${
        active ? 'text-text-primary' : ''
      }`}
    >
      {label}{active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );
}

function InvitationRow({
  item, onRegenerate,
}: {
  item: InvitationItem;
  onRegenerate: () => Promise<void>;
}) {
  const TipoIcon = item.tipo === 'user' ? UserIcon
    : item.tipo === 'driver' ? Truck
    : ClipboardList;

  const tipoLabel = item.tipo === 'user' ? 'Usuario'
    : item.tipo === 'driver' ? 'Driver'
    : 'Contacto';

  const usedAt = item.activation_used_at;

  return (
    <tr className="border-t border-line/30 hover:bg-bg-700/30">
      <td className="px-2 py-2">
        <span className="inline-flex items-center gap-1 text-text-secondary">
          <TipoIcon size={12} />
          <span className="text-[11px]">{tipoLabel}</span>
        </span>
      </td>
      <td className="px-2 py-2 text-text-primary">
        <div className="flex flex-col leading-tight">
          <span>{item.nombre || '—'}</span>
          {!item.activo && (
            <span className="text-[9px] text-text-muted uppercase">Inactivo</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 font-mono text-[11px] text-text-secondary">
        {item.phone_e164 || '—'}
      </td>
      <td className="px-2 py-2 text-text-secondary">
        {item.empresa_nombre || (item.empresa_id != null ? `#${item.empresa_id}` : '—')}
      </td>
      <td className="px-2 py-2 text-text-muted text-[11px]">
        {item.rol || '—'}
      </td>
      <td className="px-2 py-2" title={usedAt ? `Activado el ${usedAt.slice(0, 16).replace('T', ' ')}` : undefined}>
        <StateBadge state={item.state} />
      </td>
      <td className="px-2 py-2">
        <ActivationCell
          token={item.activation_token}
          link={item.activation_link}
          usedAt={usedAt}
          onGenerate={onRegenerate}
          name={item.nombre}
          compact
        />
      </td>
    </tr>
  );
}

function StateBadge({ state }: { state: InvitationState }) {
  if (state === 'activated') return <span className="pill pill-green">Activada</span>;
  if (state === 'pending')   return <span className="pill pill-yellow">Pendiente</span>;
  return (
    <span className="pill bg-bg-700 text-text-secondary border border-line">
      Sin link
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-8 rounded bg-bg-700/40 animate-pulse"
        />
      ))}
    </div>
  );
}
