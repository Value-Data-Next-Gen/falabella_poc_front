# `_legacy/` — código frontend deprecado

Archivos movidos acá en la limpieza de R7. Ninguno está importado por la app
actual y `tsconfig.json` los excluye del typecheck/build. Quedan en el repo
por si hace falta consultar o reusar lógica.

| Archivo                                  | Reemplazo / motivo                                  |
| ---------------------------------------- | --------------------------------------------------- |
| `components/AlertsPanel.tsx`             | Alerts viejos pre-R3 (ahora `EventStream`).         |
| `components/DayConfigPanel.tsx`          | Reemplazado por `panels/ConfigDelDiaPanel.tsx`.     |
| `components/Header.tsx`                  | Reemplazado por `layout/Topbar.tsx`.                |
| `components/KPIBar.tsx`                  | KPIs antiguos; ahora viven en cada módulo.          |
| `components/LivePanel.tsx`               | Toggles manuales de live_gen/comment_sim. R7 los gobierna desde `day_state.transition`. |
| `components/LiveSimulationSidebar.tsx`   | Sidebar pre-R3.                                     |
| `components/VehiclesPanel.tsx`           | Vista vieja de drivers/vehículos.                   |
| `components/VisitsTable.tsx`             | Reemplazado por `panels/TablaVisitas.tsx`.          |
| `components/panels/WizardDelDia.tsx`     | Reemplazado por `panels/DiaOperativoPanel.tsx`.     |

Si necesitás recuperar algo, simplemente moveló de vuelta a `src/` y agregá su
import donde corresponda.
