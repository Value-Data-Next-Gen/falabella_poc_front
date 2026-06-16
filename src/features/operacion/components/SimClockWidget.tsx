import { useEffect, useRef, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSimClock, updateSimClock, simTick } from '@/api/sdk.gen'
import { Play, Pause, Clock, RotateCcw } from 'lucide-react'
import { clsx } from 'clsx'

const SPEEDS = [1, 5, 10, 30, 60]

interface Props {
  diaId: number
  diaFecha: string
  variant?: 'floating' | 'inline'
}

interface ClockData {
  sim_now: string
  speed: number
  running: boolean
  last_tick_at: string
}

export function SimClockWidget({ diaId, diaFecha, variant = 'inline' }: Props) {
  const qc = useQueryClient()
  const tickInterval = useRef<number | null>(null)
  const localTimeRef = useRef<{ baseSim: number; baseReal: number; speed: number; running: boolean } | null>(null)
  const [displayedTime, setDisplayedTime] = useState<number>(() => Date.now())

  const clockQ = useQuery({
    queryKey: ['sim-clock'],
    queryFn: () => getSimClock(),
    refetchInterval: 10000,
  })
  const clock = clockQ.data?.data as ClockData | undefined

  // Sync local time base whenever the server clock changes
  useEffect(() => {
    if (clock) {
      localTimeRef.current = {
        baseSim: new Date(clock.sim_now).getTime(),
        baseReal: Date.now(),
        speed: clock.speed,
        running: clock.running,
      }
      setDisplayedTime(new Date(clock.sim_now).getTime())
    }
  }, [clock?.sim_now, clock?.speed, clock?.running])

  // Smooth local interpolation: tick the displayed time every 200ms based on local time
  useEffect(() => {
    if (!clock?.running) return
    const interval = window.setInterval(() => {
      const base = localTimeRef.current
      if (!base || !base.running) return
      const realElapsed = (Date.now() - base.baseReal) / 1000
      const simNow = base.baseSim + realElapsed * base.speed * 1000
      setDisplayedTime(simNow)
    }, 200)
    return () => window.clearInterval(interval)
  }, [clock?.running])

  const updateMut = useMutation({
    mutationFn: (body: { speed?: number; running?: boolean; sim_now?: string }) => updateSimClock({ body }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ['sim-clock'] })
      const prev = qc.getQueryData(['sim-clock'])
      qc.setQueryData(['sim-clock'], (old: unknown) => {
        const o = old as { data?: ClockData } | undefined
        if (!o?.data) return old
        return { ...o, data: { ...o.data, ...vars } }
      })
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['sim-clock'], ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sim-clock'] })
    },
  })

  // Tick the server frequently when running to keep driver positions fresh
  useEffect(() => {
    if (clock?.running) {
      tickInterval.current = window.setInterval(() => {
        simTick().then(() => {
          void qc.invalidateQueries({ queryKey: ['driver-positions', diaId] })
        }).catch(() => {})
      }, 2000)
      return () => { if (tickInterval.current) window.clearInterval(tickInterval.current) }
    } else if (tickInterval.current) {
      window.clearInterval(tickInterval.current)
      tickInterval.current = null
    }
  }, [clock?.running, diaId, qc])

  const { timeStr, dateStr } = useMemo(() => {
    const d = new Date(displayedTime)
    return {
      timeStr: d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateStr: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
    }
  }, [displayedTime])

  if (!clock) return null

  const toggleRunning = () => updateMut.mutate({ running: !clock.running })
  const setSpeed = (s: number) => updateMut.mutate({ speed: s })
  const resetToDia = () => {
    const date = new Date(diaFecha + 'T09:00:00')
    updateMut.mutate({ sim_now: date.toISOString(), running: false })
  }

  const isFloating = variant === 'floating'

  return (
    <div
      className={clsx(
        'border border-line rounded-md',
        isFloating
          ? 'absolute top-3 left-3 z-10 bg-bg-800/95 backdrop-blur shadow-lg p-2.5 min-w-[260px]'
          : 'bg-bg-800 shadow-sm p-2.5 inline-flex items-center gap-3',
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className={clsx('w-4 h-4', clock.running ? 'text-accent-green animate-pulse' : 'text-text-muted')} />
        <div>
          <div className="text-[15px] font-mono font-semibold text-text-primary leading-none tabular-nums">{timeStr}</div>
          <div className="text-[9px] text-text-muted uppercase tracking-wider mt-0.5">SIM · {dateStr}</div>
        </div>
        <button
          onClick={toggleRunning}
          className={clsx(
            'w-7 h-7 rounded flex items-center justify-center transition-colors',
            clock.running
              ? 'bg-accent-red/15 text-accent-red hover:bg-accent-red/25'
              : 'bg-brand-500 text-white hover:bg-brand-600',
          )}
          title={clock.running ? 'Pausar' : 'Iniciar'}
        >
          {clock.running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-1 border-l border-line pl-3">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={clsx(
              'rounded px-2 py-1 text-[10px] font-semibold transition-colors min-w-[28px]',
              clock.speed === s
                ? 'bg-brand-500 text-white'
                : 'bg-bg-700 text-text-muted hover:bg-bg-700/80 hover:text-text-primary',
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <button
        onClick={resetToDia}
        className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] text-text-muted uppercase tracking-wider hover:bg-bg-700 transition-colors"
        title="Reset al inicio del dia"
      >
        <RotateCcw className="w-3 h-3" /> 09:00
      </button>
    </div>
  )
}
