import { useState } from 'react';
import { BookOpen, Brain, Flame, MessageSquare, X } from 'lucide-react';

type Section = 'model' | 'score' | 'notify' | 'data';

export function AlgorithmModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState<Section>('model');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl panel max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-brand" />
            Cómo funciona el sistema
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-accent-red"><X size={16} /></button>
        </div>

        <div className="flex border-b border-line">
          <TabBtn active={section === 'model'}  onClick={() => setSection('model')}  icon={Brain}         label="Predicción P(fallo)" />
          <TabBtn active={section === 'score'}  onClick={() => setSection('score')}  icon={Flame}         label="Urgency score" />
          <TabBtn active={section === 'notify'} onClick={() => setSection('notify')} icon={MessageSquare} label="Notificaciones" />
          <TabBtn active={section === 'data'}   onClick={() => setSection('data')}   icon={BookOpen}      label="Data y simulación" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed">
          {section === 'model'  && <ModelSection />}
          {section === 'score'  && <ScoreSection />}
          {section === 'notify' && <NotifySection />}
          {section === 'data'   && <DataSection />}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider border-b-2 transition-colors ${
      active ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'
    }`}>
      <Icon size={12} /> {label}
    </button>
  );
}

function H({ children }: any) { return <h4 className="font-semibold text-sm text-text-primary mt-4 mb-1">{children}</h4>; }
function P({ children }: any) { return <p className="text-text-secondary my-2">{children}</p>; }
function Code({ children }: any) { return <code className="font-mono text-[11px] bg-bg-700 px-1 py-0.5 rounded">{children}</code>; }
function Pre({ children }: any) {
  return <pre className="bg-bg-700 p-2 rounded text-[11px] font-mono my-2 overflow-x-auto">{children}</pre>;
}

function ModelSection() {
  return (
    <div>
      <H>Qué predice el modelo</H>
      <P>
        Para cada visita <em>pendiente</em>, el backend calcula <Code>p_fallo</Code> ∈ [0, 1]: la probabilidad
        estimada de que esa entrega <strong>no se complete dentro de su ventana horaria</strong> (window_end).
        La visita "falla" si <Code>ETA_real &gt; window_end</Code>.
      </P>

      <H>Cómo se entrena</H>
      <P>
        Al arrancar el backend se generan <strong>60 días sintéticos</strong> con patrones ocultos
        (clientes recurrentes con problemas, comunas problemáticas, conductores específicos, horarios malos).
        Eso produce ~7.200 visitas históricas etiquetadas con <Code>failed ∈ {'{0,1}'}</Code>.
      </P>
      <P>
        Pipeline de training:
      </P>
      <Pre>{`XGBoost (hist tree, 300 estimators, max_depth=5)
  → CalibratedClassifierCV (isotonic, cv=3)    # asegura que p_fallo sea probabilidad real
  → SHAP TreeExplainer                          # explica cada predicción por feature`}</Pre>

      <H>Features que usa</H>
      <Pre>{`Numéricas:
  hora_window_end            · hora límite de la ventana
  carga                      · kg / m³ del paquete
  dist_depot_km              · distancia haversine al CD
  orden_en_ruta              · posición (1,2,3...) del stop en la ruta del camión
  retraso_acumulado_vehiculo · minutos de delay del vehículo hasta ahora
  tasa_fallo_historica_cliente · fail-rate de esa comuna/zona
  horas_hasta_window_end     · cuánto falta hasta el deadline

Categóricas (one-hot):
  comuna_id  (lat/lon redondeado a grilla 0.05°)
  conductor_id (driver asignado)
  dia_semana`}</Pre>

      <H>Métricas</H>
      <P>
        El split temporal (50 días train / 10 días val) da <Code>AUC ≈ 0.76</Code> y <Code>Brier ≈ 0.097</Code>.
        La calibración isotónica hace que cuando el modelo dice <em>p=70%</em>, efectivamente el 70% de esas visitas fallan.
      </P>

      <H>Explicabilidad (SHAP)</H>
      <P>
        Cada visita predicha trae sus <strong>top 3 factores</strong> (<Code>top_factors</Code>) con su contribución
        numérica al score. Se muestran en el panel de alertas anticipadas y en el drill-down por visita. Si una
        visita saltó a alta por "conductor X + zona Y + horas_hasta_we &lt; 2", ves esos tres drivers.
      </P>
    </div>
  );
}

function ScoreSection() {
  return (
    <div>
      <H>Urgency score del Watchlist</H>
      <P>
        El modelo da <Code>p_fallo</Code>, pero para decidir <strong>qué llamar primero</strong> se combina con
        otros señales operativos. Score 0-100:
      </P>
      <Pre>{`p_fallo × 40                          (base)

+ 30  si slack_min < 0   (ya pasó deadline)
+ 20  si slack_min < 30
+ 10  si slack_min < 60

+ 15  si alert_slack == 'RED'         (semáforo SimpliRoute)
+ 15  si el cliente es VIP
+ 10  si priority = high
+ 20  si priority = vip               (reemplaza +10)`}</Pre>

      <H>Severidad</H>
      <Pre>{`>= 70  CRITICO  (rojo, acción inmediata)
>= 45  ALTO     (ámbar, llamar cliente)
>= 25  MEDIO    (azul, monitorear)
<  25  (excluido del watchlist)`}</Pre>

      <H>Ejemplo</H>
      <P>
        <Code>p_fallo=0.72</Code>, <Code>slack=15min</Code>, <Code>alert_slack=RED</Code>, <Code>VIP=true</Code>:
        {' '}28.8 + 20 + 15 + 15 = <strong>78.8 → CRITICO</strong>. En la card aparece con score 79,
        borde rojo y chips "P(fallo) 72%", "Slack crítico 15min", "Rojo SimpliRoute", "Cliente VIP".
      </P>

      <H>Por qué así</H>
      <P>
        Un cliente VIP con slack bajo es más urgente que un cliente común con p_fallo alto. El score refleja
        <em> costo de no actuar</em> más que <em>probabilidad pura de falla</em>. La fórmula es transparente
        y cada chip te dice exactamente por qué la visita está donde está.
      </P>
    </div>
  );
}

function NotifySection() {
  return (
    <div>
      <H>Dos modos de disparo</H>
      <P><strong>Manual</strong>: cualquier usuario con scope hace click en "Notificar" en Watchlist o Alertas.</P>
      <P><strong>Automático</strong>: cada tick del scheduler (3s sim), si una visita pasa a <Code>alert_valuedata=true</Code>, el backend:</P>
      <Pre>{`para cada user con notify_whatsapp=1 que pertenece a esa empresa_id:
  si p_fallo >= user.notify_pfallo_threshold     → dispara
  si slack_min <= user.notify_slack_min_threshold → dispara
  si es cliente VIP                              → dispara (ignora umbrales)
  si user.notify_only_vip == true y no es VIP    → skip`}</Pre>

      <H>Envío real vs dry-run</H>
      <P>
        El backend usa Twilio. Si faltan credenciales o <Code>NOTIFICATIONS_DRY_RUN=true</Code>, se registra
        en <Code>fpoc.notifications_log</Code> con <Code>status='dry_run'</Code> sin llamar a la API.
        Si hay credenciales válidas, se envía WhatsApp real (sandbox o producción).
      </P>

      <H>Modos de mensaje</H>
      <P>
        <strong>Freeform</strong>: texto libre. Funciona en sandbox (72h window) o con destinatario opt-in.
      </P>
      <P>
        <strong>Content Template</strong>: si <Code>TWILIO_CONTENT_SID</Code> está configurado, el auto-notify usa el
        template con variables <Code>{'{{1}}, {{2}}'}</Code> mapeadas desde la alerta (window_end y ETA).
        Requerido para producción fuera de ventana 24h.
      </P>

      <H>Trazabilidad</H>
      <P>
        Cada envío queda en <Code>fpoc.notifications_log</Code> con <Code>twilio_sid</Code>, destino, body,
        content_sid, content_variables, triggered_by (manual/auto_threshold/vip). En cada card de Watchlist y
        Plan Diario aparece un badge clickeable que muestra cuántas veces se envió y el último mensaje.
      </P>
    </div>
  );
}

function DataSection() {
  return (
    <div>
      <H>Dos fuentes de datos</H>
      <P>
        <strong>1. Modelo operacional en vivo</strong>: pipeline Python con Faker que genera 120 visitas/día
        sintéticas con patrones ocultos. Vive en memoria del backend, se refresca cada tick, no se persiste.
        Alimenta Watchlist, Mapa ops, Plan Diario, AlertsPanel.
      </P>
      <P>
        <strong>2. Data persistida en Azure SQL</strong> (schema <Code>fpoc</Code>): la tabla{' '}
        <Code>fpoc.simpli_visits</Code> tiene las columnas del Excel real + 30-90 días históricos + live-gen.
        Alimenta tab Seguimiento con comparativas entre fechas.
      </P>

      <H>Live generator</H>
      <P>
        Scheduler APScheduler corre cada <Code>LIVE_GEN_INTERVAL_SEC</Code> (default 8s) e inserta{' '}
        <Code>LIVE_GEN_ROWS_PER_TICK</Code> (default 2) rows nuevas en <Code>fpoc.simpli_visits</Code> con{' '}
        <Code>planned_date=today</Code>. Cada row tiene IDs únicos {'>'} 900B para no colisionar con el seed.
      </P>

      <H>Controles admin</H>
      <Pre>{`Pausar / Arrancar        — toggle en vivo
Inyectar día             — batch instantáneo de N rows en una fecha
Simular N días           — loopea hacia atrás llenando días
Limpiar hoy              — DELETE de rows live-gen del día`}</Pre>

      <H>Seed inicial</H>
      <P>
        <Code>seed_history.py 90 2026-04-19</Code> replica los 1866 rows del Excel real para cada día hacia atrás,
        aplicando jitter ±15% en SLA, flip 2% de status, drift 3% en ruta_anomala. Esto genera 168k rows con
        variación realista día-a-día para que las comparativas del tab Seguimiento tengan data distinta en
        cada fecha.
      </P>
    </div>
  );
}
