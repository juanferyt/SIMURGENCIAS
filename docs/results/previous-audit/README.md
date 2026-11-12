# SIMURGENCIAS · Entrega 1

Plataforma académica para la gestión, simulación y análisis de un servicio de urgencias. Asignatura **Modelos y Simulación**.

**Datos sintéticos · escenario experimental · modelo académico.** No describe un hospital real, no implementa protocolos clínicos y no recomienda una dotación médica.

## Problema y objetivo

La demanda variable y los recursos finitos generan esperas que no se explican solo con promedios diarios. El objetivo es representar un recorrido de urgencias mediante eventos discretos, experimentar con **1, 2, 3 y 4 médicos**, y contrastar los resultados con teoría de colas, haciendo explícitos los supuestos y el horizonte finito.

La carpeta inicial estaba vacía: no existían código, dependencias, repositorio Git ni funcionalidades que migrar. El inventario y la trazabilidad están en [docs/ENTREGA_1.md](docs/ENTREGA_1.md).

## Alcance

- **Gestión:** pacientes sintéticos, ingresos, transiciones de atención y configuración de recursos persistentes.
- **Gemelo digital:** SimPy independiente de la gestión; llegadas variables, prioridad no expropiativa, triage, consulta y observación opcional.
- **Análisis:** métricas integradas por evento, gráficas, comparación reproducible, Erlang C y balance finito de Little.
- **Laboratorio:** 12 celdas explicadas, descarga `.ipynb` y [cuaderno versionado](notebooks/SIMURGENCIAS_Entrega_1.ipynb).

No se implementan Locust, PyMC, KS, Machine Learning, Mesa ni agentes de decisión.

## Arquitectura y tecnologías

```mermaid
flowchart TD
  UI[React + TypeScript / Vite] --> API[FastAPI]
  API --> G[Servicios de gestión]
  API --> S[Servicio de simulación]
  API --> T[Telemetría y análisis]
  G --> DB[(PostgreSQL 16 / SQLAlchemy / Alembic)]
  S --> DES[EmergencyDepartment / SimPy]
  DES --> R[Métricas + M/M/c + Little]
  S --> DB
  R --> S
  T --> DB
```

PostgreSQL almacena configuración y resultados; **el backend ejecuta SimPy**, no la base de datos. Las corridas no crean filas en `patients` ni `attentions`. La interfaz usa React 19, TypeScript, Recharts y Lucide. El backend usa Python 3.12, Pydantic, SQLAlchemy 2, psycopg y migraciones Alembic. Dependencias frontend bloqueadas con `package-lock.json`; versiones backend fijadas en `requirements.txt`.

```text
backend/app/              API, persistencia, servicios y semilla
backend/app/simulation/   Dominio POO, Strategy, DES y teoría
backend/migrations/       Migraciones versionadas de PostgreSQL
backend/tests/            Pruebas numéricas y de integración
frontend/src/             Siete secciones de la interfaz
frontend/tests/           Pruebas de navegador con API real
notebooks/               Laboratorio reproducible
scripts/                 Generación del cuaderno
docs/                    Modelo, trazabilidad y evidencia
```

## Ejecutar todo con Docker

Requisitos: Docker Desktop con motor Linux activo y puertos locales 8080, 8000 y 55440 libres.

```powershell
docker compose up --build
```

- Interfaz: http://localhost:8080
- API / Swagger: http://localhost:8000/docs
- Salud y conexión PostgreSQL: http://localhost:8000/api/health
- PostgreSQL: `localhost:55440`, base/usuario `simurgencias`, contraseña local `simurgencias_demo`. Puerto interno: 5432; el externo es configurable con `POSTGRES_PORT`. Windows rechazó publicar 5432 en este equipo, por lo que se eligió otro puerto sin alterar la configuración del sistema.

Compose espera la salud de PostgreSQL; el backend aplica `alembic upgrade head`, carga una semilla idempotente y arranca Uvicorn con un proceso. Nginx sirve el frontend y reenvía `/api` al backend. El volumen `postgres_data` conserva las ejecuciones al reiniciar.

Para personalizar valores, copiar `.env.example` a `.env` antes del arranque. El `DATABASE_URL` de Compose se construye con las variables PostgreSQL y el host `postgres`; el ejemplo con `localhost` se usa en ejecución manual. Las credenciales son solo de desarrollo. Los puertos se publican en loopback y no hay autenticación en esta entrega.

```powershell
docker compose ps
docker compose logs backend
docker compose down
```

`down` conserva el volumen. No usar `down -v` si se quieren conservar resultados.

## Ejecutar por separado

### PostgreSQL

```powershell
docker compose up -d postgres
```

También puede utilizarse una instalación propia de PostgreSQL 16 con una base vacía y un usuario con permisos para crear las tablas.

### Backend (Python 3.12)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL='postgresql+psycopg://simurgencias:simurgencias_demo@localhost:55440/simurgencias'
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

En Linux/macOS, activar con `source .venv/bin/activate` y establecer la variable con `export DATABASE_URL=...`. El backend no carga `.env` automáticamente; Compose sí lo usa.

### Frontend (Node.js 22)

```powershell
cd frontend
npm ci
npm run dev
```

Abrir http://localhost:5173. Vite reenvía `/api` a `localhost:8000`. Para compilar: `npm run build`.

## Ejecutar una simulación

En **Simulación**, configurar recursos, duración, semilla, perfil de llegada, prioridad y tiempos; pulsar **Ejecutar simulación**. **Comparar 1–4 médicos** ejecuta los cuatro escenarios con demandas individuales idénticas. En Resultados se puede abrir el historial o exportar JSON.

Desde PowerShell:

```powershell
$body = @{ doctors=2; triage_staff=1; duration_minutes=1440; seed=42; arrival_profile='time_varying'; arrival_rates_per_hour=@(2,5,9,6) } | ConvertTo-Json
$run = Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/simulations/run -ContentType 'application/json' -Body $body
$run.metrics
Invoke-RestMethod -Uri "http://localhost:8000/api/simulations/$($run.id)"
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/simulations/compare -ContentType 'application/json' -Body $body
```

Sin base de datos, dentro de `backend/`:

```powershell
python -m app.cli --doctors 2 --seed 42 --minutes 1440 --output resultado.json
```

En Docker: `docker compose exec backend python -m app.cli --doctors 2 --seed 42`.

## API REST

| Método | Endpoint | Comportamiento |
|---|---|---|
| GET | `/api/health` | Verifica conexión con la base |
| GET / POST | `/api/patients` | Lista paginada / crea paciente con código sintético y triage 1–5 |
| GET / POST | `/api/attentions` | Lista paginada / registra ingreso para paciente existente |
| PATCH | `/api/attentions/{id}` | Avanza una etapa válida |
| GET | `/api/resources` | Lista configuraciones |
| PATCH | `/api/resources/{id}` | Actualiza médicos, triage y camas |
| GET | `/api/telemetry` | Estado de gestión, admisión técnica y últimas corridas |
| POST | `/api/simulations/run` | Ejecuta y guarda una corrida; 201 |
| POST | `/api/simulations/compare` | Cuatro corridas, 1–4 médicos; 201 |
| GET | `/api/simulations` | Historial resumido, hasta 100 corridas |
| GET | `/api/simulations/{id}` | Configuración, pacientes, métricas, serie y análisis |
| POST | `/api/theory/mmc` | Erlang C con detección de inestabilidad |

Contratos JSON completos: `/docs` y `/openapi.json`. Errores: 404 desconocido, 409 duplicado/transición inválida, 422 validación, 429 capacidad técnica ocupada. `patients` y `attentions` aceptan `limit` (1–500, defecto 100) y `offset`; la interfaz inicial presenta los primeros 100 registros.

Ejemplos de cuerpos:

```json
{"code":"DEMO-004","triage_level":3}
```
```json
{"patient_id":4}
```
```json
{"stage":"triage"}
```
```json
{"arrival_per_hour":5,"service_mean_minutes":18,"servers":2}
```

## Persistencia y telemetría

Tablas: `patients`, `attentions`, `resource_configurations`, `simulation_runs`, `telemetry` y `alembic_version`. La migración inicial es independiente de los modelos actuales. La semilla crea DEMO-001/002/003 y una configuración de 2 médicos, 1 triage, 4 camas; no inventa corridas ni métricas.

Cada corrida almacena configuración, resultado completo, marcas de tiempo, tiempo de cómputo y un snapshot de telemetría. `GET /api/telemetry` registra además una instantánea de gestión; se documenta este efecto de observación. Las fuentes `management` y `simulation` permanecen diferenciadas. Los contadores técnicos en memoria se reinician al reiniciar el proceso; los snapshots de simulación persisten.

`MAX_CONCURRENT_SIMULATIONS` (defecto 2) limita solicitudes de simulación admitidas simultáneamente **por proceso**, con semáforo y liberación incluso ante error. La cola interna tiene capacidad 0: saturación → 429 + `Retry-After: 2`. Comparar cuatro escenarios ocupa una plaza y los ejecuta secuencialmente. No es una medición de throughput, no demuestra paralelismo CPU y no representa capacidad hospitalaria. No aumentar los workers sin rediseñar este control compartido.

## Modelo y análisis

Ver [docs/MODELO_DES.md](docs/MODELO_DES.md) para eventos, distribuciones, unidades, Strategy, integrales y denominadores. Las franjas son 00–06, 06–12, 12–18 y 18–24, con 2/5/9/6 pacientes por hora sintéticos. La estrategia estacionaria se reserva como experimento de referencia.

- **M/M/c:** Erlang C para una cola aislada compatible con sus supuestos; si ρ ≥ 1 no se inventa una espera finita. El DES completo no se declara equivalente a M/M/c.
- **Little:** se muestran L, tasa de egreso observada, W de egresados, λW y residuo. El tiempo acumulado de pendientes explica exactamente el residuo de este sistema inicialmente vacío.

## Laboratorio reproducible

La página Laboratorio permite descargar `.ipynb`. El mismo contenido se versiona en `notebooks/` y se regenera con:

```powershell
node scripts/generate-notebook.mjs
```

Para ejecutarlo localmente, instalar en el entorno backend `pip install -r requirements-lab.txt`. Para verificar las 12 celdas sin Jupyter, desde `backend/` ejecutar:

```powershell
python ../scripts/verify_notebook.py
```

Para trabajar interactivamente, instalar `jupyter` y abrir el cuaderno con el entorno backend. El cuaderno importa `app`, por lo que necesita acceso al código backend: establecer el directorio del kernel en `backend/` o añadir esa ruta a `PYTHONPATH`. En Colab, clonar el repositorio, instalar sus dependencias y hacer `%cd <repositorio>/backend` antes de las celdas.

## Pruebas

```powershell
docker compose exec backend pytest -q
docker compose exec backend python -m compileall -q app
docker compose exec postgres psql -U simurgencias -d simurgencias -c 'SELECT version();'
cd frontend
npm ci
npm run build
npx playwright install chromium
npm test
```

Las pruebas Python de integración usan PostgreSQL real y transacciones con savepoints revertidas al terminar. No borran tablas ni datos de gestión. Las pruebas de navegador usan la aplicación real en `localhost:8080` y crean registros E2E sintéticos y corridas persistentes identificables. Para otra URL: `$env:E2E_BASE_URL='http://localhost:5173'`.

La evidencia efectivamente obtenida, junto con cualquier bloqueo del entorno, se registra en [docs/VERIFICACION.md](docs/VERIFICACION.md).

## Límites y preparación de Entrega 2

No hay abandono modelado (se reporta 0), validación clínica, calibración, warm-up, intervalos de confianza, autenticación, multitenencia, ni recomendaciones. Cada paciente de gestión tiene una atención en esta demo. Los registros de gestión describen etapas; no son un planificador físico con asignación automática de personal. Cada corrida empieza vacía y termina sin drenar a los pacientes pendientes. Las medias de pacientes atendidos/egresados pueden tener sesgo de selección.

Las estrategias inyectables, contratos de resultados y snapshots con fecha/fuente preparan futuras extensiones, sin implementarlas en esta entrega.

## Fuentes técnicas

- [SimPy: recursos y prioridad](https://simpy.readthedocs.io/en/4.1.1/topical_guides/resources.html)
- [FastAPI: ciclo de vida](https://fastapi.tiangolo.com/advanced/events/)
- [SQLAlchemy: transacciones de prueba](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)

Estas fuentes sustentan el uso de recursos y la infraestructura; los parámetros del caso son decisiones sintéticas del experimento.
