# Frontend POC Falabella - Repo Tree

Documento generado tras el cleanup del frontend. Lista los archivos vivos de
`/frontend/src` con qué hacen, desde dónde se renderizan y su estado.

Convenciones:

- `activo` — importado desde la app viva (App.tsx, AppShell.tsx o un componente
  alcanzable desde estos).
- `solo-tests` — sin consumidores en runtime pero importado desde
  `frontend/__tests__/*.test.ts`. No borrar sin discutir el borrado del test.
- `dudoso` — caso que ameritó dejar el archivo sin tocar; ver nota.

## Top-level (`src/`)

| Archivo               | Qué hace                                                                                       | Estado  |
| --------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| `App.tsx`             | Root component. Despacha entre `LoginPage` y `AppShell` según `useAuth`.                      | activo  |
| `main.tsx`            | Entry point Vite. Monta `<App />` con `<AuthProvider>` y `<ThemeProvider>`.                   | activo  |
| `api.ts`              | Cliente HTTP monolítico (~1k líneas) contra `/api` del backend. ~142 funciones agrupadas como `api.<dominio>.<accion>`. | activo  |
| `types.ts`            | Tipos legacy hardcoded (~1k líneas). Coexiste con `types/api.ts` autogenerado. Migración progresiva por CR — no agregar tipos nuevos del backend acá. | activo (legacy)  |
| `types/api.ts`        | Tipos auto-generados desde `backend/openapi.json` vía `npm run gen-types`. Source of truth para entidades del backend. NO editar a mano. | activo (autogen) |
| `types/operacion.ts`  | Tipos canónicos del módulo Operación (Visita, Ruta, Empresa, AlertEvent) + `OPERATION_WINDOW`, `SIN_RESPUESTA_THRESHOLD_MIN`. | activo  |
| `index.css`           | Tailwind directives + tokens CSS globales.                                                     | activo  |
| `vite-env.d.ts`       | Ambient types de Vite.                                                                         | activo  |

## `src/components/` — App-level (root)

Componentes que viven directo bajo `src/components/` (sin subcarpeta).

| Archivo                          | Qué hace                                                                                                       | Renderiza desde                                                | Estado  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------- |
| `LoginPage.tsx`                  | Pantalla `/login`. Form de email + password.                                                                   | `App.tsx` cuando no hay sesión                                | activo  |
| `AgentDock.tsx`                  | FAB flotante global del asistente conversacional. Abre drawer con `AgentChatPanel`.                            | `AppShell.tsx`                                                | activo  |
| `CutoffReachedModal.tsx`         | R7. Vigila `sim_clock` vs cutoff. Si el reloj alcanza el cutoff y hay visitas pendientes, ofrece extender/cerrar. | `AppShell.tsx`                                                | activo  |
| `OnboardingTour.tsx`             | Tour guiado post-login (5 pasos). Se muestra una sola vez (`fpoc.tour.completed.v1` en localStorage).         | `AppShell.tsx`                                                | activo  |
| `InvitacionesPanel.tsx`          | Dashboard unificado de activaciones wa.me (users/drivers/contactos). Solo rol `falabella_*`.                  | `AppShell.tsx` cuando `nav.module === 'invitaciones'`         | activo  |
| `EmpresasTransportistasPanel.tsx`| Listado + CRUD de empresas transportistas. Bulk XLSX, invite WhatsApp, activation cells.                       | `OnboardingModule` y `EmpresaPage`                            | activo  |
| `MastersPanel.tsx`               | Maestros de Onboarding (empresas/vehículos/drivers/clientes-VIP/users/motivos). Tabs internas.                | `OnboardingModule`                                            | activo  |
| `MotivosConfigPanel.tsx`         | Configuración de catálogo de motivos + alertas por motivo.                                                     | `OnboardingModule`, `MastersPanel`                            | activo  |
| `EventStream.tsx`                | Feed live de eventos del backend (polling).                                                                    | `OperacionModuleV2`                                           | activo  |
| `OperationsMap.tsx`              | Mapa deck.gl + maplibre con visitas, rutas, drivers. Filtro de región.                                         | `OperacionModuleV2`                                           | activo  |
| `PlanDiarioPanel.tsx`            | Plan operativo del día por driver/ruta.                                                                        | `OperacionModuleV2`                                           | activo  |
| `RouteOpsPanel.tsx`              | Operación por ruta (lista de paradas + acciones).                                                              | `OperacionModuleV2`                                           | activo  |
| `WatchlistPanel.tsx`             | Watchlist de visitas críticas con prioridad y notificaciones.                                                  | `OperacionModuleV2`                                           | activo  |
| `SeguimientoPanel.tsx`           | KPIs operativos y tabla agregada de visitas (Control / Seguimiento).                                           | `AnaliticaModule`                                             | activo  |
| `NotificationsPanel.tsx`         | Log + configuración de notificaciones WhatsApp.                                                                | `AnaliticaModule`                                             | activo  |
| `ModelPanel.tsx`                 | Métricas y feature-importance del modelo XGB.                                                                  | `IAModule`                                                    | activo  |
| `AsistenteIAPanel.tsx`           | Probador del clasificador LLM de motivos (chat).                                                               | `RouteOpsPanel`, `ProbadorIAPanel`                            | activo  |
| `ReportMotivoButton.tsx`         | Botón para reportar/clasificar motivo de no-entrega de una visita.                                             | `RouteOpsPanel`                                               | activo  |
| `NotifiedBadge.tsx`              | Badge inline con resumen de notificaciones de un tracking.                                                     | `RouteOpsPanel`, `PlanDiarioPanel`                            | activo  |

## `src/components/layout/`

Layout chrome de la app.

| Archivo         | Qué hace                                                                                       | Renderiza desde   | Estado |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------- | ------ |
| `AppShell.tsx`  | Layout principal post-login. Sidebar + Topbar + main + dock + modals. Hash routing → módulo. | `App.tsx`         | activo |
| `Sidebar.tsx`   | Sidebar colapsable. Define `MODULES` (8 entradas) y `ModuleKey`. Badge de correcciones pendientes. | `AppShell`        | activo |
| `Topbar.tsx`    | Topbar con breadcrumb, búsqueda global, switcher de empresa, perfil.                          | `AppShell`        | activo |
| `SubTabs.tsx`   | Tira de sub-tabs reutilizable. Usada por cada módulo para sus secciones.                       | Todos los modules | activo |

## `src/components/modules/`

Un componente por entrada principal del sidebar. Despachan a sub-tabs / panels.

| Archivo                          | Qué hace                                                                                          | Tab del sidebar    | Estado |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ | ------ |
| `OnboardingModule.tsx`           | Maestros + Empresas + VIPs + Usuarios + Motivos + Drivers. También enruta a `EmpresaPage`/`DriverPage`. | Onboarding         | activo |
| `PlanificacionModule.tsx`        | Día operativo + calendario. Wrap con `ErrorBoundary`.                                            | Planificación      | activo |
| `OperacionModuleV2.tsx`          | Mapa + alertas + copiloto. 3 sub-tabs (mapa, alertas, copiloto). Integra deck.gl, Gantt, drawers. | Operación          | activo |
| `SeguimientoIAModule.tsx`        | Auditoría IA: alertas IA + probador + correcciones de motivo.                                    | Auditoría IA       | activo |
| `AnaliticaModule.tsx`            | KPIs + Tabla de visitas + Scorecard drivers + Log notificaciones.                                | Control            | activo |
| `IAModule.tsx`                   | Modelo XGB.                                                                                      | IA / Modelo        | activo |
| `ConfiguracionSystemModule.tsx`  | Configuración del sistema (alertas, WhatsApp, LLM). Define un `ExpandableCard` local.            | Configuración      | activo |

## `src/components/pages/`

Páginas full-screen alcanzables por hash o por click desde un módulo.

| Archivo                   | Qué hace                                                                                       | Renderiza desde                                     | Estado |
| ------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------ |
| `DriverDashboardPage.tsx` | Dashboard exclusivo del rol `driver` (sin sidebar/topbar). Sus rutas, documentos y capacitaciones. | `AppShell` cuando `isDriver`                       | activo |
| `EmpresaPage.tsx`         | Vista detalle de una empresa transportista (contactos, documentos, broadcasts).                | `OnboardingModule` al hacer click en una empresa    | activo |
| `DriverPage.tsx`          | Vista detalle de un driver (datos, documentos, capacitaciones).                                | `OnboardingModule` al hacer click en un driver      | activo |

## `src/components/panels/`

Panels reusables consumidos por modules / pages / drawers.

| Archivo                        | Qué hace                                                                                       | Consumido por                       | Estado |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------- | ------ |
| `AgentChatPanel.tsx`           | UI del chat conversacional (web). Reusa el FSM del bot WhatsApp.                              | `AgentDock`                         | activo |
| `CalendarioOperativoPanel.tsx` | Calendario operativo con días resaltados según estado.                                         | `PlanificacionModule`               | activo |
| `DiaOperativoPanel.tsx`        | Vista del día operativo con 5 `ExpandableCard` (carga/dotación/plan/clientes/configdía). Tiene un `ExpandableCard` local. | `PlanificacionModule`               | activo |
| `CargaEntregasPanel.tsx`       | Card carga: import XLSX + validación + start-day.                                              | `DiaOperativoPanel`                 | activo |
| `DotacionPanel.tsx`            | Card dotación: dotación diaria por driver/vehículo.                                            | `DiaOperativoPanel`                 | activo |
| `PlanDelDiaSimplePanel.tsx`    | Card plan: lista simple de rutas con drawer de detalle.                                        | `DiaOperativoPanel`                 | activo |
| `ClientesDelDiaPanel.tsx`      | Card clientes: clientes del día con notas y priorización.                                      | `DiaOperativoPanel`                 | activo |
| `ConfigDelDiaPanel.tsx`        | Card configdía: cutoff, alertas, mensajes del día.                                             | `DiaOperativoPanel`                 | activo |
| `RutaDetalleDrawer.tsx`        | Drawer con detalle de una ruta (paradas + estado).                                             | `PlanDelDiaSimplePanel`, `OperacionModuleV2` | activo |
| `MapaFoliosTable.tsx`          | Tabla de folios visibles en el mapa.                                                           | `OperacionModuleV2`                 | activo |
| `GanttPorParada.tsx`           | Gantt SVG por ruta (07:00–22:00). Usa d3-scale.                                                | `OperacionModuleV2`                 | activo |
| `VisitaDetailDrawer.tsx`       | Slide-over de drill-down de una visita. Lanza `EscalationConfirmModal`.                       | `OperacionModuleV2`                 | activo |
| `EscalationConfirmModal.tsx`   | Modal bloqueante de confirmación de escalamiento a supervisor.                                | `VisitaDetailDrawer`                | activo |
| `CopilotoPanel.tsx`            | Placeholder del copiloto operativo. **Sugerencias mock hardcoded** (`TODO(ai-integration)`).  | `OperacionModuleV2`                 | activo |
| `MotivoCorrectionsPanel.tsx`   | Cola de correcciones de motivos sugeridas por LLM. Accept/reject/no-action/renotify.          | `SeguimientoIAModule`               | activo |
| `ProbadorIAPanel.tsx`          | Probador IA — selección de visita + chat con `AsistenteIAPanel`.                              | `SeguimientoIAModule`               | activo |
| `TablaVisitas.tsx`             | Tabla paginada y filtrable de visitas seguimiento.                                            | `AnaliticaModule`                   | activo |
| `DriverScorecardPanel.tsx`     | Scorecard por driver con métricas históricas.                                                 | `AnaliticaModule`                   | activo |

## `src/components/shared/`

Atoms / moléculas reutilizadas en varios paneles.

| Archivo                       | Qué hace                                                                                       | Estado |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| `Modal.tsx`                   | Modal genérico con título + close.                                                             | activo |
| `BulkXlsxButtons.tsx`         | Botones download template + upload XLSX (drivers/vehicles/dotación).                          | activo |
| `EntityDocumentsTab.tsx`      | Tab de documentos de una entidad (empresa/vehículo/driver).                                    | activo |
| `OnboardWhatsAppModal.tsx`    | Modal de invitación WhatsApp (sandbox info + invite).                                          | activo |
| `WhatsAppInviteButton.tsx`    | Botón que abre `OnboardWhatsAppModal`.                                                         | activo |
| `ActivationCell.tsx`          | Celda inline de estado de activación wa.me (copy link, regenerar).                            | activo |
| `ActivationSuccessBlock.tsx`  | Bloque post-activación con link + copy.                                                        | activo |
| `OnboardingHelpBanner.tsx`    | Banner descartable con guía de onboarding (`onboardingBannerDismissed_v1`).                    | activo |

## `src/components/ui/`

Primitivos UI puros.

| Archivo                | Qué hace                                                                                       | Estado |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| `ErrorBoundary.tsx`    | Error boundary de clase con fallback + retry.                                                  | activo |
| `InfoTooltip.tsx`      | Tooltip con ícono `Info`.                                                                      | activo |

## `src/hooks/`

| Archivo                  | Qué hace                                                                                       | Estado      |
| ------------------------ | ---------------------------------------------------------------------------------------------- | ----------- |
| `useAuth.tsx`            | `AuthProvider` + `useAuth()`. Maneja JWT, roles (`falabella_*` / `transport_*` / `driver`).    | activo      |
| `useDiaActivo.tsx`       | `DiaActivoProvider` + `useDiaActivo()`. Día operativo activo persistido en localStorage.       | activo      |
| `useTheme.ts`            | `ThemeProvider` + `useTheme()`. Light/dark.                                                    | activo      |
| `useLiveOperationData.ts`| Hook con polling y backoff para datos live de Operación. **NO importado por componentes** —    | solo-tests  |
|                          | el hook está cubierto por `__tests__/backoff.test.ts` (función exportada `operacionBackoffMs`). |             |

## `src/lib/`

| Archivo                 | Qué hace                                                                                       | Estado      |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ----------- |
| `formatMotivoLabel.ts`  | Normaliza IDs canónicos de motivos (MAYÚSCULAS / "/" / abreviaturas) a label legible.         | activo      |
| `operacionUrgency.ts`   | Helpers puros para `urgencyScore` del sidebar de drivers (cubre `SIN_RESPUESTA_THRESHOLD_MIN`). | activo      |
| `regiones.ts`           | 16 regiones administrativas de Chile + `routeColorByVehicle`, `isLatLonInRegion`.             | activo      |
| `routing.ts`            | Helper `getRoutePolyline` con cache. **NO importado por componentes** — solo por               | solo-tests  |
|                         | `__tests__/routing.test.ts`.                                                                   |             |

## `src/stores/`

| Archivo                 | Qué hace                                                                                       | Estado |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ------ |
| `useOperacionStore.ts`  | Store Zustand de estados efímeros de Operación (hover, foco, `selectedVisitaId`, drawers).    | activo |

## Cleanup ejecutado en este CR

Archivos borrados (no eran alcanzables desde la app viva):

- `src/_legacy/` — directorio completo. Excluido de `tsconfig` y sin imports desde código vivo. Borrados:
  - `_legacy/components/AlertsPanel.tsx`
  - `_legacy/components/DayConfigPanel.tsx`
  - `_legacy/components/Header.tsx`
  - `_legacy/components/KPIBar.tsx`
  - `_legacy/components/LivePanel.tsx`
  - `_legacy/components/LiveSimulationSidebar.tsx`
  - `_legacy/components/VehiclesPanel.tsx`
  - `_legacy/components/VisitsTable.tsx`
  - `_legacy/components/panels/WizardDelDia.tsx`
  - `_legacy/README.md`
- `src/components/AlgorithmModal.tsx` — solo lo usaba `_legacy/components/LivePanel.tsx`.
- `src/components/SettingsModal.tsx` — solo lo usaba `_legacy/components/Header.tsx`.
- `src/components/ui/ExpandableCard.tsx` — ningún componente lo importaba. `DiaOperativoPanel` y `ConfiguracionSystemModule` definen `ExpandableCard` localmente.

Cambio adicional en `frontend/tsconfig.json`: eliminada la entrada
`"exclude": ["src/_legacy"]` porque el directorio ya no existe.

## Archivos dudosos / que NO se tocaron

- **`src/types.ts`** (~1k líneas) — coexiste con `types/api.ts` autogenerado por
  diseño explícito (CLAUDE.md: "NO se borra: coexiste y se migra progresivamente
  por CR"). No agregar tipos nuevos del backend acá; usar `types/api.ts`. Una
  migración masiva debería ser un CR propio.
- **`src/api.ts`** — monolítico (~1k líneas, 142 funciones). El CR menciona
  "funciones que ya no usa ningún component vivo" como candidatas, pero la
  detección segura requiere trazar cada call-site `api.<dominio>.<acción>` y el
  riesgo de romper consumidores indirectos (e.g. `api.legacy.*`) es alto.
  Recomendado: CR propio para auditar dead exports.
- **`src/hooks/useLiveOperationData.ts`** — cero imports en `src/` pero el test
  `__tests__/backoff.test.ts` importa `operacionBackoffMs` de acá. La función
  fue extraída para testear sin renderizar el componente (deck.gl). Mantener
  hasta que el CR decida si la lógica vuelve a un componente vivo o se borra
  junto con el test.
- **`src/lib/routing.ts`** — cero imports en `src/` pero `__tests__/routing.test.ts`
  cubre `getRoutePolyline` + cache. Misma situación que el anterior.

## Verificación post-cleanup

- `npm run gen-types` — OK.
- `npx tsc --noEmit` — clean (exit 0).
- `npm run build` — clean (28s, warning de chunk size pre-existente).
- `npm test` — 28/28 tests pasan (5 archivos).
