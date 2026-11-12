import { useState, type ReactNode } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Config, History, Run } from "./api";
import { MetricLabel } from "./education";

export const format = (value: number | null | undefined, digits = 1) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(
        value,
      );
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "error";
}) {
  return (
    <span className={`status-badge ${tone}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
export function EmptyState({
  title = "No hay simulaciones todavía",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={24} aria-hidden="true" />
      <h2>{title}</h2>
      <p>
        {children ?? "Ejecuta tu primer escenario para comenzar el análisis."}
      </p>
      {action}
    </div>
  );
}
export function LoadingState({ simulation = false }: { simulation?: boolean }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <strong>
        {simulation ? "Ejecutando escenario" : "Consultando datos"}
      </strong>
      <p>
        {simulation
          ? "El motor configura el entorno, genera llegadas, procesa eventos y calcula métricas. Esperando el resultado de la API."
          : "Recuperando la información disponible en la API."}
      </p>
      <div className="skeleton" />
      <div className="skeleton short" />
    </div>
  );
}
export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="panel chart-card">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {children}
    </section>
  );
}
export function QueueChart({ run }: { run: Run }) {
  return (
    <ChartCard
      title="Evolución de la cola"
      subtitle="Consulta médica · pacientes en espera / tiempo simulado (min)"
    >
      <div
        className="chart"
        role="img"
        aria-label="Evolución de pacientes en cola de consulta"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={run.timeline}
            margin={{ top: 8, right: 16, bottom: 8, left: -20 }}
          >
            <CartesianGrid vertical={false} stroke="#e3e8ee" />
            <XAxis dataKey="minute" minTickGap={48} tickLine={false} />
            <YAxis allowDecimals={false} tickLine={false} />
            <Tooltip labelFormatter={(v) => `Minuto ${format(Number(v))}`} />
            <Area
              type="stepAfter"
              dataKey="doctor_queue"
              name="Pacientes en cola"
              stroke="#28639b"
              fill="#e8f0f8"
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="caption">
        Serie muestreada. Los indicadores son los calculados por el motor entre
        eventos.
      </p>
    </ChartCard>
  );
}
export function ResourceState({ run }: { run: Run }) {
  return (
    <section className="panel">
      <h2>Estado de recursos</h2>
      <p>Utilización durante la corrida seleccionada</p>
      <div className="resource-meters">
        {[
          ["Médicos", run.config.doctors, run.metrics.doctor_utilization],
          ["Triage", run.config.triage_staff, run.metrics.triage_utilization],
          [
            "Observación",
            run.config.observation_beds,
            run.metrics.bed_utilization,
          ],
        ].map(([label, count, value]) => (
          <div key={label}>
            <div>
              <strong>{label}</strong>
              <span>
                {count} recursos · {format(Number(value) * 100)} %
              </span>
            </div>
            <meter
              min="0"
              max="1"
              value={Number(value)}
              aria-label={`Utilización de ${label}`}
            />
          </div>
        ))}
      </div>
      <p className="caption">
        Promedios del horizonte simulado, no disponibilidad en tiempo real.
      </p>
    </section>
  );
}
export function DemandProfile({ config }: { config: Config }) {
  const rates =
    config.arrival_profile === "time_varying"
      ? config.arrival_rates_per_hour
      : [config.stationary_rate_per_hour];
  return (
    <div className="demand-profile">
      <h3>Perfil de demanda</h3>
      {rates.map((rate, i) => (
        <div key={i}>
          <span>
            {rates.length === 1
              ? "Constante"
              : ["00–06", "06–12", "12–18", "18–24"][i]}
          </span>
          <span className="demand-track">
            <i style={{ width: `${(rate / Math.max(1, ...rates)) * 100}%` }} />
          </span>
          <strong>
            {format(rate)} <small>pac./h</small>
          </strong>
        </div>
      ))}
    </div>
  );
}
export function HistoryTable({
  history,
  open,
  busy,
  compact = false,
}: {
  history: History[];
  open: (id: string) => void;
  busy: boolean;
  compact?: boolean;
}) {
  return (
    <section className="panel">
      <h2>{compact ? "Últimas simulaciones" : "Historial de simulaciones"}</h2>
      {history.length ? (
        <div
          className="table-wrap"
          tabIndex={0}
          aria-label="Simulaciones guardadas"
        >
          <table>
            <thead>
              <tr>
                {[
                  "Corrida / fecha",
                  "Médicos",
                  "Semilla",
                  "Pacientes",
                  "Wq (min)",
                  "Utilización",
                  "Estado",
                  "",
                ].map((h, i) => (
                  <th key={i} scope="col">
                    <MetricLabel label={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(compact ? history.slice(0, 5) : history).map((h) => (
                <tr key={h.id}>
                  <td>
                    <code>{h.id.slice(0, 8)}</code>
                    <small className="table-subtext">
                      {new Date(h.created_at).toLocaleString("es-CO")}
                    </small>
                  </td>
                  <td>{h.config.doctors}</td>
                  <td>{h.config.seed}</td>
                  <td>{h.metrics.generated}</td>
                  <td>{format(h.metrics.mean_wait_minutes)}</td>
                  <td>{format(h.metrics.doctor_utilization * 100)} %</td>
                  <td>
                    <StatusBadge tone="success">Guardada</StatusBadge>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => open(h.id)}
                      aria-label={`Abrir corrida ${h.id.slice(0, 8)}`}
                    >
                      Abrir <ArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}
export function Comparison({ scenarios }: { scenarios: Run[] }) {
  if (!scenarios.length)
    return (
      <EmptyState title="Comparación pendiente">
        Ejecuta los cuatro escenarios con la misma configuración y semilla.
      </EmptyState>
    );
  const waits = scenarios
    .map((r) => r.metrics.mean_wait_minutes)
    .filter((v): v is number => v != null);
  const min = waits.length ? Math.min(...waits) : null;
  const maxUse = Math.max(
    ...scenarios.map((r) => r.metrics.doctor_utilization),
  );
  return (
    <>
      <p className="caption">
        Resultados de la comparación · semilla {scenarios[0].config.seed} ·{" "}
        {format(scenarios[0].config.duration_minutes / 60)} h ·{" "}
        {scenarios[0].config.arrival_profile === "time_varying"
          ? "demanda por franjas"
          : "demanda estacionaria"}{" "}
        · {scenarios[0].config.triage_staff} triage ·{" "}
        {scenarios[0].config.observation_beds} camas
      </p>
      <div
        className="table-wrap"
        tabIndex={0}
        aria-label="Comparación de escenarios"
      >
        <table>
          <thead>
            <tr>
              {[
                "Médicos",
                "Wq (min)",
                "p95 (min)",
                "Lq (pac.)",
                "Utilización",
                "Egresos/h",
                "Pendientes",
                "Lectura",
              ].map((h) => (
                <th key={h}>
                  <MetricLabel label={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenarios.map((r) => (
              <tr key={r.id}>
                <td>{r.config.doctors}</td>
                <td>{format(r.metrics.mean_wait_minutes)}</td>
                <td>{format(r.metrics.p95_wait_minutes)}</td>
                <td>{format(r.metrics.mean_queue_length)}</td>
                <td>{format(r.metrics.doctor_utilization * 100)} %</td>
                <td>{format(r.metrics.throughput_per_hour)}</td>
                <td>{r.metrics.active_at_end}</td>
                <td>
                  {min !== null && r.metrics.mean_wait_minutes === min && (
                    <StatusBadge tone="success">Menor espera</StatusBadge>
                  )}
                  {r.metrics.doctor_utilization === maxUse && (
                    <StatusBadge tone="warning">Mayor utilización</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="three-cols comparison-plots">
        {(
          [
            {
              key: "mean_wait_minutes",
              title: "Médicos vs Wq",
              unit: "min",
              color: "#245881",
            },
            {
              key: "doctor_utilization",
              title: "Médicos vs utilización",
              unit: "%",
              color: "#417eae",
            },
            {
              key: "p95_wait_minutes",
              title: "Médicos vs p95",
              unit: "min",
              color: "#6a91b5",
            },
          ] as const
        ).map((c) => (
          <div key={c.key}>
            <h3>{c.title}</h3>
            <div
              className="comparison-chart"
              role="img"
              aria-label={`${c.title}, ${c.unit}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={scenarios.map((r) => ({
                    doctors: r.config.doctors,
                    value:
                      c.key === "doctor_utilization"
                        ? r.metrics[c.key] * 100
                        : r.metrics[c.key],
                  }))}
                  margin={{ left: -22, right: 8 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="doctors" unit=" méd." tickLine={false} />
                  <YAxis tickLine={false} />
                  <Tooltip
                    formatter={(v) => [
                      `${format(Number(v))} ${c.unit}`,
                      c.title,
                    ]}
                    labelFormatter={(v) => `${v} médicos`}
                  />
                  <Bar
                    dataKey="value"
                    fill={c.color}
                    maxBarSize={44}
                    radius={[3, 3, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
      <div className="info-callout">
        <h3>Lectura del experimento</h3>
        <p>
          Bajo estos parámetros sintéticos,{" "}
          {scenarios
            .map(
              (r) =>
                `${r.config.doctors} médico${r.config.doctors === 1 ? "" : "s"}: Wq ${format(r.metrics.mean_wait_minutes)} min y ${r.metrics.active_at_end} pacientes pendientes`,
            )
            .join("; ")}
          . Una réplica por escenario; no constituye una recomendación de
          dotación hospitalaria.
        </p>
      </div>
    </>
  );
}
export function TriageBadge({ level }: { level: number }) {
  return (
    <span className={`triage-badge t${level - 1}`}>
      Triage {["I", "II", "III", "IV", "V"][level - 1]}
    </span>
  );
}
export function PatientResults({ run }: { run: Run }) {
  const [level, setLevel] = useState("all");
  const [offset, setOffset] = useState(0);
  const patients = (run.patients ?? []).filter(
    (p) => level === "all" || p.triage_level === Number(level),
  );
  const labels: Record<string, string> = {
    triage_queue: "Cola de triage",
    triage: "En triage",
    doctor_queue: "Cola médica",
    consultation: "En consulta",
    observation_queue: "Espera de cama",
    observation: "En observación",
    discharged: "Egreso",
  };
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Pacientes de la corrida</h2>
          <p>Marcas de tiempo del motor · minutos desde el inicio</p>
        </div>
        <label className="field">
          Filtrar por triage
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setOffset(0);
            }}
          >
            <option value="all">Todos</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Triage {["I", "II", "III", "IV", "V"][n - 1]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {patients.length ? (
        <>
          <div
            className="table-wrap"
            tabIndex={0}
            aria-label="Pacientes de la simulación"
          >
            <table>
              <thead>
                <tr>
                  {[
                    "Paciente",
                    "Triage",
                    "Llegada",
                    "Inicio triage",
                    "Inicio consulta",
                    "Fin consulta",
                    "Egreso",
                    "Estado al corte",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.slice(offset, offset + 25).map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>
                      <TriageBadge level={p.triage_level} />
                    </td>
                    <td>{format(p.arrival)}</td>
                    <td>{format(p.triage_start)}</td>
                    <td>{format(p.consultation_start)}</td>
                    <td>{format(p.consultation_end)}</td>
                    <td>{format(p.departure)}</td>
                    <td>{labels[p.state] ?? p.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>
              {offset + 1}–{Math.min(offset + 25, patients.length)} de{" "}
              {patients.length}
            </span>
            <button
              className="secondary"
              disabled={!offset}
              onClick={() => setOffset(offset - 25)}
            >
              Anterior
            </button>
            <button
              className="secondary"
              disabled={offset + 25 >= patients.length}
              onClick={() => setOffset(offset + 25)}
            >
              Siguiente
            </button>
          </div>
        </>
      ) : (
        <EmptyState title="Sin pacientes disponibles">
          No hay registros para este filtro o esta corrida antigua no incluye el
          detalle.
        </EmptyState>
      )}
    </section>
  );
}
