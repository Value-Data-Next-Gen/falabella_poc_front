import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCommandCenter, ackAlert, releaseAlert, updateAlert, notifyDriverVisita } from '@/api/sdk.gen'
import type { CommandCenter, ExceptionItem, RouteHealth } from '@/api'
import { useAuthStore } from '@/lib/auth-store'
import { LayoutDashboard, AlertTriangle, Clock, CheckCircle2, Hand, ArrowUpRight, MessageCircle } from 'lucide-react'
import { clsx } from 'clsx'

const SEV: Record<string, { bg: string; label: string }> = {
  critica: { bg: 'bg-accent-red text-white', label: 'CRÍTICA' },
  alta: { bg: 'bg-orange-500 text-white', label: 'ALTA' },
  media: { bg: 'bg-accent-yellow/30 text-accent-yellow', label: 'MEDIA' },
  baja: { bg: 'bg-bg-700 text-text-muted', label: 'BAJA' },
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-line bg-bg-800 p-3">
      <div className={clsx('text-2xl font-semibold', tone ?? 'text-text-primary')}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted mt-0.5">{label}</div>
    </div>
  )
}

export function CentroControlPage() {
  const qc = useQueryClient()
  const me = useAuthStore((s) => s.user)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['command-center'],
    queryFn: () => getCommandCenter(),
    select: (r) => r.data as CommandCenter,
    refetchInterval: 10000,
  })

  const inval = () => void qc.invalidateQueries({ queryKey: ['command-center'] })
  const ackMut = useMutation({ mutationFn: (id: number) => ackAlert({ path: { alert_id: id } }), onSuccess: inval })
  const relMut = useMutation({ mutationFn: (id: number) => releaseAlert({ path: { alert_id: id } }), onSuccess: inval })
  const resMut = useMutation({
    mutationFn: (id: number) => updateAlert({ path: { alert_id: id }, body: { estado: 'resuelta' } }),
    onSuccess: inval,
  })
  const notifyMut = useMutation({
    mutationFn: (vid: number) => notifyDriverVisita({ path: { visita_id: vid }, body: { motivo: 'ATRASO EN ENTREGA' } }),
    onSuccess: (res) => {
      const d = (res as { data?: { sent?: boolean; driver_nombre?: string; info?: string } }).data
      window.alert(d?.sent ? `📲 Aviso enviado al conductor ${d.driver_nombre ?? ''}.` : `No se pudo avisar: ${d?.info ?? 'desconocido'}`)
    },
  })

  const c = data?.counters
  const exceptions = useMemo(() => data?.exceptions ?? [], [data])
  const routes = useMemo(() => data?.routes ?? [], [data])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <LayoutDashboard className="w-5 h-5 text-brand-400" />
        <h1 className="text-base font-semibold text-text-primary uppercase tracking-wider">Centro de Control</h1>
        <span className="text-[10px] text-text-muted">· en vivo (10s){data?.sim_now ? ` · sim ${new Date(data.sim_now).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
      </div>

      {isLoading && <div className="text-text-muted text-xs uppercase tracking-wider py-12 text-center">Cargando…</div>}
      {isError && <div className="text-accent-red text-[13px] bg-accent-red/10 rounded px-3 py-2">No se pudo cargar.</div>}

      {c && (
        <>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <Kpi label="Rutas activas" value={c.rutas_activas} />
            <Kpi label="Pendientes" value={c.visitas_pendientes} />
            <Kpi label="Atrasadas" value={c.atrasadas} tone="text-orange-500" />
            <Kpi label="VIP pendientes" value={c.vip_pendientes} tone="text-accent-red" />
            <Kpi label="Bloqueados" value={c.bloqueados} tone="text-accent-red" />
            <Kpi label="Alertas" value={c.alertas_abiertas} tone="text-accent-yellow" />
          </div>

          {/* Exception queue */}
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Cola de excepciones ({exceptions.length})
            </h2>
            {exceptions.length === 0 ? (
              <div className="text-text-muted text-xs uppercase tracking-wider py-6 text-center">🎉 Sin excepciones abiertas</div>
            ) : (
              <div className="space-y-1.5">
                {exceptions.map((e: ExceptionItem) => {
                  const sev = SEV[e.severity] ?? SEV.media
                  const mine = e.owner_user_id === me?.user_id
                  return (
                    <div key={e.alert_id} className="flex items-center gap-2 rounded-md border border-line bg-bg-800 p-2.5">
                      <span className={clsx('text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0', sev!.bg)}>{sev!.label}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-text-primary truncate">{e.descripcion}</div>
                        <div className="text-[10px] text-text-muted truncate">
                          {e.empresa_nombre}{e.cliente_nombre ? ` · ${e.cliente_nombre}` : ''}{e.folio_cliente ? ` · ${e.folio_cliente}` : ''}
                          {e.edad_min != null ? ` · hace ${e.edad_min} min` : ''}
                        </div>
                      </div>
                      {e.owner_nombre && (
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded shrink-0', mine ? 'bg-brand-500/20 text-brand-400' : 'bg-bg-700 text-text-muted')}>
                          {mine ? 'Tú' : e.owner_nombre}
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        {e.owner_user_id == null ? (
                          <button onClick={() => ackMut.mutate(e.alert_id)} disabled={ackMut.isPending}
                            className="flex items-center gap-1 rounded bg-brand-500 text-white px-2 py-1 text-[10px] font-semibold hover:bg-brand-600">
                            <Hand className="w-3 h-3" /> Tomar
                          </button>
                        ) : mine ? (
                          <button onClick={() => relMut.mutate(e.alert_id)} className="rounded border border-line px-2 py-1 text-[10px] text-text-muted hover:text-text-primary">Liberar</button>
                        ) : null}
                        {e.visita_id != null && (
                          <button onClick={() => notifyMut.mutate(e.visita_id as number)} disabled={notifyMut.isPending}
                            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-bg-700"
                            title="Avisar al conductor por WhatsApp (atraso/incumplimiento)">
                            <MessageCircle className="w-3 h-3" /> Avisar
                          </button>
                        )}
                        <button onClick={() => resMut.mutate(e.alert_id)} disabled={resMut.isPending}
                          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-bg-700">
                          <CheckCircle2 className="w-3 h-3" /> Resolver
                        </button>
                        {e.dia_id != null && (
                          <Link to={`/operacion/${e.dia_id}`} className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] text-brand-500 hover:bg-bg-700" title="Ir al día">
                            <ArrowUpRight className="w-3 h-3" /> Ver
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Route health */}
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Salud de rutas ({routes.length})
            </h2>
            {routes.length === 0 ? (
              <div className="text-text-muted text-xs uppercase tracking-wider py-6 text-center">Sin rutas activas (no hay días EN_CURSO)</div>
            ) : (
              <div className="grid gap-1.5 md:grid-cols-2 lg:grid-cols-3">
                {routes.map((r: RouteHealth) => {
                  const done = r.entregadas + r.no_entregadas
                  const pct = r.total ? Math.round((done / r.total) * 100) : 0
                  const tone = r.estado === 'atrasada' ? 'border-orange-500/50' : r.estado === 'en_riesgo' ? 'border-accent-yellow/40' : 'border-line'
                  return (
                    <Link key={r.ruta_id} to={`/operacion/${r.dia_id}`} className={clsx('rounded-md border bg-bg-800 p-2.5 hover:border-brand-300 transition-colors', tone)}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-text-primary truncate">{r.driver_nombre ?? 'Sin conductor'}</div>
                          <div className="text-[10px] text-text-muted truncate">{r.empresa_nombre}</div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.atrasadas > 0 && <span className="text-[10px] font-bold text-orange-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{r.atrasadas}</span>}
                          <span className="text-[12px] font-semibold text-text-primary tabular-nums">{pct}%</span>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-bg-700 overflow-hidden flex">
                        <div className="bg-accent-green h-full" style={{ width: `${r.total ? (r.entregadas / r.total) * 100 : 0}%` }} />
                        <div className="bg-accent-red h-full" style={{ width: `${r.total ? (r.no_entregadas / r.total) * 100 : 0}%` }} />
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-text-muted">
                        <span><CheckCircle2 className="w-2.5 h-2.5 inline text-accent-green" /> {r.entregadas}</span>
                        <span>Pend: {r.pendientes}</span>
                        {r.atrasadas > 0 && <span className="text-orange-500">Atras: {r.atrasadas}</span>}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
