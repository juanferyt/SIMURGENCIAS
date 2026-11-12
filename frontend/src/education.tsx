import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";

export const glossary: Record<string, string> = {
  Wq: "Espera media entre fin de triage e inicio de consulta. Promedio ≠ todos esperaron lo mismo.",
  W: "Permanencia media desde llegada hasta egreso; solo incluye egresados.",
  Lq: "Pacientes en cola de consulta, promediados en el tiempo; no es un conteo instantáneo.",
  L: "Pacientes dentro del sistema, promediados en el tiempo.",
  p95: "Aproximadamente 95 % de las esperas observadas no supera este valor; 5 % lo supera.",
  utilización:
    "Fracción de la capacidad del recurso ocupada durante el horizonte.",
  throughput: "Egresos por unidad de tiempo; aquí se expresa en egresos/hora.",
  λ: "Tasa de llegada. Usa la misma unidad temporal que μ y W.",
  μ: "Tasa de servicio por servidor: inverso del tiempo medio de servicio.",
  ρ: "Demanda / capacidad en M/M/c. Solo con ρ < 1 existe equilibrio estacionario.",
  P0: "Probabilidad teórica de que el sistema esté vacío, entre 0 y 1.",
  Pq: "Probabilidad teórica de que un paciente deba esperar, entre 0 y 1.",
  DES: "Simulación de eventos discretos: el reloj avanza de un evento al siguiente.",
  seed: "Semilla que permite repetir la secuencia aleatoria; no es cantidad de pacientes.",
  horizonte: "Tiempo simulado entre el minuto 0 y el corte final.",
  pendientes:
    "Pacientes que siguen dentro del sistema al corte, en espera o recibiendo servicio.",
  prioridad:
    "Orden de acceso a consulta; no interrumpe una consulta que ya comenzó.",
  "M/M/c":
    "Llegadas Poisson, servicio exponencial y c servidores equivalentes.",
  Little:
    "Relaciona personas, tasa y tiempo: L = λW, con poblaciones y unidades compatibles.",
};

const theoreticalGlossary: Record<string, string> = {
  Wq: "Tiempo promedio teórico de espera en la cola M/M/c, en minutos.",
  W: "Tiempo promedio teórico en M/M/c: espera más servicio, en minutos.",
  Lq: "Cantidad promedio teórica de pacientes esperando en la cola M/M/c.",
  L: "Cantidad promedio teórica de pacientes en espera y en servicio en M/M/c.",
};

export function MetricHelp({
  term,
  label,
  theory = false,
}: {
  term: string;
  label?: string;
  theory?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const show = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 266)),
        ...(rect.bottom + 150 > window.innerHeight
          ? { bottom: window.innerHeight - rect.top }
          : { top: rect.bottom }),
      });
    setOpen(true);
  };
  return (
    <span
      className="metric-help"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={trigger}
        type="button"
        className="help-trigger"
        aria-label={`Ayuda: ${term}`}
        aria-describedby={open ? id : undefined}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={show}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            e.stopPropagation();
          }
        }}
      >
        {label ?? term} <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <span className="help-tooltip" style={position} id={id} role="tooltip">
          {(theory && theoreticalGlossary[term]) || glossary[term]}
        </span>
      )}
    </span>
  );
}

export function MetricLabel({ label }: { label: string }) {
  const term = label.includes("Wq")
    ? "Wq"
    : label.includes("Lq")
      ? "Lq"
      : label.includes("p95")
        ? "p95"
        : label.includes("Utilización")
          ? "utilización"
          : label.includes("Egresos/h")
            ? "throughput"
            : label.includes("Semilla")
              ? "seed"
              : label.includes("Pendientes")
                ? "pendientes"
                : undefined;
  return term ? <MetricHelp term={term} label={label} /> : <>{label}</>;
}

export function ExampleCard({
  children,
  real = false,
}: {
  children: ReactNode;
  real?: boolean;
}) {
  return (
    <div className="learning-card">
      <h3>{real ? "Resultado auditado · Entrega 1" : "Ejemplo sencillo"}</h3>
      {children}
    </div>
  );
}
export function InterpretationCard({ children }: { children: ReactNode }) {
  return (
    <div className="learning-card">
      <h3>Cómo interpretar</h3>
      {children}
    </div>
  );
}
export function FormulaCard({
  formula,
  children,
}: {
  formula: string;
  children: ReactNode;
}) {
  return (
    <div className="learning-card">
      <p className="learning-formula">{formula}</p>
      {children}
    </div>
  );
}
export function InfoPanel({
  title,
  description,
  howItWorks,
  example,
  interpretation,
  warning,
  overview,
  children,
}: {
  title: string;
  description: ReactNode;
  howItWorks?: ReactNode;
  example?: ReactNode;
  interpretation?: ReactNode;
  warning?: ReactNode;
  overview?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <section className="info-panel" aria-label={title}>
      <h2>{title}</h2>
      <p>{description}</p>
      {overview}
      <button
        type="button"
        className="learning-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? "Ocultar explicación" : "¿Cómo funciona?"}
        <span aria-hidden="true">{open ? " −" : " +"}</span>
      </button>
      <div id={id} hidden={!open} className="learning-details">
        {howItWorks && <div>{howItWorks}</div>}
        {example && <ExampleCard>{example}</ExampleCard>}
        {interpretation && (
          <InterpretationCard>{interpretation}</InterpretationCard>
        )}
        {warning && (
          <p className="learning-warning">
            <strong>Ten en cuenta: </strong>
            {warning}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export const fieldHelp: Record<string, string> = {
  triage_staff:
    "Personas en paralelo. Si todas están ocupadas, se forma cola antes del triage; aumentar este recurso puede reducir esa espera.",
  observation_beds:
    "Camas disponibles simultáneamente. Si se ocupan todas, los pacientes esperan cama; el médico ya queda libre.",
  duration_minutes:
    "Minutos simulados: 1.440 min = 24 h. El reloj empieza en 0 y se detiene al corte; un horizonte mayor permite más llegadas y servicios.",
  seed: "Entero sin unidad. Misma configuración, semilla y versión del motor reproducen las métricas; cambiarla cambia la secuencia, no fija cuántos pacientes llegan.",
  stationary_rate_per_hour:
    "Pacientes/hora en promedio, constante durante la corrida. Aumentarla eleva la demanda esperada, no garantiza un conteo exacto.",
  triage_mean_minutes:
    "Minutos por triage en promedio. Una media mayor ocupa el recurso más tiempo y puede aumentar su cola.",
  consultation_mean_minutes:
    "Minutos por consulta en promedio. Con 18 min, un médico tiene tasa media 60/18 ≈ 3,33 pacientes/h; servicios más largos reducen capacidad.",
  observation_mean_minutes:
    "Minutos por observación en promedio. Aumentarlos puede prolongar la ocupación de camas y la permanencia.",
  observation_probability:
    "Proporción entre 0 y 1, sin unidad: 0,20 significa 20 % de probabilidad por paciente. Aumentarla genera más demanda esperada de camas.",
};

export function MetricGuide() {
  return (
    <>
      <div className="learning-grid">
        {["Wq", "p95", "Lq", "utilización", "throughput"].map((term) => (
          <div key={term}>
            <MetricHelp term={term} />
            <p>{glossary[term]}</p>
          </div>
        ))}
      </div>
      <ExampleCard real>
        <p>
          Con 2 médicos y semilla 42, Wq = 21,61 min: quienes iniciaron consulta
          esperaron unos 21,6 minutos en promedio después del triage. p95 ≈ 97
          min: aproximadamente el 95 % de esas esperas está en o por debajo de
          97 min, y cerca del 5 % por encima.
        </p>
      </ExampleCard>
      <InterpretationCard>
        <p>
          p95 ayuda a ver esperas largas que el promedio puede ocultar. Es un
          percentil de esperas de pacientes, no el p95 de las medias entre
          repeticiones. Quienes siguen en cola al corte aún no tienen espera
          final observada.
        </p>
        <p>
          En las 30 réplicas con 2 médicos, la media de Lq fue 6,46 pacientes y
          la de utilización 72,25 %: cola media temporal y capacidad médica
          ocupada. No hubo necesariamente 6,46 personas en un instante. El
          throughput medio fue 4,90 egresos/hora.
        </p>
        <p>
          100 % de utilización no significa necesariamente un mejor sistema;
          puede acompañarse de mayores esperas. Un guion o “Sin observación” no
          significa cero.
        </p>
      </InterpretationCard>
      <dl className="learning-definitions">
        <div>
          <dt>Generados</dt>
          <dd>Pacientes creados durante la corrida.</dd>
        </div>
        <div>
          <dt>Atendidos</dt>
          <dd>
            Pacientes que terminaron la consulta médica, según el backend.
            Pueden seguir en observación.
          </dd>
        </div>
        <div>
          <dt>Egresados</dt>
          <dd>Completaron todo su recorrido y salieron del sistema.</dd>
        </div>
        <div>
          <dt>Pendientes</dt>
          <dd>
            Siguen dentro al corte: esperando o en servicio. Generados =
            egresados + pendientes en este modelo sin abandonos.
          </dd>
        </div>
      </dl>
    </>
  );
}

export function PriorityExample() {
  return (
    <ExampleCard>
      <h3>Prioridad no expropiativa</h3>
      <ol className="learning-flow">
        <li>A ya está en consulta.</li>
        <li>B espera un médico.</li>
        <li>C llega con mayor prioridad y pasa por triage.</li>
        <li>Al liberarse el médico, C puede pasar antes que B.</li>
      </ol>
      <p>
        <strong>C NO interrumpe la consulta de A.</strong> La{" "}
        <MetricHelp term="prioridad" /> ordena la cola médica; a igual nivel se
        respeta el orden de solicitud. Con FIFO se atiende por orden de
        solicitud a consulta.
      </p>
    </ExampleCard>
  );
}

const labParts = [
  ["Importaciones", "Carga las librerías necesarias para el experimento."],
  ["Configuración", "Define recursos, tiempos, semilla y horizonte."],
  ["Entidades", "Representa pacientes y sus marcas de tiempo."],
  ["Recursos", "Crea triage, médicos y camas con capacidad limitada."],
  ["Proceso paciente", "Recorre esperas, servicios y egreso."],
  ["Llegadas", "Genera pacientes según las tasas sintéticas."],
  ["Ejecución", "Avanza el reloj hasta el horizonte elegido."],
  ["Métricas", "Resume tiempos, colas y ocupación del experimento."],
  ["Gráficas", "Permite observar cómo cambia la cola en el tiempo."],
  ["M/M/c", "Calcula una referencia bajo supuestos simplificados."],
  ["Little", "Relaciona permanencia, flujo y personas dentro del sistema."],
  ["Comparación", "Contrasta escenarios con 1–4 médicos."],
];

export function PageGuide({ page }: { page: string }) {
  switch (page) {
    case "Inicio":
      return (
        <InfoPanel
          title="¿Cómo funciona SIMURGENCIAS?"
          description="Estudia cómo la cantidad de médicos cambia las esperas y el flujo de pacientes de un servicio de urgencias simulado. La variable de decisión es la cantidad de médicos: 1, 2, 3 o 4. Puedes configurar, ejecutar y analizar un escenario."
          overview={
            <dl className="indicator-summary">
              {[
                ["Wq", "Espera promedio antes de consulta."],
                ["p95", "Valor que abarca el 95 % de las esperas."],
                ["Lq", "Cola de consulta promediada en el tiempo."],
                ["utilización", "Proporción de capacidad ocupada."],
                ["throughput", "Egresos por hora simulada."],
              ].map(([term, description]) => (
                <div key={term}>
                  <dt>
                    <MetricHelp term={term} />
                  </dt>
                  <dd>{description}</dd>
                </div>
              ))}
            </dl>
          }
          howItWorks={
            <>
              <p>
                <strong>La idea en sencillo:</strong> el sistema recibe
                pacientes, pero no puede atenderlos a todos a la vez. Cada
                recurso tiene un límite; cuando está ocupado, el siguiente
                paciente espera. El experimento permite observar cómo cambia
                esa espera al variar la cantidad de médicos.
              </p>
              <p>
                La variable de decisión es la cantidad de médicos: 1, 2, 3 o 4
                disponibles simultáneamente. El motor usa{" "}
                <MetricHelp term="DES" />.
              </p>
              <ol className="learning-flow">
                <li>
                  El reloj simulado genera una llegada según la tasa de la
                  franja horaria.
                </li>
                <li>
                  El paciente espera triage si el personal está ocupado y
                  después recibe una clasificación sintética.
                </li>
                <li>
                  Espera un médico disponible; la prioridad ordena a quienes
                  siguen en la cola, pero no interrumpe una consulta iniciada.
                </li>
                <li>
                  Tras la consulta, puede solicitar observación o egresar. Si
                  no hay cama, espera sin ocupar al médico.
                </li>
                <li>
                  Al llegar el tiempo límite, se calculan esperas, colas,
                  ocupación, egresos y pacientes que siguen dentro.
                </li>
              </ol>
              <p>
                <strong>Qué responde:</strong> cómo se comportó este escenario
                con estos datos y esta semilla. No predice lo que ocurrirá en un
                hospital ni determina por sí solo cuántos médicos se deben
                contratar.
              </p>
              <MetricGuide />
            </>
          }
        />
      );
    case "Simulación":
      return (
        <InfoPanel
          title="Antes de ejecutar"
          description="En esta sección se configura el escenario que se quiere simular. Cambia los parámetros y ejecuta para observar la respuesta del modelo."
          howItWorks={
            <>
              <p>
                <strong>Cómo usar esta sección:</strong> define primero qué
                escenario quieres estudiar; luego cambia solo los parámetros
                que te interesa evaluar y pulsa ejecutar. El backend crea una
                corrida nueva, guarda su configuración y devuelve sus
                resultados. Cambiar un valor no altera corridas anteriores.
              </p>
              <p>
                <strong>Médicos (personas):</strong> cantidad disponible
                simultáneamente. Con 1 médico solo un paciente puede estar en
                consulta; con 3, hasta tres a la vez. Más capacidad puede
                reducir la cola, pero no establece por sí sola cuál escenario
                conviene.
              </p>
              <p>
                <MetricHelp term="horizonte" />: duration_minutes = 1440
                equivale a 1.440 minutos = 24 horas. Comienza en minuto 0 y
                termina en minuto 1.440; quienes siguen dentro se registran como{" "}
                <MetricHelp term="pendientes" />.
              </p>
              <p>
                <MetricHelp term="seed" /> = 42: dos ejecuciones con exactamente
                la misma configuración, versión y semilla producen las mismas
                secuencias y métricas. Los identificadores, fechas y tiempo de
                cómputo pueden cambiar.
              </p>
              <ExampleCard real>
                <p>
                  Configuración auditada: 2 médicos, 24 h, 1 triage, 4 camas,
                  llegadas 2/5/9/6 por hora, servicios medios 5/18/60 min,
                  observación 0,20 y prioridad por triage.
                </p>
                <ul>
                  <li>
                    Seed 42: 144 generados, 130 atendidos, 130 egresados, 14
                    pendientes.
                  </li>
                  <li>
                    Seed 100: 143 generados, 119 atendidos, 117 egresados, 26
                    pendientes.
                  </li>
                </ul>
                <p>
                  La semilla NO significa cantidad de pacientes; permite
                  reproducir experimentos.
                </p>
              </ExampleCard>
              <p>
                <strong>Perfil de llegadas:</strong> el modelo no supone la
                misma velocidad todo el día. Las tasas son promedios sintéticos,
                no citas ni cantidades garantizadas.
              </p>
              <ol className="learning-flow">
                <li>00–06 → 2 pacientes/h</li>
                <li>06–12 → 5 pacientes/h</li>
                <li>12–18 → 9 pacientes/h</li>
                <li>18–24 → 6 pacientes/h</li>
              </ol>
              <p>
                Entre 12:00 y 18:00 se configura la mayor demanda del perfil
                inicial. Las franjas se repiten cada 24 h; el perfil
                estacionario conserva una sola tasa.
              </p>
              <p>
                <strong>Triage:</strong> recurso limitado de registro y
                clasificación del modelo. Si está ocupado, se espera antes de
                pasar; después, el nivel I–V ordena la consulta, con I como
                mayor prioridad. No representa protocolos médicos reales.
              </p>
              <PriorityExample />
              <p>
                <strong>Servicios exponenciales:</strong> cada duración se
                sortea; una media de 18 min no significa que todas las consultas
                duren 18 min. La probabilidad de observación decide qué
                pacientes solicitan cama después de la consulta.
              </p>
              <p>
                <strong>Al revisar el resultado:</strong> compara primero
                pacientes generados con egresados y pendientes; después mira
                espera y utilización. Así puedes distinguir una cola larga de
                pacientes que simplemente siguen en servicio cuando termina el
                horizonte.
              </p>
            </>
          }
        />
      );
    case "Resultados":
      return (
        <InfoPanel
          title="Cómo leer esta corrida"
          description="Esta página muestra lo que ocurrió durante una corrida. Wq y p95 miden espera de consulta, Lq mide cola, utilización mide ocupación y throughput mide egresos por hora."
          howItWorks={
            <>
              <p>
                <strong>Lee los resultados en este orden:</strong> primero
                revisa cuántos pacientes llegaron y cuántos completaron el
                recorrido; luego mira cuánto esperaron y cómo se ocuparon los
                recursos. Cada cifra describe una parte distinta de la corrida,
                no una calificación general de “buena” o “mala”.
              </p>
              <MetricGuide />
            </>
          }
        />
      );
    case "Historial":
      return (
        <InfoPanel
          title="Volver a un experimento"
          description="Una corrida es una ejecución del modelo con una configuración y una semilla. El historial permite recuperar lo que ya ejecutaste."
          howItWorks={
            <>
              <p>
                <strong>Qué hace “Abrir”:</strong> vuelve a mostrar los datos
                guardados de esa ejecución; no inicia otra simulación ni
                modifica su resultado. Usa esta función para recuperar la
                configuración exacta y comparar experimentos hechos en
                momentos diferentes.
              </p>
              <p>
                Se guardan identificador, fecha, configuración y métricas; al
                pulsar Abrir se recupera el resultado completo, con pacientes y
                serie temporal si esa corrida los incluye. Cambiar el formulario
                no modifica una corrida guardada.
              </p>
              <p>
                La columna Pacientes cuenta generados; <MetricHelp term="Wq" />{" "}
                y <MetricHelp term="utilización" /> resumen la consulta médica.
                La fecha indica cuándo se ejecutó en la plataforma, no el tiempo
                del reloj simulado.
              </p>
            </>
          }
          example="Puedes ejecutar un escenario con 2 médicos, luego uno con 3 y volver al historial para abrir ambos. Guardarlos permite revisar configuración y resultados sin depender de la memoria."
          warning="Para atribuir diferencias al número de médicos, conserva los demás parámetros y compara semillas comunes. Una corrida no describe toda la variabilidad."
        />
      );
    case "Comparar escenarios":
      return (
        <InfoPanel
          title="Comparar capacidad con contexto"
          description="Comparar no significa buscar automáticamente el número de médicos con menor espera. Observa juntos espera, cola, utilización y throughput."
          howItWorks={
            <>
              <p>
                El botón de comparación ejecuta una corrida por cada cantidad de
                médicos con la misma configuración y semilla.{" "}
                <MetricHelp term="Wq" /> y <MetricHelp term="Lq" /> describen
                congestión; <MetricHelp term="utilización" /> y{" "}
                <MetricHelp term="throughput" /> muestran ocupación y egresos.
              </p>
              <ol className="learning-steps">
                <li>
                  Mantén iguales llegadas, horizonte, tiempos de servicio y
                  semilla.
                </li>
                <li>
                  Ejecuta los escenarios con 1, 2, 3 y 4 médicos.
                </li>
                <li>
                  Compara las métricas juntas: menos espera puede requerir más
                  capacidad, mientras que los egresos muestran cuánto flujo
                  completó el sistema.
                </li>
              </ol>
              <ExampleCard real>
                <p>
                  Medias de 30 réplicas por escenario, semillas 42–71 y
                  horizonte de 24 h. Fuente: docs/RESULTADOS_ENTREGA_1.md,
                  sección C–D. Estos valores de referencia no reemplazan tu
                  comparación actual.
                </p>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  aria-label="Referencia auditada de treinta réplicas"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Médicos</th>
                        <th>Wq (min)</th>
                        <th>Lq (pac.)</th>
                        <th>Utilización</th>
                        <th>Egresos/h</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["1", "88,33", "21,458", "87,11 %", "3,00"],
                        ["2", "43,05", "6,461", "72,25 %", "4,90"],
                        ["3", "10,61", "1,113", "54,05 %", "5,49"],
                        ["4", "1,75", "0,173", "40,91 %", "5,56"],
                      ].map((row) => (
                        <tr key={row[0]}>
                          {row.map((v, i) => (
                            <td key={i}>{v}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ExampleCard>
            </>
          }
          interpretation="En estas réplicas, al aumentar médicos disminuyen espera y cola, pero también la utilización. Entre 3 y 4 médicos, el throughput medio sube solo de 5,49 a 5,56 egresos/hora."
          warning="No existe todavía una función de costos; no se puede concluir que 4 médicos sea la solución óptima. El p95 de una corrida se refiere a pacientes; la media de 30 p95 y el p95 de 30 medias son estadísticas distintas."
        />
      );
    case "Teoría":
      return (
        <InfoPanel
          title="Leer M/M/c desde cero"
          description="M/M/c ofrece una referencia de una cola con c servidores. Úsala para entender demanda, capacidad y estabilidad antes de interpretar el sistema completo."
          howItWorks={
            <>
              <p>
                <strong>Para qué sirve:</strong> M/M/c es un cálculo de
                referencia más sencillo que ayuda a relacionar demanda,
                velocidad de servicio y número de servidores. No incluye todo
                el recorrido del modelo de urgencias.
              </p>
              <p>
                <MetricHelp term="M/M/c" />: primera M, llegadas
                Markovianas/Poisson, con tiempos entre llegadas exponenciales.
                Segunda M: tiempos de servicio exponenciales. c: cantidad de
                servidores equivalentes, aquí médicos.
              </p>
              <p>
                <MetricHelp term="λ" /> es llegada; <MetricHelp term="μ" /> es
                servicio por médico; <MetricHelp term="ρ" /> es demanda relativa
                a capacidad.
              </p>
              <FormulaCard formula="ρ = λ / (c × μ)">
                <p>
                  Usa las mismas unidades para λ y μ. Con λ = 9 pacientes/h y
                  servicio medio de 18 min, μ = 60/18 ≈ 3,33 pacientes/h por
                  médico.
                </p>
              </FormulaCard>
              <ol className="learning-steps">
                <li>
                  Expresa llegada y servicio en la misma unidad, por ejemplo,
                  pacientes por hora.
                </li>
                <li>
                  Calcula la capacidad total multiplicando la tasa de un médico
                  por la cantidad de médicos.
                </li>
                <li>
                  Compara demanda con capacidad mediante ρ; si ρ es menor que 1,
                  el modelo teórico puede alcanzar equilibrio.
                </li>
                <li>
                  Solo entonces interpreta las esperas y cantidades promedio
                  que calcula Erlang C.
                </li>
              </ol>
              <ExampleCard>
                <ul>
                  <li>1 médico: ρ = 2,70 → INESTABLE.</li>
                  <li>2 médicos: ρ = 1,35 → INESTABLE.</li>
                  <li>3 médicos: ρ = 0,90 → ESTABLE.</li>
                  <li>4 médicos: ρ = 0,675 → ESTABLE.</li>
                </ul>
                <p>
                  Si ρ ≥ 1, la demanda iguala o supera la capacidad
                  estacionaria. No existe Wq estacionario finito; una simulación
                  con corte sí puede mostrar una espera observada finita.
                </p>
              </ExampleCard>
              <dl className="learning-definitions">
                {[
                  ["P0", "Sin unidad: probabilidad de sistema vacío."],
                  ["Pq", "Sin unidad: probabilidad de tener que esperar."],
                  ["Lq", "Pacientes: cantidad promedio teórica en cola."],
                  ["Wq", "Minutos: tiempo promedio teórico de espera en cola."],
                  [
                    "W",
                    "Minutos: tiempo promedio teórico en el sistema, espera más servicio.",
                  ],
                  [
                    "L",
                    "Pacientes: cantidad promedio teórica dentro del sistema.",
                  ],
                ].map(([term, text]) => (
                  <div key={term}>
                    <dt>
                      <MetricHelp term={term} theory />
                    </dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <h3>
                ¿Por qué M/M/c y SimPy no tienen que dar exactamente lo mismo?
              </h3>
              <p>
                M/M/c supone llegadas estacionarias, una sola cola FIFO,
                servicio exponencial, servidores equivalentes y estado
                estacionario. SIMURGENCIAS completo añade llegadas variables,
                triage, prioridad, múltiples etapas, observación y horizonte
                finito.
              </p>
              <ExampleCard real>
                <p>
                  Verificación simplificada compatible, c = 3: Wq teórico =
                  49,02 min; SimPy ≈ 50,73 min; diferencia ≈ 3,48 %. Es
                  evidencia de coherencia bajo supuestos compatibles, no
                  igualdad exigible al modelo completo. Fuente:
                  RESULTADOS_ENTREGA_1, secciones G–H.
                </p>
              </ExampleCard>
              <h3>Ley de Little</h3>
              <p>
                <MetricHelp term="Little" /> relaciona flujo, permanencia y
                ocupación media.
              </p>
              <FormulaCard formula="L = λW · Lq = λWq">
                <p>
                  Relaciona cantidad media, flujo y tiempo, con unidades y
                  poblaciones compatibles.
                </p>
              </FormulaCard>
              <ExampleCard>
                <p>
                  En equilibrio, si salen aproximadamente 5 pacientes/hora y
                  permanecen 0,5 horas, L ≈ 5 × 0,5 = 2,5 pacientes en promedio.
                </p>
              </ExampleCard>
              <InterpretationCard>
                <p>
                  En SIMURGENCIAS hay horizonte finito y pacientes pendientes. W
                  solo incluye egresados; L acumula también el tiempo de quienes
                  siguen dentro. Por eso L − λW puede ser distinto de cero. No
                  fuerces la igualdad ni mezcles horas con minutos.
                </p>
              </InterpretationCard>
            </>
          }
        />
      );
    case "Modelo":
      return (
        <InfoPanel
          title="Qué representa el modelo"
          description="El paciente es la entidad que recorre el sistema. Los recursos limitan cuántos pacientes pueden recibir cada servicio a la vez."
          howItWorks={
            <>
              <p>
                <strong>Piensa en una agenda de sucesos:</strong>{" "}
                <MetricHelp term="DES" /> no calcula cada segundo vacío;
                adelanta el reloj al próximo suceso importante, como una
                llegada, el fin de un triage o la liberación de un médico.
                Cuando ocurre, actualiza colas y recursos y programa los
                siguientes sucesos.
              </p>
              <p>
                Cada paciente lleva sus propios tiempos. Triage, médicos y camas
                son recursos limitados: si todos están ocupados, la solicitud
                espera en la cola correspondiente.
              </p>
              <ol className="learning-flow">
                <li>El paciente llega y queda registrado en el sistema.</li>
                <li>
                  Espera e inicia triage; al terminar, queda en la cola médica.
                </li>
                <li>
                  Un médico libre toma al paciente según prioridad y orden de
                  solicitud.
                </li>
                <li>
                  Al terminar la consulta, el médico queda libre. Si corresponde
                  observación, el paciente espera una cama y luego egresa.
                </li>
              </ol>
              <p>
                <strong>Ejemplo:</strong> si dos pacientes esperan consulta y
                hay un médico libre, el primero según prioridad inicia atención;
                la cola baja en uno y los médicos ocupados suben en uno. Al
                terminar, ese médico vuelve a estar disponible.
              </p>
              <p>
                <strong>Variables de estado:</strong> personas en cada cola,
                recursos ocupados y pacientes que siguen dentro. Las métricas se
                calculan a partir de los cambios ocurridos durante el tiempo
                simulado.
              </p>
              <PriorityExample />
            </>
          }
          warning="El médico se libera al terminar consulta, incluso si el paciente espera una cama. Los niveles de triage son prioridades sintéticas del modelo."
        />
      );
    case "Metodología":
      return (
        <InfoPanel
          title="Cómo se desarrolló el proyecto"
          description="La Entrega 1 conecta el problema, los supuestos, el motor y la evidencia. Este recorrido permite revisar de dónde salen los resultados."
          howItWorks={
            <>
              <p>
                <strong>El trabajo conecta cuatro cosas:</strong> una pregunta
                delimitada, una representación del proceso, un programa que
                ejecuta esa representación y evidencia para revisar si los
                resultados son coherentes.
              </p>
              <ol className="learning-steps">
                {[
                  "Delimitar el problema: estudiar esperas y capacidad médica.",
                  "Construir el modelo conceptual: identificar pacientes, etapas y recursos.",
                  "Formular supuestos: datos sintéticos, servicios exponenciales y horizonte finito.",
                  "Revisar con teoría de colas: estudiar estabilidad con M/M/c.",
                  "Implementar SimPy v0: representar procesos y eventos.",
                  "Integrar con API: ejecutar y guardar configuraciones y resultados.",
                  "Ejecutar escenarios: variar 1–4 médicos conservando los controles.",
                  "Analizar resultados: contrastar espera, colas, ocupación y egresos.",
                  "Validar: verificar reproducibilidad, balances y referencia simplificada.",
                  "Documentar limitaciones: no hay datos hospitalarios ni función de costos.",
                ].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p>
                <strong>Qué significa validar aquí:</strong> comprobar que el
                programa sigue sus reglas, repite una corrida con la misma
                semilla y conserva balances coherentes. No significa demostrar
                que el modelo represente un hospital real.
              </p>
            </>
          }
          interpretation="La auditoría usa 30 réplicas por escenario; la comparación interactiva usa una. La verificación del software no equivale a validar el modelo contra un hospital real."
        />
      );
    case "Telemetría":
      return (
        <InfoPanel
          title="Leer el estado técnico"
          description="Esta sección observa el funcionamiento técnico de la plataforma, no el estado de un hospital."
          howItWorks={
            <>
              <p>
                <strong>Esta página habla del software:</strong> informa si el
                motor está ejecutando trabajos y qué datos quedaron guardados.
                No muestra ocupación, pacientes ni actividad de un hospital
                real.
              </p>
              <dl className="learning-definitions">
                <div>
                  <dt>Simulaciones activas</dt>
                  <dd>
                    Ejecuciones que el software procesa ahora; no pacientes ni
                    médicos ocupados.
                  </dd>
                </div>
                <div>
                  <dt>Últimas corridas</dt>
                  <dd>
                    Experimentos que ya terminaron y cuyos resultados se
                    pueden volver a consultar.
                  </dd>
                </div>
                <div>
                  <dt>Estado de gestión</dt>
                  <dd>
                    Registros sintéticos de pacientes, atenciones y recursos;
                    están separados de los pacientes de una corrida SimPy.
                  </dd>
                </div>
                <div>
                  <dt>Timestamps</dt>
                  <dd>
                    Fecha y hora de registro o actualización; no son minutos
                    simulados.
                  </dd>
                </div>
                <div>
                  <dt>Persistencia</dt>
                  <dd>
                    Datos guardados en PostgreSQL que se pueden recuperar al
                    volver a abrir la plataforma.
                  </dd>
                </div>
              </dl>
            </>
          }
          example="Puede haber 0 simulaciones activas y muchas corridas guardadas: el motor está libre y el historial conserva experimentos."
          warning="La capacidad técnica de ejecuciones simultáneas no mide capacidad asistencial. Wq, Lq y throughput pertenecen a una simulación, no al rendimiento del servidor."
        />
      );
    case "Laboratorio":
      return (
        <InfoPanel
          title="Estudiar el modelo paso a paso"
          description="El notebook permite seguir el modelo desde su configuración hasta sus resultados. Las doce partes muestran cómo se conectan los conceptos con el código."
          howItWorks={
            <>
              <h3>¿Qué aprenderé aquí?</h3>
              <p>
                A representar pacientes y recursos, ejecutar eventos, leer
                métricas y contrastar el resultado con M/M/c y Little.
              </p>
              <ol className="learning-steps">
                {labParts.map(([name, text]) => (
                  <li key={name}>
                    <strong>{name}:</strong> {text}
                  </li>
                ))}
              </ol>
              <p>
                <strong>Por qué ejecutarlas en orden:</strong> las primeras
                celdas preparan librerías y parámetros; las siguientes
                construyen el modelo y ejecutan la corrida; las últimas usan
                esos resultados para calcular y explicar métricas. Si cambias
                una configuración, vuelve a ejecutar las celdas posteriores
                para que no mezclen valores antiguos y nuevos.
              </p>
              <h3>¿Qué debería ejecutar?</h3>
              <p>
                Descarga el notebook, ábrelo en Jupyter y ejecuta las celdas del
                1 al 12 en orden, con las dependencias del proyecto instaladas.
                Si cambias configuración, reinicia el kernel y ejecuta todo para
                evitar mezclar resultados. Esta página permite copiar las celdas
                y descargar el notebook; el navegador no ejecuta Python. Abre el
                cuaderno desde backend/ con las dependencias y matplotlib
                instalados.
              </p>
            </>
          }
        />
      );
    case "Documentación":
      return (
        <InfoPanel
          title="Encuentra la explicación que necesitas"
          description="Elige una pregunta para ubicar la fuente del proyecto. Los documentos pertenecen al repositorio; el laboratorio también está disponible en esta plataforma."
          howItWorks={
            <>
              <p>
                <strong>Empieza por tu pregunta:</strong> cada documento
                responde algo distinto. Lee primero el alcance para saber qué
                se modela; después revisa el modelo y, por último, consulta los
                resultados y las pruebas que los respaldan.
              </p>
              <dl className="learning-definitions">
                {[
                  [
                    "Quiero entender el proyecto",
                    "README.md y docs/ENTREGA_1.md: alcance, instalación y trazabilidad.",
                  ],
                  [
                    "Quiero entender el modelo",
                    "docs/MODELO_DES.md: entidades, recursos, eventos y supuestos.",
                  ],
                  [
                    "Quiero revisar resultados",
                    "docs/RESULTADOS_ENTREGA_1.md: configuración, réplicas y resultados auditados.",
                  ],
                  [
                    "Quiero revisar pruebas",
                    "docs/VERIFICACION.md: verificaciones y evidencia del comportamiento.",
                  ],
                  [
                    "Quiero estudiar el código",
                    "Laboratorio / notebook: doce partes para recorrer el modelo.",
                  ],
                ].map(([q, a]) => (
                  <div key={q}>
                    <dt>{q}</dt>
                    <dd>{a}</dd>
                  </div>
                ))}
              </dl>
            </>
          }
          interpretation={
            <p>
              Para estudiar el código, abre{" "}
              <a href="#Laboratorio">Laboratorio</a>. Para interpretar un dato,
              revisa primero qué población incluye y cuál es su unidad.
            </p>
          }
        />
      );
    default:
      return null;
  }
}
