import { Badge } from './Badge'
import { Phone, PhoneOff, Clock, CheckCircle } from 'lucide-react'

interface Props {
  phone?: string | null
  activationToken?: string | null
  optedInAt?: string | null
}

export function ActivationStatus({ phone, activationToken, optedInAt }: Props) {
  if (optedInAt) {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
        <div>
          <Badge variant="green">Activado</Badge>
          <div className="text-[9px] text-text-muted mt-0.5">
            {new Date(optedInAt).toLocaleDateString('es-CL')}
          </div>
        </div>
      </div>
    )
  }

  if (!phone) {
    return (
      <div className="flex items-center gap-1.5">
        <PhoneOff className="w-3.5 h-3.5 text-accent-red" />
        <Badge variant="red">Sin telefono</Badge>
      </div>
    )
  }

  if (activationToken) {
    return (
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-accent-yellow" />
        <div>
          <Badge variant="yellow">Pendiente</Badge>
          <div className="text-[9px] text-text-muted mt-0.5">{phone}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <Phone className="w-3.5 h-3.5 text-text-muted" />
      <Badge variant="gray">Sin invitacion</Badge>
    </div>
  )
}
