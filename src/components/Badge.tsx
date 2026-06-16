import { clsx } from 'clsx'

const variants = {
  green: 'bg-accent-green/15 text-accent-green',
  red: 'bg-accent-red/15 text-accent-red',
  yellow: 'bg-accent-yellow/15 text-accent-yellow',
  blue: 'bg-accent-blue/15 text-accent-blue',
  violet: 'bg-accent-violet/15 text-accent-violet',
  gray: 'bg-bg-700 text-text-secondary',
} as const

interface BadgeProps {
  variant: keyof typeof variants
  children: React.ReactNode
}

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider', variants[variant])}>
      {children}
    </span>
  )
}
