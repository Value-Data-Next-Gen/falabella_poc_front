/**
 * Store global de la pantalla Operación. Estados EFÍMEROS de interacción
 * (hover, foco transient) que necesitan que mapa y sidebar se sincronicen
 * sin prop-drilling.
 *
 * NO es la fuente de verdad de los filtros — esos viven en MapaTab como
 * useState porque (a) controlan los queryKeys de react-query y (b) deben
 * persistir su valor en URL/localStorage en un sprint futuro.
 *
 * Convención de "driver id" en este store: usamos el `vehicle_id` (alias de
 * patente_falsa o sintético para rutas adicionales) porque es lo que devuelve
 * `/api/operacion/driver-positions`. Cuando hay 1 patente con N rutas, cada
 * ruta tiene un vehicle_id único.
 */
import { create } from 'zustand';

interface OperacionState {
  /** vehicle_id del driver con hover activo (mouse en su card o pin) */
  hoveredDriverId: number | null;
  /** vehicle_id seleccionado (click). Origen tanto sidebar como mapa. */
  selectedDriverId: number | null;
  /** CR-012 T7: tracking_id de la visita con hover (pin del mapa o parada del Gantt). */
  hoveredVisitaId: string | null;
  /** CR-012 T7: tracking_id seleccionado → abre el slide-over (T8). */
  selectedVisitaId: string | null;
  /**
   * Pedido pendiente de scrollIntoView. El sidebar lo consume y se auto-limpia.
   * Lo usamos para que el click en un pin del mapa lleve el card del driver
   * a la vista (la fuente del scroll está fuera del sidebar).
   */
  scrollDriverIntoView: number | null;
  /** Persistido en localStorage por OperacionModuleV2 (`op.bottomCollapsed`). */
  bottomPanelCollapsed: boolean;
  /** Persistido en localStorage (`copiloto_mode`). default permanent. */
  copilotoPermanent: boolean;

  setHoveredDriver: (id: number | null) => void;
  setSelectedDriver: (id: number | null) => void;
  setHoveredVisita: (id: string | null) => void;
  setSelectedVisita: (id: string | null) => void;
  requestScrollToDriver: (id: number | null) => void;
  setBottomCollapsed: (v: boolean) => void;
  setCopilotoPermanent: (v: boolean) => void;
  reset: () => void;
}

export const useOperacionStore = create<OperacionState>((set) => ({
  hoveredDriverId: null,
  selectedDriverId: null,
  hoveredVisitaId: null,
  selectedVisitaId: null,
  scrollDriverIntoView: null,
  bottomPanelCollapsed: false,
  copilotoPermanent: true,
  setHoveredDriver: (id) => set({ hoveredDriverId: id }),
  setSelectedDriver: (id) => set({ selectedDriverId: id }),
  setHoveredVisita: (id) => set({ hoveredVisitaId: id }),
  setSelectedVisita: (id) => set({ selectedVisitaId: id }),
  requestScrollToDriver: (id) => set({ scrollDriverIntoView: id }),
  setBottomCollapsed: (v) => set({ bottomPanelCollapsed: v }),
  setCopilotoPermanent: (v) => set({ copilotoPermanent: v }),
  reset: () => set({
    hoveredDriverId: null,
    selectedDriverId: null,
    hoveredVisitaId: null,
    selectedVisitaId: null,
    scrollDriverIntoView: null,
  }),
}));
