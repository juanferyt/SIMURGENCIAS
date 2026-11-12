import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Layers3,
  Menu,
  Play,
  RotateCcw,
  Settings2,
  Stethoscope,
  Users,
  X,
  BarChart3,
  PanelLeftClose,
  PanelLeftOpen,
  History as HistoryIcon,
  GitCompareArrows,
  ClipboardList,
} from "lucide-react";
import {
  api,
  defaults,
  type Attention,
  type Config,
  type History,
  type Patient,
  type Reference,
  type Resources,
  type Run,
  type Telemetry,
} from "./api";
import {
  Comparison,
  DemandProfile,
  EmptyState,
  HistoryTable,
  LoadingState,
  PatientResults,
  QueueChart,
  ResourceState,
  StatusBadge,
  TriageBadge,
} from "./components";
import { cells } from "./laboratory";
import { PageGuide, MetricHelp, fieldHelp } from "./education";

const pages = [
  "Inicio",
  "Simulación",
  "Resultados",
  "Historial",
  "Comparar escenarios",
  "Teoría",
  "Telemetría",
  "Modelo",
  "Laboratorio",
  "Metodología",
  "Documentación",
] as const;
type Page = (typeof pages)[number];
const groups: { title: string; items: Page[] }[] = [
  {
    title: "OPERACIÓN",
    items: ["Inicio", "Simulación", "Resultados", "Historial"],
  },
  { title: "ANÁLISIS", items: ["Comparar escenarios", "Teoría", "Telemetría"] },
  { title: "MODELO", items: ["Modelo", "Laboratorio"] },
  { title: "PROYECTO", items: ["Metodología", "Documentación"] },
];
const icons = [
  LayoutDashboard,
  Settings2,
  BarChart3,
  HistoryIcon,
  GitCompareArrows,
  BookOpen,
  Activity,
  Layers3,
  FlaskConical,
  ClipboardList,
  Code2,
];
const pageLabels: Partial<Record<Page, string>> = {
  Modelo: "Modelo DES",
  Teoría: "Teoría de colas",
  Laboratorio: "Laboratorio SimPy",
};
const titles: Record<Page, [string, string]> = {
  Inicio: [
    "SIMURGENCIAS",
    "Simulación y análisis del flujo de atención en urgencias",
  ],
  Simulación: [
    "Configuración del escenario",
    "Define los recursos, el horizonte y la demanda del experimento.",
  ],
  Resultados: [
    "Resultados de simulación",
    "Consulta las métricas y el recorrido de los pacientes de la corrida seleccionada.",
  ],
  Historial: [
    "Historial de simulaciones",
    "Consulta y recupera los experimentos guardados.",
  ],
  "Comparar escenarios": [
    "Comparación de capacidad",
    "Efecto del número de médicos sobre el desempeño del modelo",
  ],
  Teoría: [
    "Teoría de colas",
    "Referencia M/M/c y contraste con la simulación de eventos discretos.",
  ],
  Telemetría: [
    "Telemetría del sistema",
    "Estado de los servicios y capacidad del motor de simulación.",
  ],
  Modelo: [
    "Modelo de eventos discretos",
    "Entidades, recursos y eventos del flujo de urgencias.",
  ],
  Laboratorio: [
    "Laboratorio SimPy",
    "Doce celdas para reproducir y explicar el modelo.",
  ],
  Metodología: [
    "Metodología del experimento",
    "Variables controladas, reproducibilidad y límites de interpretación.",
  ],
  Documentación: [
    "Documentación del proyecto",
    "Arquitectura, contratos de API y supuestos del modelo.",
  ],
};
const f = (v: number | null | undefined, digits = 1) =>
  v == null
    ? "Sin observación"
    : new Intl.NumberFormat("es-CO", { maximumFractionDigits: digits }).format(
        v,
      );
const pct = (v: number) => `${f(v * 100)} %`;
function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"panel " + className}>{children}</section>;
}
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
function Metric({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: ReactNode;
}) {
  return (
    <div className="metric">
      <div className="metric-top">
        <span>{label}</span>
        {label.includes("Espera de consulta") ? (
          <MetricHelp term="Wq" />
        ) : label.includes("p95") ? (
          <MetricHelp term="p95" />
        ) : label.includes("Utilización") ? (
          <MetricHelp term="utilización" />
        ) : label.includes("Throughput") ? (
          <MetricHelp term="throughput" />
        ) : label.includes("Cola") ? (
          <MetricHelp term="Lq" />
        ) : null}
        {icon}
      </div>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </div>
  );
}
function Flow() {
  return (
    <div className="flow">
      {[
        "Llegada",
        "Registro / Triage",
        "Cola priorizada",
        "Consulta médica",
        "Observación (opcional)",
        "Egreso",
      ].map((s, i) => (
        <div className="flow-step" key={s}>
          <span>0{i + 1}</span>
          <strong>{s}</strong>
          {i < 5 && <ChevronRight size={18} />}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const getPage = (): Page =>
    pages.find((p) => encodeURIComponent(p) === location.hash.slice(1)) ??
    "Inicio";
  const [page, setPage] = useState<Page>(getPage);
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{
    status: string;
    database: string;
  } | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState("Resumen");
  const [latest, setLatest] = useState<Run | null>(null);
  const [online, setOnline] = useState(false);
  const [config, setConfig] = useState<Config>(defaults);
  const [run, setRun] = useState<Run | null>(null);
  const [scenarios, setScenarios] = useState<Run[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [attentions, setAttentions] = useState<Attention[]>([]);
  const [resources, setResources] = useState<Resources[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [theory, setTheory] = useState<Reference | null>(null);
  const [theoryValues, setTheoryValues] = useState({
    arrival_per_hour: 5,
    service_mean_minutes: 18,
    servers: 2,
  });
  const navigate = (p: Page) => {
    location.hash = encodeURIComponent(p);
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const resize = () => {
      setMobile(query.matches);
      if (!query.matches) setMenu(false);
    };
    query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    const before = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
      if (event.key !== "Tab") return;
      const items = Array.from(
        sidebar?.querySelectorAll<HTMLElement>("a,button") ?? [],
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    sidebar?.querySelector<HTMLElement>("a")?.focus();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus();
    };
  }, [menu]);
  const refresh = async () => {
    const [p, a, r, t, h] = await Promise.all([
      api<Patient[]>("/patients"),
      api<Attention[]>("/attentions"),
      api<Resources[]>("/resources"),
      api<Telemetry>("/telemetry"),
      api<History[]>("/simulations"),
    ]);
    setPatients(p);
    setAttentions(a);
    setResources(r);
    setTelemetry(t);
    setHistory(h);
    setUpdated(new Date().toLocaleTimeString("es-CO"));
    if (h[0]) {
      const saved = await api<Run>(`/simulations/${h[0].id}`);
      setLatest(saved);
      setRun((current) => current ?? saved);
    } else setLatest(null);
  };
  useEffect(() => {
    const listener = () => setPage(getPage());
    window.addEventListener("hashchange", listener);
    refresh()
      .catch((e: Error) => {
        setOnline(false);
        setError(
          `No se pudo conectar con la API: ${e.message}. Inicia el backend y PostgreSQL.`,
        );
      })
      .finally(() => setLoading(false));
    const checkHealth = () =>
      api<{ status: string; database: string }>("/health")
        .then((h) => {
          setHealth(h);
          setOnline(h.status === "ok");
        })
        .catch(() => {
          setHealth(null);
          setOnline(false);
        });
    void checkHealth();
    const timer = window.setInterval(checkHealth, 30000);
    return () => {
      window.removeEventListener("hashchange", listener);
      window.clearInterval(timer);
    };
  }, []);
  async function action(work: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await work();
    } catch (e) {
      console.error("SIMURGENCIAS", e);
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }
  async function execute(compare = false) {
    await action(async () => {
      if (compare) {
        const data = await api<{ scenarios: Run[] }>(
          "/simulations/compare",
          config,
        );
        setScenarios(data.scenarios);
        setRun(
          data.scenarios.find((r) => r.config.doctors === config.doctors) ??
            data.scenarios[0],
        );
      } else {
        const data = await api<Run>("/simulations/run", config);
        setRun(data);
        setScenarios([]);
      }
      await refresh();
      navigate(compare ? "Comparar escenarios" : "Resultados");
      setResultTab("Resumen");
      setNotice("Experimento completado y guardado en PostgreSQL.");
    });
  }
  function download() {
    if (!run) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `simurgencias-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function notebook() {
    const notebook = {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          display_name: "Python 3",
          language: "python",
          name: "python3",
        },
      },
      cells: [
        {
          id: "intro",
          cell_type: "markdown",
          metadata: {},
          source: [
            "# SIMURGENCIAS · Entrega 1\nDatos sintéticos. Ejecuta desde backend/ con sus dependencias y matplotlib instalados. En Colab, clona el repositorio y cambia a backend/.",
          ],
        },
        ...cells.flatMap((c, i) => [
          {
            id: `text-${i}`,
            cell_type: "markdown",
            metadata: {},
            source: [`## ${i + 1}. ${c.title}\n${c.text}`],
          },
          {
            id: `code-${i}`,
            cell_type: "code",
            metadata: {},
            execution_count: null,
            outputs: [],
            source: c.code.split("\n").map((l) => l + "\n"),
          },
        ]),
      ],
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(notebook, null, 2)], {
        type: "application/x-ipynb+json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "SIMURGENCIAS_Entrega_1.ipynb";
    a.click();
    URL.revokeObjectURL(url);
  }
  const numeric = (
    key: keyof Config,
    label: string,
    min: number,
    max: number,
    step = 1,
  ) => (
    <label className="field">
      {label}
      <input
        aria-label={label}
        aria-describedby={`help-${key}`}
        type="number"
        required
        min={min}
        max={max}
        step={step}
        value={config[key] as number}
        onChange={(e) =>
          setConfig({ ...config, [key]: Number(e.target.value) })
        }
      />
      <small className="field-help" id={`help-${key}`}>
        {fieldHelp[key]}
      </small>
    </label>
  );
  const summary = run && (
    <>
      <div className="metrics">
        <Metric
          label="Espera de consulta"
          value={f(run.metrics.mean_wait_minutes)}
          unit="min"
          icon={<Clock3 size={18} />}
        />
        <Metric
          label="Utilización médica"
          value={pct(run.metrics.doctor_utilization)}
          icon={<Stethoscope size={18} />}
        />
        <Metric
          label="Cola media de consulta"
          value={f(run.metrics.mean_queue_length)}
          unit="pacientes"
          icon={<Activity size={18} />}
        />
        <Metric
          label="p95 espera de pacientes"
          value={f(run.metrics.p95_wait_minutes)}
          unit="min"
          icon={<Clock3 size={18} />}
        />
        <Metric
          label="Throughput de egreso"
          value={f(run.metrics.throughput_per_hour)}
          unit="pac./h"
          icon={<Activity size={18} />}
        />
      </div>
      <p className="caption">
        Wq, percentiles y probabilidad de espera: pacientes que iniciaron
        consulta. Throughput: egresos por hora. Los KPI añadidos en la auditoría
        no están disponibles en corridas antiguas. Secuencias:{" "}
        {run.config.rng_scheme ?? "legacy-v1"}.
      </p>
    </>
  );

  return (
    <div className={collapsed ? "app collapsed" : "app"}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Saltar al contenido
      </a>
      {menu && (
        <button
          className="drawer-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="app-navigation"
        className={menu ? "sidebar open" : "sidebar"}
        inert={mobile && !menu}
        aria-label="Navegación de la aplicación"
      >
        <a href="#Inicio" className="brand" onClick={() => navigate("Inicio")}>
          <span className="brand-icon">
            <HeartPulse />
          </span>
          <span>
            SIMURGENCIAS<small>Centro de simulación</small>
          </span>
        </a>
        <button
          className="collapse-button"
          aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
          <span>Colapsar</span>
        </button>
        <button
          className="drawer-close icon-button"
          aria-label="Cerrar navegación"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <nav aria-label="Principal">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="nav-caption">{group.title}</div>
              {group.items.map((p) => {
                const Icon = icons[pages.indexOf(p)];
                return (
                  <button
                    key={p}
                    title={pageLabels[p] ?? p}
                    className={page === p ? "nav-item selected" : "nav-item"}
                    onClick={() => navigate(p)}
                    aria-current={page === p ? "page" : undefined}
                  >
                    <Icon size={18} />
                    <span>{pageLabels[p] ?? p}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>PROYECTO DE AULA</span>
          <strong>Modelos y Simulación</strong>
          <p>Centro de simulación y análisis de urgencias</p>
        </div>
      </aside>
      <div className="workspace" inert={mobile && menu}>
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Abrir menú"
            aria-expanded={menu}
            aria-controls="app-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            SIMURGENCIAS <ChevronRight size={14} /> <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className={online ? "connection online" : "connection"}>
              <i />
              {online
                ? "API operativa"
                : health === null && loading
                  ? "API verificando"
                  : "API sin conexión"}
            </span>
            <span
              className={
                health?.database === "postgresql"
                  ? "connection online"
                  : "connection"
              }
            >
              <i />
              {health?.database === "postgresql"
                ? "PostgreSQL conectado"
                : "BD sin verificar"}
            </span>
            <span className="version">Modelo académico</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {page === "Resultados" && run && (
              <button className="secondary" onClick={download}>
                <Download size={16} /> Exportar JSON
              </button>
            )}
          </div>
          <div className="academic-note">
            SIMURGENCIAS utiliza datos sintéticos y corresponde a un modelo
            académico. No representa un hospital real ni genera recomendaciones
            clínicas.
          </div>
          <PageGuide key={page} page={page} />
          {loading && <LoadingState />}
          {busy && (
            <LoadingState
              simulation={
                page === "Simulación" ||
                page === "Comparar escenarios" ||
                page === "Resultados"
              }
            />
          )}
          {error && (
            <div className="error" role="alert">
              <div>
                <strong>No fue posible completar la operación.</strong>
                <p>{error}</p>
                <span>
                  Revisa la conexión o los parámetros e intenta la acción
                  nuevamente.
                </span>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => action(refresh)}
              >
                Actualizar datos
              </button>
              <button onClick={() => setError("")} aria-label="Cerrar error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}

          {page === "Inicio" && (
            <>
              {latest ? (
                <>
                  <div className="overview-strip">
                    {[
                      ["Última simulación", latest.id.slice(0, 8)],
                      ["Médicos", latest.config.doctors],
                      ["Pacientes generados", latest.metrics.generated],
                      [
                        "Espera promedio",
                        f(latest.metrics.mean_wait_minutes) + " min",
                      ],
                      ["Utilización", pct(latest.metrics.doctor_utilization)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                !loading && (
                  <EmptyState
                    action={
                      <button
                        className="primary"
                        onClick={() => navigate("Simulación")}
                      >
                        Nueva simulación <ArrowRight size={16} />
                      </button>
                    }
                  />
                )
              )}
              <div className="two-cols dashboard-top">
                <Panel>
                  <div className="section-heading">
                    <h2>Última simulación</h2>
                    <StatusBadge tone={latest ? "success" : "neutral"}>
                      {latest ? "Guardada" : "Sin corrida"}
                    </StatusBadge>
                  </div>
                  {latest ? (
                    <>
                      <p>
                        Corrida <code>{latest.id.slice(0, 8)}</code> ·{" "}
                        {new Date(latest.created_at).toLocaleString("es-CO")}
                      </p>
                      <dl className="compact-details">
                        <div>
                          <dt>Horizonte</dt>
                          <dd>{f(latest.config.duration_minutes / 60)} h</dd>
                        </div>
                        <div>
                          <dt>Semilla</dt>
                          <dd>{latest.config.seed}</dd>
                        </div>
                        <div>
                          <dt>Egresos</dt>
                          <dd>{latest.metrics.discharged}</dd>
                        </div>
                        <div>
                          <dt>Pendientes al corte</dt>
                          <dd>{latest.metrics.active_at_end}</dd>
                        </div>
                      </dl>
                      <button
                        className="text-button"
                        onClick={() => {
                          setRun(latest);
                          navigate("Resultados");
                        }}
                      >
                        Consultar corrida <ArrowRight size={14} />
                      </button>
                    </>
                  ) : (
                    <p>
                      La última corrida guardada aparecerá aquí al conectar con
                      la API.
                    </p>
                  )}
                </Panel>
                <Panel>
                  <h2>Acciones rápidas</h2>
                  <div className="quick-actions">
                    {(
                      [
                        "Simulación",
                        "Comparar escenarios",
                        "Resultados",
                        "Modelo",
                      ] as Page[]
                    ).map((p, i) => (
                      <button
                        key={p}
                        onClick={() => {
                          if (p === "Resultados" && !run) setRun(latest);
                          navigate(p);
                        }}
                      >
                        <span>
                          {
                            [
                              "Nueva simulación",
                              "Comparar escenarios",
                              "Abrir resultados",
                              "Ver modelo",
                            ][i]
                          }
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>
              {latest && (
                <div className="two-cols results-charts">
                  <QueueChart run={latest} />
                  <ResourceState run={latest} />
                </div>
              )}
              <HistoryTable
                history={history}
                busy={busy}
                compact
                open={(id) =>
                  action(async () => {
                    setRun(await api<Run>("/simulations/" + id));
                    setScenarios([]);
                    navigate("Resultados");
                  })
                }
              />
              <Panel className="management">
                <div className="section-heading" id="gestion">
                  <div>
                    <h2>Gestión del servicio</h2>
                    <p>Registros sintéticos independientes del simulador.</p>
                  </div>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => action(refresh)}
                  >
                    <RotateCcw size={15} /> Actualizar
                  </button>
                </div>
                <div className="two-cols">
                  <form
                    onSubmit={(e: FormEvent<HTMLFormElement>) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const data = new FormData(form);
                      action(async () => {
                        const p = await api<Patient>("/patients", {
                          code: data.get("code"),
                          triage_level: Number(data.get("triage")),
                        });
                        await api("/attentions", { patient_id: p.id });
                        await refresh();
                        form.reset();
                        setNotice(
                          "Paciente sintético registrado con su atención.",
                        );
                      });
                    }}
                  >
                    <h3>Registrar paciente de demostración</h3>
                    <div className="form-grid">
                      <label className="field">
                        Código sintético
                        <input
                          name="code"
                          placeholder="DEMO-004"
                          required
                          pattern="[A-Za-z0-9_-]+"
                          maxLength={60}
                        />
                      </label>
                      <label className="field">
                        Nivel de triage
                        <select name="triage" defaultValue="3">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              Triage {["I", "II", "III", "IV", "V"][n - 1]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button className="primary" disabled={busy}>
                      Registrar ingreso <ArrowRight size={15} />
                    </button>
                  </form>
                  <div className="telemetry">
                    <h3>Telemetría de gestión</h3>
                    <div className="mini-metrics">
                      <div>
                        <strong>
                          {telemetry?.management.active_patients ?? "—"}
                        </strong>
                        <span>activos</span>
                      </div>
                      <div>
                        <strong>
                          {telemetry?.management.queued_patients ?? "—"}
                        </strong>
                        <span>en espera</span>
                      </div>
                      <div>
                        <strong>
                          {telemetry?.technical.requests_processed ?? "—"}
                        </strong>
                        <span>solicitudes API</span>
                      </div>
                    </div>
                    <p>
                      Las etapas registradas describen esta demo; no asignan
                      personal de un hospital.
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Triage</th>
                        <th>Etapa registrada</th>
                        <th>Siguiente etapa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((p) => {
                        const a = attentions.find((a) => a.patient_id === p.id);
                        const transitions: Record<string, string[]> = {
                          registered: ["triage"],
                          triage: ["waiting"],
                          waiting: ["consultation"],
                          consultation: ["observation", "discharged"],
                          observation: ["discharged"],
                          discharged: [],
                        };
                        const labels: Record<string, string> = {
                          registered: "Ingreso",
                          triage: "Triage",
                          waiting: "Espera",
                          consultation: "Consulta",
                          observation: "Observación",
                          discharged: "Egreso",
                        };
                        return (
                          <tr key={p.id}>
                            <td>{p.code}</td>
                            <td>
                              <TriageBadge level={p.triage_level} />
                            </td>
                            <td>{a ? labels[a.stage] : "Sin atención"}</td>
                            <td>
                              {a ? (
                                (transitions[a.stage] ?? []).map((stage) => (
                                  <button
                                    className="small-button"
                                    disabled={busy}
                                    key={stage}
                                    onClick={() =>
                                      action(async () => {
                                        await api(
                                          `/attentions/${a.id}`,
                                          { stage },
                                          "PATCH",
                                        );
                                        await refresh();
                                      })
                                    }
                                  >
                                    {labels[stage]} <ChevronRight size={12} />
                                  </button>
                                ))
                              ) : (
                                <button
                                  className="small-button"
                                  disabled={busy}
                                  onClick={() =>
                                    action(async () => {
                                      await api("/attentions", {
                                        patient_id: p.id,
                                      });
                                      await refresh();
                                    })
                                  }
                                >
                                  Crear atención
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {patients.length === 0 && (
                    <p className="empty-small">Sin registros disponibles.</p>
                  )}
                </div>
                {resources[0] && (
                  <div className="resource-strip">
                    <span>
                      <Stethoscope size={17} /> Configuración de recursos de
                      gestión
                    </span>
                    <strong>
                      {resources[0].doctors} médicos ·{" "}
                      {resources[0].triage_staff} triage ·{" "}
                      {resources[0].observation_beds} camas
                    </strong>
                    <button
                      className="text-button"
                      onClick={() => {
                        setConfig({
                          ...config,
                          ...{
                            doctors: resources[0].doctors,
                            triage_staff: resources[0].triage_staff,
                            observation_beds: resources[0].observation_beds,
                          },
                        });
                        navigate("Simulación");
                      }}
                    >
                      Usar en experimento <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </Panel>
            </>
          )}

          {page === "Modelo" && (
            <>
              <Panel>
                <div className="section-heading">
                  <h2>Flujo del proceso</h2>
                  <Tag>Tiempo en minutos</Tag>
                </div>
                <p>
                  La entidad Patient ingresa a un sistema inicialmente vacío.
                  Cada evento cambia su estado y la ocupación de los recursos.
                </p>
                <Flow />
                <div className="model-resources">
                  <span>Recursos del escenario actual</span>
                  <strong>Triage · {config.triage_staff}</strong>
                  <strong>Médicos · {config.doctors} (configurable)</strong>
                  <strong>Observación · {config.observation_beds} camas</strong>
                </div>
              </Panel>
              <div className="three-cols model-grid">
                {[
                  [
                    "Entidades",
                    "Patient conserva identificación sintética, nivel de triage, demandas de servicio y marcas de tiempo. EmergencyDepartment coordina el recorrido.",
                  ],
                  [
                    "Recursos finitos",
                    "TriageStation: Resource. Doctor: PriorityResource. Camas: Resource. Los médicos se liberan al terminar la consulta, antes de observación.",
                  ],
                  [
                    "Eventos",
                    "Llegada, inicio y fin de triage, inicio y fin de consulta, inicio de observación y egreso. SimPy avanza al siguiente evento.",
                  ],
                  [
                    "Estados",
                    "En cola de triage → triage → cola médica → consulta → cola de observación → observación → egreso. La observación es opcional.",
                  ],
                  [
                    "Variables de entrada",
                    "Médicos, triage, camas, duración, semilla, tasas por franja, medias de servicio, probabilidad de observación y política de prioridad.",
                  ],
                  [
                    "Variables de salida",
                    "Llegadas, consultas terminadas, egresos, activos al corte, espera, permanencia, colas y utilización por recurso.",
                  ],
                ].map(([title, text], i) => (
                  <Panel key={title}>
                    <span className="number-label">0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </Panel>
                ))}
              </div>
              <div className="two-cols">
                <Panel>
                  <h2>Prioridad académica</h2>
                  <div className="triage-levels">
                    {["I", "II", "III", "IV", "V"].map((n, i) => (
                      <span key={n} className={"triage-level t" + i}>
                        {n}
                      </span>
                    ))}
                  </div>
                  <p>
                    I tiene mayor prioridad que V. La cola de consulta es no
                    expropiativa: no interrumpe una consulta iniciada. Empates
                    se resuelven por llegada a la cola; triage atiende FIFO.
                  </p>
                  <p>
                    Distribución sintética: 5 %, 15 %, 40 %, 25 %, 15 %. No es
                    una regla clínica.
                  </p>
                </Panel>
                <Panel>
                  <h2>Llegadas no estacionarias</h2>
                  <div className="rate-bars">
                    {defaults.arrival_rates_per_hour.map((r, i) => (
                      <div key={i}>
                        <span>{["00–06", "06–12", "12–18", "18–24"][i]} h</span>
                        <i style={{ width: `${r * 7}%` }} />
                        <strong>{r}/h</strong>
                      </div>
                    ))}
                  </div>
                  <p>
                    Perfil predeterminado de Poisson por tramos. Se repite cada
                    24 horas; los valores son editables y sintéticos.
                  </p>
                </Panel>
              </div>
            </>
          )}

          {page === "Simulación" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                execute();
              }}
            >
              <div className="simulation-layout">
                <div>
                  <Panel>
                    <div className="section-heading">
                      <h2>
                        <span className="section-index">01</span> Recursos del
                        sistema
                      </h2>
                      <Tag>Decisión controlable</Tag>
                    </div>
                    <p>
                      Médicos disponibles simultáneamente: con 1 puede haber una
                      consulta a la vez; con 3, hasta tres. Aumentar capacidad
                      puede reducir la espera y también la utilización.
                    </p>
                    <div className="doctor-options">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          type="button"
                          key={n}
                          aria-pressed={config.doctors === n}
                          className={
                            config.doctors === n
                              ? "doctor-option chosen"
                              : "doctor-option"
                          }
                          onClick={() => setConfig({ ...config, doctors: n })}
                        >
                          <Stethoscope size={22} />
                          <strong>{n}</strong>
                          <span>{n === 1 ? "médico" : "médicos"}</span>
                          {config.doctors === n && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                    <div className="form-grid">
                      {numeric("triage_staff", "Personal de triage", 1, 10)}
                      {numeric(
                        "observation_beds",
                        "Camas de observación",
                        1,
                        50,
                      )}
                    </div>
                  </Panel>
                  <Panel>
                    <h2>
                      <span className="section-index">02</span> Tiempo
                    </h2>
                    <div className="form-grid">
                      {numeric(
                        "duration_minutes",
                        "Duración (minutos)",
                        60,
                        10080,
                      )}
                      {numeric("seed", "Semilla aleatoria", 0, 2147483647)}
                    </div>
                    <h3 className="form-subheading">Demanda y prioridad</h3>
                    <div className="form-grid">
                      <label className="field">
                        Perfil de llegada
                        <select
                          aria-label="Perfil de llegada"
                          aria-describedby="arrival-help"
                          value={config.arrival_profile}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              arrival_profile: e.target
                                .value as Config["arrival_profile"],
                            })
                          }
                        >
                          <option value="time_varying">
                            Variable por franja · principal
                          </option>
                          <option value="stationary">
                            Estacionario · referencia teórica
                          </option>
                        </select>
                        <small className="field-help" id="arrival-help">
                          Tasas sintéticas promedio por hora: variables por
                          franja o constantes. Más llegadas aumentan la demanda
                          esperada.
                        </small>
                      </label>
                      <label className="field">
                        Política de consulta
                        <select
                          aria-label="Política de consulta"
                          aria-describedby="priority-help"
                          value={config.priority_policy}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              priority_policy: e.target
                                .value as Config["priority_policy"],
                            })
                          }
                        >
                          <option value="triage">Prioridad por triage</option>
                          <option value="fifo">FIFO (orden de llegada)</option>
                        </select>
                        <small className="field-help" id="priority-help">
                          Ordena a quienes esperan consulta. La prioridad puede
                          adelantar a alguien en cola; nunca interrumpe al
                          paciente que ya está siendo atendido. FIFO respeta el
                          orden de solicitud.
                        </small>
                      </label>
                    </div>
                    {config.arrival_profile === "time_varying" ? (
                      <div className="form-grid four">
                        {config.arrival_rates_per_hour.map((r, i) => (
                          <label className="field" key={i}>
                            {["00–06 h", "06–12 h", "12–18 h", "18–24 h"][i]}
                            <div className="input-unit">
                              <input
                                aria-label={
                                  ["00–06 h", "06–12 h", "12–18 h", "18–24 h"][
                                    i
                                  ]
                                }
                                aria-describedby={`arrival-rate-help-${i}`}
                                type="number"
                                required
                                min="0"
                                max="60"
                                step="0.1"
                                value={r}
                                onChange={(e) => {
                                  const rates = [
                                    ...config.arrival_rates_per_hour,
                                  ] as Config["arrival_rates_per_hour"];
                                  rates[i] = Number(e.target.value);
                                  setConfig({
                                    ...config,
                                    arrival_rates_per_hour: rates,
                                  });
                                }}
                              />
                              <span>pac./h</span>
                            </div>
                            <small
                              className="field-help"
                              id={`arrival-rate-help-${i}`}
                            >
                              Llegadas promedio por hora en esta franja.
                              Aumentar la tasa puede aumentar la cola; no fija
                              un conteo exacto.
                            </small>
                          </label>
                        ))}
                      </div>
                    ) : (
                      numeric(
                        "stationary_rate_per_hour",
                        "Tasa estacionaria (pacientes/hora)",
                        0.1,
                        60,
                        0.1,
                      )
                    )}
                  </Panel>
                  <Panel>
                    <h2>
                      <span className="section-index">03</span> Tiempos de
                      servicio
                    </h2>
                    <p>
                      Distribuciones exponenciales independientes. Medias
                      sintéticas en minutos.
                    </p>
                    <div className="form-grid">
                      {numeric(
                        "triage_mean_minutes",
                        "Registro / triage (min)",
                        0.1,
                        60,
                        0.1,
                      )}
                      {numeric(
                        "consultation_mean_minutes",
                        "Consulta médica (min)",
                        0.1,
                        120,
                        0.1,
                      )}
                      {numeric(
                        "observation_mean_minutes",
                        "Observación (min)",
                        0.1,
                        480,
                        0.1,
                      )}
                      {numeric(
                        "observation_probability",
                        "Probabilidad de observación (0–1)",
                        0,
                        1,
                        0.01,
                      )}
                    </div>
                  </Panel>
                </div>
                <aside className="scenario-card">
                  <span className="eyebrow">ESCENARIO ACTUAL</span>
                  <h2>Escenario {String(config.doctors).padStart(2, "0")}</h2>
                  <dl>
                    <div>
                      <dt>Médicos</dt>
                      <dd>{config.doctors}</dd>
                    </div>
                    <div>
                      <dt>Personal de triage</dt>
                      <dd>{config.triage_staff}</dd>
                    </div>
                    <div>
                      <dt>Horizonte</dt>
                      <dd>{f(config.duration_minutes / 60)} horas</dd>
                    </div>
                    <div>
                      <dt>Semilla</dt>
                      <dd>{config.seed}</dd>
                    </div>
                    <div>
                      <dt>Demanda</dt>
                      <dd>
                        {config.arrival_profile === "time_varying"
                          ? "Variable"
                          : "Estacionaria"}
                      </dd>
                    </div>
                  </dl>
                  <DemandProfile config={config} />
                  <p>Los parámetros corresponden a un escenario sintético.</p>
                  <button className="primary full" disabled={busy}>
                    <Play size={16} />
                    {busy ? "Ejecutando…" : "Ejecutar simulación"}
                  </button>
                  <button
                    className="secondary full"
                    type="button"
                    disabled={busy}
                    onClick={(e) => {
                      if (e.currentTarget.form?.reportValidity()) execute(true);
                    }}
                  >
                    <BarChart3 size={16} /> Comparar 1–4 médicos
                  </button>
                  <p>
                    <Check size={15} /> Resultados guardados en PostgreSQL
                  </p>
                  <p>
                    <Check size={15} /> Misma configuración y semilla: métricas
                    reproducibles
                  </p>
                  <div className="aside-note">
                    El reloj se detiene en el horizonte indicado. Los pacientes
                    pendientes se reportan como activos, no como egresados.
                  </div>
                </aside>
              </div>
              {run && (
                <div className="section-heading">
                  <div>
                    <h2>Último resultado consultado</h2>
                    <p>
                      {run.config.doctors} médicos ·{" "}
                      {run.config.duration_minutes} min · semilla{" "}
                      {run.config.seed} ·{" "}
                      {run.config.arrival_profile === "time_varying"
                        ? "demanda variable"
                        : "demanda estacionaria"}
                      . Los cambios del formulario se aplican al ejecutar.
                    </p>
                  </div>
                </div>
              )}
              {summary}
            </form>
          )}

          {page === "Resultados" && (
            <>
              {run ? (
                <>
                  <div className="result-meta">
                    <Tag>EXPERIMENTO GUARDADO</Tag>
                    <span>
                      {run.config.doctors} médicos ·{" "}
                      {f(run.config.duration_minutes / 60)} h · semilla{" "}
                      {run.config.seed} ·{" "}
                      {run.config.arrival_profile === "time_varying"
                        ? "demanda variable"
                        : "demanda estacionaria"}
                    </span>
                    <code>{run.id.slice(0, 8)}</code>
                  </div>
                  {summary}
                  <div
                    className="tabs"
                    role="tablist"
                    aria-label="Secciones del resultado"
                  >
                    {[
                      "Resumen",
                      "Triage",
                      "Recursos",
                      "Pacientes",
                      "Análisis",
                    ].map((tab) => (
                      <button
                        role="tab"
                        aria-selected={resultTab === tab}
                        id={`tab-${tab}`}
                        aria-controls="result-panel"
                        tabIndex={resultTab === tab ? 0 : -1}
                        onKeyDown={(event) => {
                          const tabs = [
                            "Resumen",
                            "Triage",
                            "Recursos",
                            "Pacientes",
                            "Análisis",
                          ];
                          let next = tabs.indexOf(tab);
                          if (event.key === "ArrowRight")
                            next = (next + 1) % tabs.length;
                          else if (event.key === "ArrowLeft")
                            next = (next + tabs.length - 1) % tabs.length;
                          else if (event.key === "Home") next = 0;
                          else if (event.key === "End") next = tabs.length - 1;
                          else return;
                          event.preventDefault();
                          setResultTab(tabs[next]);
                          document.getElementById(`tab-${tabs[next]}`)?.focus();
                        }}
                        key={tab}
                        onClick={() => setResultTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <div
                    id="result-panel"
                    role="tabpanel"
                    aria-labelledby={`tab-${resultTab}`}
                    tabIndex={0}
                  >
                    {resultTab === "Resumen" && (
                      <div className="two-cols results-charts">
                        <QueueChart run={run} />
                        <Panel>
                          <h2>Balance del recorrido</h2>
                          <dl className="balance">
                            {[
                              ["Llegadas generadas", run.metrics.generated],
                              ["Consultas finalizadas", run.metrics.treated],
                              ["Egresos", run.metrics.discharged],
                              ["Activos al corte", run.metrics.active_at_end],
                              [
                                "Abandonos (no modelados)",
                                run.metrics.abandoned,
                              ],
                            ].map(([label, v]) => (
                              <div key={label}>
                                <dt>{label}</dt>
                                <dd>{v}</dd>
                              </div>
                            ))}
                          </dl>
                          <div className="balance-foot">
                            <span>
                              Tiempo medio en sistema{" "}
                              <strong>
                                {f(run.metrics.mean_system_minutes)} min
                              </strong>
                            </span>
                            <span>
                              Utilización de triage{" "}
                              <strong>
                                {pct(run.metrics.triage_utilization)}
                              </strong>
                            </span>
                            <span>
                              Utilización de camas{" "}
                              <strong>
                                {pct(run.metrics.bed_utilization)}
                              </strong>
                            </span>
                          </div>
                          <p className="caption">
                            Permanencia: solo egresados. Espera: pacientes que
                            iniciaron consulta. Un egresado también cuenta como
                            atendido.
                          </p>
                        </Panel>
                      </div>
                    )}
                    {resultTab === "Recursos" && <ResourceState run={run} />}
                    {(resultTab === "Pacientes" || resultTab === "Triage") && (
                      <PatientResults key={run.id} run={run} />
                    )}
                    {resultTab === "Triage" && (
                      <div className="info-callout">
                        <h3>Espera por triage y distribución</h3>
                        <p>
                          El contrato actual devuelve marcas de tiempo
                          individuales, pero no promedios por triage ni
                          histogramas. Se muestran los registros originales sin
                          recalcular indicadores en el navegador.
                        </p>
                      </div>
                    )}
                    {resultTab === "Análisis" && (
                      <Panel>
                        <h2>Indicadores complementarios</h2>
                        <dl className="compact-details">
                          <div>
                            <dt>Cola máxima</dt>
                            <dd>{f(run.metrics.max_queue_length)} pacientes</dd>
                          </div>
                          <div>
                            <dt>Probabilidad de esperar</dt>
                            <dd>
                              {run.metrics.probability_wait == null
                                ? "Sin observación"
                                : pct(run.metrics.probability_wait)}
                            </dd>
                          </div>
                        </dl>
                        <p>{run.little.explanation}</p>
                        <button
                          className="secondary"
                          onClick={() => navigate("Teoría")}
                        >
                          Abrir teoría y Ley de Little
                        </button>
                      </Panel>
                    )}
                  </div>
                  <Panel>
                    <div className="section-heading">
                      <h2>Comparación de capacidad</h2>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            const d = await api<{ scenarios: Run[] }>(
                              "/simulations/compare",
                              run.config,
                            );
                            setScenarios(d.scenarios);
                            await refresh();
                          })
                        }
                      >
                        {busy ? "Ejecutando…" : "Comparar este escenario"}
                      </button>
                    </div>
                    {scenarios.length > 0 && (
                      <Comparison scenarios={scenarios} />
                    )}
                  </Panel>
                </>
              ) : (
                <Panel className="empty-state">
                  <BarChart3 size={38} />
                  <h2>Los resultados empiezan con un experimento</h2>
                  <p>
                    Ejecuta SimPy o recupera una corrida guardada. Aquí no hay
                    métricas de ejemplo inventadas.
                  </p>
                  <button
                    className="primary"
                    onClick={() => navigate("Simulación")}
                  >
                    Configurar simulación <ArrowRight size={16} />
                  </button>
                </Panel>
              )}
              <HistoryTable
                history={history}
                busy={busy}
                compact
                open={(id) =>
                  action(async () => {
                    setRun(await api<Run>("/simulations/" + id));
                    setScenarios([]);
                    setResultTab("Resumen");
                  })
                }
              />
            </>
          )}
          {page === "Historial" && (
            <>
              <button
                className="secondary page-action"
                disabled={busy}
                onClick={() => action(refresh)}
              >
                <RotateCcw size={15} /> Actualizar
              </button>
              <HistoryTable
                history={history}
                busy={busy}
                open={(id) =>
                  action(async () => {
                    setRun(await api<Run>("/simulations/" + id));
                    setScenarios([]);
                    setResultTab("Resumen");
                    navigate("Resultados");
                  })
                }
              />
            </>
          )}
          {page === "Comparar escenarios" && (
            <>
              <Panel>
                <div className="section-heading">
                  <div>
                    <h2>Configuración común · 1–4 médicos</h2>
                    <p>
                      Semilla {config.seed} · {f(config.duration_minutes / 60)}{" "}
                      h · {config.triage_staff} triage ·{" "}
                      {config.observation_beds} camas
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => navigate("Simulación")}
                  >
                    Editar configuración
                  </button>
                </div>
                <DemandProfile config={config} />
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => execute(true)}
                >
                  <Play size={16} /> Ejecutar comparación completa
                </button>
              </Panel>
              <Panel>
                <Comparison scenarios={scenarios} />
              </Panel>
            </>
          )}
          {page === "Telemetría" && (
            <>
              <div className="section-heading">
                <p>
                  Última actualización de telemetría: {updated ?? "Sin datos"}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => action(refresh)}
                >
                  <RotateCcw size={15} /> Actualizar
                </button>
              </div>
              <div className="three-cols">
                {[
                  ["API", online ? "Operativa" : "Sin conexión", online],
                  [
                    "Base de datos",
                    health?.database === "postgresql"
                      ? "PostgreSQL conectado"
                      : "Sin verificar",
                    health?.database === "postgresql",
                  ],
                  [
                    "Simulador",
                    telemetry ? "Telemetría disponible" : "Sin datos",
                    !!telemetry,
                  ],
                ].map(([name, status, ok]) => (
                  <Panel key={String(name)}>
                    <h2>{name}</h2>
                    <StatusBadge tone={ok ? "success" : "warning"}>
                      {status}
                    </StatusBadge>
                  </Panel>
                ))}
              </div>
              <Panel>
                <h2>Capacidad del motor de simulación</h2>
                <p>
                  Capacidad técnica del software por proceso. No representa
                  capacidad hospitalaria.
                </p>
                <dl className="telemetry-grid">
                  {[
                    [
                      "Solicitudes procesadas",
                      telemetry?.technical.requests_processed,
                    ],
                    [
                      "Corridas completadas",
                      telemetry?.technical.completed_simulations,
                    ],
                    [
                      "Simulaciones activas",
                      telemetry?.technical.active_simulations,
                    ],
                    [
                      "Ejecuciones simultáneas máximas",
                      telemetry?.technical.max_concurrent_simulations,
                    ],
                    [
                      "Corridas rechazadas",
                      telemetry?.technical.rejected_simulations,
                    ],
                    [
                      "Capacidad de cola interna",
                      telemetry?.technical.internal_queue_capacity,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value ?? "—"}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
            </>
          )}
          {page === "Metodología" && (
            <>
              <Panel>
                <h2>Diseño experimental</h2>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Etapa</th>
                        <th>Procedimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          "01 · Configurar",
                          "Fijar duración, semilla, demanda, política y tiempos de servicio sintéticos.",
                        ],
                        [
                          "02 · Variar capacidad",
                          "Comparar 1, 2, 3 y 4 médicos manteniendo las demás entradas.",
                        ],
                        [
                          "03 · Ejecutar",
                          "Una instancia SimPy por corrida. Guardar configuración y resultados.",
                        ],
                        [
                          "04 · Analizar",
                          "Leer Wq, p95, Lq, utilización, throughput y pendientes al corte.",
                        ],
                        [
                          "05 · Contrastar",
                          "Usar M/M/c solo bajo sus supuestos. Revisar censura en la Ley de Little.",
                        ],
                      ].map(([a, b]) => (
                        <tr key={a}>
                          <th>{a}</th>
                          <td className="wrap-cell">{b}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
              <Panel>
                <h2>Reproducibilidad y límites</h2>
                <p>
                  La semilla y el esquema de generación identifican las entradas
                  aleatorias. Conservar la configuración completa y exportar el
                  JSON permite rastrear cada experimento.
                </p>
                <p>
                  El sistema parte vacío y se detiene en un horizonte finito.
                  Los pendientes no se convierten en egresos. Una sola réplica
                  no aporta intervalos de confianza ni una recomendación
                  hospitalaria.
                </p>
                <button
                  className="secondary"
                  onClick={() => navigate("Laboratorio")}
                >
                  Abrir las 12 celdas del laboratorio
                </button>
              </Panel>
            </>
          )}

          {page === "Teoría" && (
            <>
              <div className="two-cols">
                <Panel>
                  <span className="eyebrow">REFERENCIA ANALÍTICA</span>
                  <h2>El modelo M/M/c</h2>
                  <p>
                    Llegadas Poisson estacionarias, tiempos de servicio
                    exponenciales e independientes, c servidores idénticos,
                    FIFO, cola ilimitada y régimen estable.
                  </p>
                  <div className="formula">
                    ρ = λ / (cμ) <span>ρ &lt; 1 para estabilidad</span>
                  </div>
                  <div className="glossary">
                    {[
                      ["λ", "Tasa de llegada, pacientes/minuto"],
                      ["μ", "Tasa de servicio por médico, 1/minuto"],
                      ["c", "Servidores en paralelo"],
                      ["ρ", "Utilización media teórica"],
                      ["W / Wq", "Tiempo en sistema / espera en cola"],
                      ["L / Lq", "Personas en sistema / en cola"],
                    ].map(([s, t]) => (
                      <div key={s}>
                        <strong>
                          {["λ", "μ", "ρ"].includes(s) ? (
                            <MetricHelp term={s} />
                          ) : (
                            s
                          )}
                        </strong>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel>
                  <h2>Calculadora de Erlang C</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      action(async () =>
                        setTheory(
                          await api<Reference>("/theory/mmc", theoryValues),
                        ),
                      );
                    }}
                  >
                    <div className="form-grid">
                      {(
                        [
                          ["arrival_per_hour", "Llegadas por hora", 120],
                          ["service_mean_minutes", "Servicio medio (min)", 480],
                          ["servers", "Servidores c", 50],
                        ] as const
                      ).map(([key, label, max]) => (
                        <label className="field" key={key}>
                          {label}
                          <input
                            required
                            type="number"
                            min={key === "servers" ? 1 : 0.1}
                            max={max}
                            step={key === "servers" ? 1 : 0.1}
                            value={theoryValues[key]}
                            onChange={(e) =>
                              setTheoryValues({
                                ...theoryValues,
                                [key]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <button className="primary" disabled={busy}>
                      Calcular M/M/c <ArrowRight size={15} />
                    </button>
                  </form>
                  {theory && (
                    <div className="theory-output">
                      <StatusBadge tone={theory.stable ? "success" : "error"}>
                        {theory.stable ? "ESTABLE" : "INESTABLE"}
                      </StatusBadge>
                      <div className="overview-strip">
                        {[
                          ["λ (pac./min)", theory.lambda_per_minute],
                          ["μ (1/min)", theory.mu_per_minute],
                          ["c", theory.c],
                          ["ρ", theory.rho],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{f(value as number, 3)}</strong>
                          </div>
                        ))}
                      </div>
                      {theory.stable ? (
                        <dl className="telemetry-grid">
                          {(["P0", "Pq", "Lq", "Wq", "W", "L"] as const).map(
                            (key) => (
                              <div key={key}>
                                <dt>
                                  <MetricHelp term={key} theory />
                                  {key.startsWith("W") ? " (min)" : ""}
                                </dt>
                                <dd>{f(theory[key], 3)}</dd>
                              </div>
                            ),
                          )}
                        </dl>
                      ) : (
                        <p>
                          Bajo los supuestos estacionarios de M/M/c, el sistema
                          no alcanza estado estable.
                        </p>
                      )}
                    </div>
                  )}
                </Panel>
              </div>
              <Panel>
                <h2>Teoría y SimPy: una comparación con contexto</h2>
                {run ? (
                  <>
                    <p>{run.theory.reason}</p>
                    {run.theory.reference ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Medida</th>
                              <th>Referencia M/M/c</th>
                              <th>DES observado</th>
                              <th>Diferencia DES − teoría</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td>Espera de consulta Wq (min)</td>
                              <td>{f(run.theory.reference.Wq)}</td>
                              <td>{f(run.metrics.mean_wait_minutes)}</td>
                              <td>{f(run.theory.difference_Wq)}</td>
                            </tr>
                            <tr>
                              <td>Cola de consulta Lq</td>
                              <td>{f(run.theory.reference.Lq)}</td>
                              <td>{f(run.metrics.mean_queue_length)}</td>
                              <td>
                                {run.theory.reference.Lq == null
                                  ? "No aplica"
                                  : f(
                                      run.metrics.mean_queue_length -
                                        run.theory.reference.Lq,
                                    )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {!run.theory.reference.stable && (
                          <p>{run.theory.reference.reason}</p>
                        )}
                      </div>
                    ) : (
                      <p>
                        Selecciona el perfil estacionario para obtener una
                        referencia de consulta. El perfil principal por franjas
                        no tiene un único equilibrio M/M/c.
                      </p>
                    )}
                  </>
                ) : (
                  <p>
                    Ejecuta una simulación para ver esta comparación. La
                    calculadora superior puede usarse de forma independiente.
                  </p>
                )}
                <p className="caption">
                  La consulta recibe la salida de triage, no necesariamente un
                  proceso Poisson. El DES parte vacío, usa un horizonte finito y
                  puede priorizar. La referencia analítica no equivale al
                  sistema completo.
                </p>
              </Panel>
              <Panel>
                <span className="eyebrow">CONSERVACIÓN Y HORIZONTE</span>
                <h2>Ley de Little</h2>
                <div className="formula">L = λW</div>
                <p>
                  L es la media temporal de personas dentro del sistema. Aquí λ
                  observado = egresos / duración y W observado = permanencia
                  media de quienes egresaron.
                </p>
                {run ? (
                  <>
                    <div className="metrics">
                      <Metric
                        label="L observado"
                        value={f(run.little.L_observed, 3)}
                        icon={<Users size={16} />}
                      />
                      <Metric
                        label="λ observado"
                        value={f(run.little.lambda_observed_per_minute, 4)}
                        unit="pac./min"
                        icon={<Activity size={16} />}
                      />
                      <Metric
                        label="W observado"
                        value={f(run.little.W_observed_minutes, 3)}
                        unit="min"
                        icon={<Clock3 size={16} />}
                      />
                      <Metric
                        label="λ × W"
                        value={f(run.little.lambda_W, 3)}
                        icon={<Layers3 size={16} />}
                      />
                    </div>
                    <p>
                      <strong>
                        Residuo L − λW: {f(run.little.difference, 6)}.
                      </strong>{" "}
                      Aporte de pacientes pendientes:{" "}
                      {f(run.little.censored_contribution, 6)}.
                    </p>
                    <p>{run.little.explanation}</p>
                  </>
                ) : (
                  <p className="empty-small">
                    Los valores observados aparecerán después de ejecutar una
                    simulación.
                  </p>
                )}
                <p className="caption">
                  No se fuerza igualdad usando promedios de poblaciones
                  distintas. Sin egresos, W y λW se muestran sin observación.
                </p>
              </Panel>
            </>
          )}

          {page === "Laboratorio" && (
            <>
              <Panel className="lab-intro">
                <div>
                  <Tag>12 CELDAS · PYTHON</Tag>
                  <h2>Un cuaderno conectado al código</h2>
                  <p>
                    Las celdas importan el motor real del backend. Descarga el
                    cuaderno y ejecútalo desde <code>backend/</code> con las
                    dependencias y matplotlib instalados.
                  </p>
                </div>
                <button className="primary" onClick={notebook}>
                  <Download size={17} /> Descargar .ipynb
                </button>
              </Panel>
              <p className="caption">
                El navegador muestra el contenido; no ejecuta Python. En Colab
                debes clonar tu repositorio, instalar backend/requirements.txt y
                matplotlib, y cambiar a backend/.
              </p>
              {cells.map((c, i) => (
                <Panel className="notebook-cell" key={c.title}>
                  <div className="cell-number">[{i + 1}]</div>
                  <div className="cell-content">
                    <h3>
                      Celda {i + 1} — {c.title}
                    </h3>
                    <p>{c.text}</p>
                    <pre>
                      <code>{c.code}</code>
                    </pre>
                    <button
                      className="secondary"
                      onClick={() =>
                        action(async () => {
                          await navigator.clipboard.writeText(c.code);
                          setNotice("Código copiado.");
                        })
                      }
                    >
                      Copiar celda {i + 1}
                    </button>
                    <details>
                      <summary>
                        Qué ocurre aquí · Cómo explicarlo en clase
                      </summary>
                      <p>{c.text}</p>
                      <p>
                        Relaciona esta celda con las entradas y salidas de la
                        corrida. Ejecuta el cuaderno descargado para obtener el
                        resultado; esta vista no ejecuta Python.
                      </p>
                    </details>
                    <div className="cell-output">
                      <strong>Resultado</strong>
                      <span>
                        Disponible al ejecutar esta celda en el cuaderno
                        descargado.
                      </span>
                    </div>
                  </div>
                </Panel>
              ))}
            </>
          )}

          {page === "Documentación" && (
            <>
              <nav
                className="document-nav"
                aria-label="Secciones de documentación"
              >
                {[
                  ["descripcion", "Descripción"],
                  ["arquitectura", "Arquitectura"],
                  ["doc-modelo", "Modelo"],
                  ["api", "API"],
                  ["doc-simulacion", "Simulación"],
                  ["supuestos", "Supuestos y limitaciones"],
                ].map(([id, label]) => (
                  <a
                    key={id}
                    href={"#" + encodeURIComponent("Documentación")}
                    onClick={(e) => {
                      e.preventDefault();
                      document
                        .getElementById(id)
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <section className="panel" id="descripcion">
                <h2>Acerca del proyecto</h2>
                <p>
                  SIMURGENCIAS · Centro de simulación y análisis de urgencias.
                </p>
                <p>
                  Proyecto de aula · Modelos y Simulación
                  <br />
                  Juan Fernando Murillo Mosquera
                </p>
              </section>
              <Panel>
                <span className="eyebrow">ARQUITECTURA DE LA ENTREGA 1</span>
                <h2 id="arquitectura">Arquitectura del sistema</h2>
                <div className="architecture">
                  {[
                    ["React + TypeScript", "Interfaz y experimentos"],
                    ["FastAPI", "Contratos y servicios"],
                    ["PostgreSQL", "Gestión y ejecuciones"],
                    ["SimPy", "Eventos y métricas"],
                  ].map(([a, b]) => (
                    <div key={a}>
                      <strong>{a}</strong>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                <p>
                  El backend orquesta el motor y persiste sus resultados;
                  PostgreSQL no ejecuta SimPy. Los pacientes simulados viven
                  dentro de cada corrida, separados de las tablas de gestión.
                </p>
              </Panel>
              <div className="two-cols">
                <Panel>
                  <h2 id="doc-simulacion">Arranque local y simulación</h2>
                  <pre>
                    <code>docker compose up --build</code>
                  </pre>
                  <p>
                    Interfaz: <a href="http://localhost:8080">localhost:8080</a>
                    <br />
                    API y contratos:{" "}
                    <a
                      href="http://localhost:8000/docs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      localhost:8000/docs
                    </a>
                  </p>
                  <p>
                    El arranque aplica Alembic y carga una semilla sintética
                    idempotente. PostgreSQL conserva datos en un volumen.
                  </p>
                  <h3>Verificación</h3>
                  <pre>
                    <code>
                      {
                        "docker compose exec backend pytest -q\ndocker compose exec backend python -m compileall -q app\ncd frontend\nnpm ci\nnpm run build\nnpm test"
                      }
                    </code>
                  </pre>
                </Panel>
                <Panel>
                  <h2>Capacidad técnica</h2>
                  <p>
                    <code>MAX_CONCURRENT_SIMULATIONS=2</code> limita ejecuciones
                    simultáneas por proceso. La cola interna tiene capacidad
                    cero; el exceso recibe HTTP 429 con Retry-After.
                  </p>
                  <p>
                    Uvicorn usa un proceso. Este límite mide admisión del
                    software; no demuestra rendimiento ni representa capacidad
                    física hospitalaria.
                  </p>
                  <h3>Preparado para crecer</h3>
                  <p>
                    Strategy, telemetría persistente, configuración versionable
                    y resultados exportables permiten ampliar el proyecto.
                    Carga, validación estadística, aprendizaje y agentes quedan
                    fuera de esta entrega.
                  </p>
                </Panel>
              </div>
              <Panel>
                <h2 id="api">Contratos principales</h2>
                <div className="endpoint-list">
                  {[
                    ["GET / POST", "/api/patients", "Pacientes sintéticos"],
                    ["GET / POST", "/api/attentions", "Atenciones e ingresos"],
                    [
                      "PATCH",
                      "/api/attentions/{id}",
                      "Transiciones del recorrido",
                    ],
                    [
                      "GET / PATCH",
                      "/api/resources · /api/resources/{id}",
                      "Configuración de recursos",
                    ],
                    [
                      "GET",
                      "/api/telemetry",
                      "Gestión, simulación y capacidad técnica",
                    ],
                    ["POST", "/api/simulations/run", "Ejecutar y guardar"],
                    [
                      "POST",
                      "/api/simulations/compare",
                      "Comparar 1–4 médicos",
                    ],
                    [
                      "GET",
                      "/api/simulations · /api/simulations/{id}",
                      "Historial y resultado completo",
                    ],
                    ["POST", "/api/theory/mmc", "Referencia de Erlang C"],
                  ].map(([method, path, text]) => (
                    <div key={path}>
                      <Tag>{method}</Tag>
                      <code>{path}</code>
                      <span>{text}</span>
                    </div>
                  ))}
                </div>
              </Panel>
              <Panel>
                <h2 id="supuestos">Supuestos y límites</h2>
                <h3 id="doc-modelo">Modelo DES</h3>
                <p>
                  Sistema inicialmente vacío; servicios exponenciales;
                  prioridades no expropiativas; recursos disponibles durante
                  todo el horizonte; observación probabilística; sin abandonos
                  ni bloqueos médicos durante la espera de cama. Una réplica por
                  escenario y sin calentamiento.
                </p>
                <p>
                  La aplicación es una demostración local sin autenticación ni
                  datos personales. El modelo de gestión permite una atención
                  por paciente. Los tiempos y la prioridad no expresan
                  protocolos clínicos.
                </p>
                <p>
                  La guía completa está en <code>README.md</code>, el modelo en{" "}
                  <code>docs/MODELO_DES.md</code> y la trazabilidad en{" "}
                  <code>docs/ENTREGA_1.md</code>.
                </p>
              </Panel>
            </>
          )}
        </main>
        <footer>
          <span>
            <HeartPulse size={14} /> SIMURGENCIAS <span>·</span> Modelos y
            Simulación
          </span>
          <span>Datos sintéticos · No representa un hospital real</span>
        </footer>
      </div>
    </div>
  );
}
