export type DiaEstado = 'BORRADOR' | 'VALIDADO' | 'EN_CURSO' | 'CERRADO'

export interface Transition {
  target: DiaEstado
  label: string
  variant: 'green' | 'blue' | 'red' | 'gray'
  confirm: boolean
  confirmMessage?: string
}

export interface Capabilities {
  canCreateRuta: boolean
  canCreateVisita: boolean
  canBulkUpload: boolean
  canUpdateVisitaStatus: boolean
  transitions: Transition[]
}

const CONFIG: Record<DiaEstado, Capabilities> = {
  BORRADOR: {
    canCreateRuta: true,
    canCreateVisita: true,
    canBulkUpload: true,
    canUpdateVisitaStatus: false,
    transitions: [
      { target: 'VALIDADO', label: 'Validar', variant: 'green', confirm: false },
    ],
  },
  VALIDADO: {
    canCreateRuta: false,
    canCreateVisita: true,
    canBulkUpload: false,
    canUpdateVisitaStatus: false,
    transitions: [
      { target: 'EN_CURSO', label: 'Iniciar Operacion', variant: 'blue', confirm: false },
      { target: 'BORRADOR', label: 'Desbloquear', variant: 'gray', confirm: false },
    ],
  },
  EN_CURSO: {
    canCreateRuta: false,
    canCreateVisita: false,
    canBulkUpload: false,
    canUpdateVisitaStatus: true,
    transitions: [
      { target: 'CERRADO', label: 'Cerrar Dia', variant: 'red', confirm: true, confirmMessage: 'Una vez cerrado no se puede reabrir.' },
    ],
  },
  CERRADO: {
    canCreateRuta: false,
    canCreateVisita: false,
    canBulkUpload: false,
    canUpdateVisitaStatus: false,
    transitions: [],
  },
}

export function getCapabilities(estado: string): Capabilities {
  return CONFIG[estado as DiaEstado] ?? CONFIG.CERRADO
}

export const ESTADO_BADGE: Record<string, { variant: 'gray' | 'yellow' | 'blue' | 'green'; label: string }> = {
  BORRADOR: { variant: 'gray', label: 'Borrador' },
  VALIDADO: { variant: 'yellow', label: 'Validado' },
  EN_CURSO: { variant: 'blue', label: 'En Curso' },
  CERRADO: { variant: 'green', label: 'Cerrado' },
}

export const VISITA_ESTADO_BADGE: Record<string, { variant: 'gray' | 'yellow' | 'blue' | 'green' | 'red'; label: string }> = {
  pendiente: { variant: 'gray', label: 'Pendiente' },
  en_camino: { variant: 'yellow', label: 'En Camino' },
  entregado: { variant: 'green', label: 'Entregado' },
  no_entregado: { variant: 'red', label: 'No Entregado' },
  cancelado: { variant: 'gray', label: 'Cancelado' },
}
