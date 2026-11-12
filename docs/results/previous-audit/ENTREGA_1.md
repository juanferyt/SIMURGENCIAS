# Entrega 1 · Trazabilidad de SIMURGENCIAS

## Revisión previa y alcance

Se inspeccionó `C:\Users\PC\Desktop\SIMURGENCIAS`, incluidos archivos ocultos, y se buscó estructura, manifiestos y `AGENTS.md`. La carpeta estaba vacía. **Tecnologías y funcionalidades preexistentes: ninguna.** No se eliminaron funcionalidades ni archivos de un proyecto anterior. Todos los archivos de esta entrega son nuevos respecto al estado recibido.

Arquitectura implementada: React + TypeScript → FastAPI → servicios de gestión / simulación / telemetría → PostgreSQL y motor SimPy → métricas, comparación y teoría. El motor se ejecuta en la capa de servicios; la base de datos conserva sus resultados. Se distingue gestión digitalizada, gemelo digital y análisis.

## Matriz de requisitos

Los números corresponden al texto de solicitud. Las pruebas y resultados realmente ejecutados se registran en [VERIFICACION.md](VERIFICACION.md).

| Requisito | Implementación | Archivo | Evidencia |
|---|---|---|---|
| 1. Urgencias con al menos tres etapas | Registro/triage, consulta, observación opcional y egreso; gestión con transiciones | `backend/app/simulation/engine.py`, `backend/app/main.py` | `test_priority_is_nonpreemptive_and_fifo_can_be_injected`, `test_management_and_persistence`; página Modelo |
| 2. Recursos finitos | Resource para triage/camas, PriorityResource para médicos | `backend/app/simulation/engine.py` | Pruebas de utilización entre 0 y 1 y orden de atención |
| 3. Prioridad | I–V, menor valor primero; no expropiativa, con alternativa FIFO | `backend/app/simulation/strategies.py` | Prueba de orden `[1,3,2]` frente a `[1,2,3]`; aviso académico visible |
| 4. Llegadas no estacionarias | NHPP por cuatro franjas parametrizadas, inversión exacta del riesgo | `backend/app/simulation/strategies.py` | Cruces de franja con tasa cero y conteos sobre 200 días sintéticos |
| 5. POO | Patient, Doctor, TriageStation, EmergencyDepartment, SimulationConfig, SimulationResult | `backend/app/simulation/domain.py`, `engine.py` | Entidades usadas directamente por el motor |
| 6. Strategy real | ABC de llegadas, prioridad y tiempos; inyección por constructor | `backend/app/simulation/strategies.py`, `engine.py` | Servicio fijo inyectado en prueba; políticas intercambiables |
| 7. DES funcional | Parámetros, semilla, eventos, colas, egresos, servicio y utilizaciones | `backend/app/simulation/engine.py`, `domain.py` | Pruebas numéricas, CLI y respuesta API con pacientes individuales |
| 8. Decisión médicos | Comparación 1–4, mismas demandas aleatorias | `backend/app/main.py`, `frontend/src/App.tsx` | Prueba de conservación de entradas y diferencia de espera/atendidos; gráfico comparativo |
| 9. API REST | 14 operaciones de dominio/sistema documentadas en OpenAPI | `backend/app/main.py` | Pruebas de gestión, API y navegador; `/docs` |
| 10. PostgreSQL | 5 tablas de aplicación, claves/restricciones, Alembic y seed idempotente | `backend/app/database.py`, `backend/migrations/versions/001_initial.py`, `backend/app/seed.py` | Pruebas de integración sobre PostgreSQL, historial recuperado |
| 11. Telemetría | Timestamp, fuente, pacientes activos/cola, médicos, duración, métricas, contador de solicitudes | `backend/app/services.py`, `backend/app/main.py`, `database.py` | `/api/telemetry`, snapshots persistidos por corrida |
| 12. Capacidad técnica | Semáforo configurable por proceso, cola 0, rechazo 429 + Retry-After | `backend/app/services.py` | Prueba multihilo de admisión, rechazo y liberación tras error |
| 13. Frontend profesional | Navegación de siete secciones, diseño sobrio adaptable | `frontend/src/App.tsx`, `styles.css` | Pruebas de navegación y pantalla móvil; capturas de verificación |
| 14. Modelo visual | Flujo, entidades, recursos, eventos, estados, entradas y salidas | `frontend/src/App.tsx`, `docs/MODELO_DES.md` | Página Modelo, diagrama visual y Mermaid documental |
| 15. Configuración | Médicos, triage, camas, duración, semilla, perfil, servicios y prioridad | `frontend/src/App.tsx`, `api.ts` | Flujo E2E de ejecución con API real |
| 16. Resultados | Tarjetas, serie de cola, balance, escenarios e historial | `frontend/src/App.tsx` | Recharts con datos reales de SimPy; recuperación y descarga JSON |
| 17. Teoría de colas | Erlang C estable, λ/μ/c/ρ/W/L; referencia y diferencias en perfil estacionario | `backend/app/simulation/theory.py`, `engine.py`, `frontend/src/App.tsx` | Caso conocido M/M/1, detección ρ≥1, calculadora E2E |
| 18. Ley de Little | L temporal, λ de egresos, W de egresados, λW, residuo y censura | `backend/app/simulation/engine.py` | Igualdad independiente de residuo y aporte pendiente; página Teoría |
| 19. Laboratorio | 12 bloques explicados, descarga y cuaderno `.ipynb` versionado | `frontend/src/laboratory.ts`, `scripts/generate-notebook.mjs`, `notebooks/SIMURGENCIAS_Entrega_1.ipynb` | Prueba E2E de descarga y `scripts/verify_notebook.py` |
| 20. Documentación | Objetivo, alcance, arquitectura, comandos, endpoints y límites | `README.md`, `docs/MODELO_DES.md` | Comandos reproducibles y explicación de denominadores |
| 21. Trazabilidad | Matriz requisito → implementación → archivo → evidencia | `docs/ENTREGA_1.md` | Este documento |
| 22. Docker | Frontend Nginx, backend no-root y PostgreSQL con healthchecks | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` | Build y arranque de los tres servicios |
| 23. Calidad | pytest, TypeScript/build, Playwright, imports, DB y simulación | `backend/tests/`, `frontend/tests/`, `docs/VERIFICACION.md` | Resultados efectivos y fallos corregidos detallados en verificación |
| 24. Integración y resumen | Inspección inicial; ejecución real; inventario; límites explícitos | `README.md`, `docs/VERIFICACION.md`, este documento | Informe final y evidencias reproducibles |

## Inventario de archivos creados

| Área | Archivos |
|---|---|
| Raíz | `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md` |
| Backend | `requirements.txt`, `requirements-lab.txt`, `Dockerfile`, `.dockerignore`, `pytest.ini`, `alembic.ini` |
| Aplicación | `backend/app/__init__.py`, `database.py`, `main.py`, `services.py`, `seed.py`, `cli.py` |
| Simulación | `backend/app/simulation/__init__.py`, `domain.py`, `strategies.py`, `engine.py`, `theory.py` |
| Migraciones | `backend/migrations/env.py`, `backend/migrations/versions/001_initial.py` |
| Pruebas Python | `backend/tests/test_simulation.py`, `backend/tests/test_api.py` |
| Frontend | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `Dockerfile`, `nginx.conf`, `.dockerignore`, `playwright.config.ts` |
| Interfaz | `frontend/public/favicon.svg`, `frontend/src/main.tsx`, `App.tsx`, `api.ts`, `styles.css`, `laboratory.ts` |
| Pruebas navegador | `frontend/tests/app.spec.ts`, `frontend/scripts/capture.mjs` |
| Laboratorio y evidencia | `scripts/generate-notebook.mjs`, `scripts/verify_notebook.py`, `scripts/verify-live.mjs`, `notebooks/SIMURGENCIAS_Entrega_1.ipynb` |
| Documentación | `docs/ENTREGA_1.md`, `docs/MODELO_DES.md`, `docs/VERIFICACION.md`, evidencias en `docs/evidence/` |

**Archivos anteriores modificados:** ninguno; no existían. Las correcciones realizadas durante la implementación pertenecen a los archivos nuevos anteriores. `node_modules`, `dist`, cachés y salidas temporales se excluyen con `.gitignore`.

## Preparación para Entrega 2

- Abstracciones de Strategy que permiten incorporar políticas sin reescribir el proceso.
- Resultados por corrida con configuración, semilla, pacientes y métricas; exportación JSON.
- Telemetría con fecha y fuente, counters de admisión y tiempo real de cómputo.
- API separada del motor y migraciones versionadas.
- Pruebas de reproducibilidad, conservación y límites para detectar regresiones.

No se incorporó ninguna funcionalidad de Locust, PyMC, KS, Machine Learning, Mesa ni agentes de decisión.

## Interpretación del cumplimiento

El registro se incluye en la estación de triage. El abandono no se modela y se declara cero; sí se simula egreso, tal como admite el requisito. La teoría M/M/c se calcula para el modelo compatible aislado y se compara como referencia nominal cuando el perfil es estacionario; no se afirma que las llegadas variables o el sistema multietapa satisfagan sus supuestos. Estas decisiones evitan presentar como validación clínica un experimento académico.
