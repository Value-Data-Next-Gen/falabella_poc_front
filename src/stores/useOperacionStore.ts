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
  /**
   * Pedido pendiente de scrollIntoView. El sidebar lo consume y se auto-limpia.
   * Lo usamos para que el click en un pin del mapa lleve el card del driver
   * a la vista (la fuente del scroll está fuera del sidebar).
   */
  scrollDriverIntoView: number | null;

  setHoveredDriver: (id: number | null) => void;
  setSelectedDriver: (id: number | null) => void;
  requestScrollToDriver: (id: number | null) => void;
  reset: () => void;
}

export const useOperacionStore = create<OperacionState>((set) => ({
  hoveredDriverId: null,
  selectedDriverId: null,
  scrollDriverIntoView: null,
  setHoveredDriver: (id) => set({ hoveredDriverId: id }),
  setSelectedDriver: (id) => set({ selectedDriverId: id }),
  requestScrollToDriver: (id) => set({ scrollDriverIntoView: id }),
  reset: () => set({
    hoveredDriverId: null,
    selectedDriverId: null,
    scrollDriverIntoView: null,
  }),
}));
