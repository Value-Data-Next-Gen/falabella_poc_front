import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarClock,
  Building2,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Radio,
  Contact,
  Bell,
  Globe,
  BarChart3,
} from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  adminOnly?: boolean
}

const nav: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/operacion', icon: CalendarClock, label: 'Operacion' },
  { to: '/mapa-operativo', icon: Globe, label: 'Mapa Operativo' },
  { to: '/alertas', icon: Bell, label: 'Alertas' },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
  { to: '/empresas', icon: Building2, label: 'Empresas' },
]

const maestrosNav: NavItem[] = [
  { to: '/maestro/clientes', icon: Contact, label: 'Clientes' },
]

const adminNav: NavItem[] = [
  { to: '/usuarios', icon: Users, label: 'Usuarios', adminOnly: true },
  { to: '/motivos', icon: ClipboardList, label: 'Motivos', adminOnly: true },
  { to: '/configuracion', icon: Settings, label: 'Configuracion', adminOnly: true },
]

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'falabella_admin'


  return (
    <aside className="w-56 bg-sidebar flex flex-col min-h-screen border-r border-white/5">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <div className="w-7 h-7 rounded bg-brand-500 flex items-center justify-center">
          <Radio className="w-4 h-4 text-white" />
        </div>
        <span className="text-sidebar-text-active font-semibold text-xs uppercase tracking-wider">
          Torre de Control
        </span>
      </div>

      <nav className="flex-1 py-2">
        <div className="space-y-px">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-2 text-xs uppercase tracking-wider transition-colors',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 font-medium'
                    : 'text-sidebar-text hover:bg-sidebar-hover/50 hover:text-sidebar-text-active',
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="mx-4 my-3 border-t border-white/10" />
        <div className="px-4 mb-1">
          <span className="text-[9px] text-sidebar-text/50 uppercase tracking-widest">Maestros</span>
        </div>
        <div className="space-y-px">
          {maestrosNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-4 py-2 text-xs uppercase tracking-wider transition-colors',
                  isActive
                    ? 'bg-brand-500/15 text-brand-400 font-medium'
                    : 'text-sidebar-text hover:bg-sidebar-hover/50 hover:text-sidebar-text-active',
                )
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="mx-4 my-3 border-t border-white/10" />
            <div className="px-4 mb-1">
              <span className="text-[9px] text-sidebar-text/50 uppercase tracking-widest">Administracion</span>
            </div>
            <div className="space-y-px">
              {adminNav.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-4 py-2 text-xs uppercase tracking-wider transition-colors',
                      isActive
                        ? 'bg-brand-500/15 text-brand-400 font-medium'
                        : 'text-sidebar-text hover:bg-sidebar-hover/50 hover:text-sidebar-text-active',
                    )
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="w-8 h-8 rounded-full bg-sidebar-hover flex items-center justify-center text-sidebar-text-active text-xs font-semibold mb-2">
          {user?.display_name?.charAt(0) ?? '?'}
        </div>
        <div className="text-xs text-sidebar-text-active mb-0.5 truncate">
          {user?.display_name}
        </div>
        <div className="text-[10px] text-sidebar-text mb-3 truncate uppercase tracking-wider">
          {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
        </div>
        <button
          onClick={() => void logout()}
          className="flex items-center gap-2 text-[11px] text-sidebar-text hover:text-accent-red transition-colors uppercase tracking-wider"
        >
          <LogOut className="w-3.5 h-3.5" />
          Salir
        </button>
      </div>
    </aside>
  )
}

const ROLE_LABELS: Record<string, string> = {
  falabella_admin: 'Admin Falabella',
  falabella_ops: 'Operador Torre',
  transport_manager: 'Gerente Transporte',
}
