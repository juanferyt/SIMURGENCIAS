# Verificación ejecutada · Entrega 1

Fecha local: **29 de septiembre de 2026**, America/Bogota. La evidencia JSON usa UTC y corresponde al 30 de septiembre a las 00:21 UTC.

## Estado final

Se construyeron y arrancaron los tres servicios de Docker Compose. El backend se conectó a **PostgreSQL 16.15 real**, aplicó la migración `001`, cargó la demo y ejecutó SimPy. No se sustituyó PostgreSQL por SQLite ni se simularon respuestas de API en las pruebas de navegador.

| Verificación | Comando / mecanismo ejecutado | Resultado |
|---|---|---|
| Configuración Docker | `docker compose config --quiet` | Correcta |
| Build contenedores | `docker compose up --build -d` | Frontend y backend construidos; los tres servicios arrancados |
| TypeScript + producción | `npm run build`, también dentro del Dockerfile | Correcto; chunks finales de aproximadamente 226 y 406 kB, sin aviso de tamaño |
| Dependencias frontend | Auditoría de npm al instalar las versiones definitivas | 0 vulnerabilidades reportadas |
| Tests Python | `docker compose exec -T backend pytest -q` | **21 passed**, 1.23 s |
| Imports/compilación Python | `docker compose exec -T backend python -m compileall -q app` | Sin errores |
| Migración y CLI | `alembic current`, `python -m app.cli --doctors 2 --seed 42` dentro del backend | Revisión `001 (head)`; métricas iguales a la API |
| Conexión PostgreSQL | `SELECT version()` y `/api/health` | PostgreSQL 16.15; `{status: ok, database: postgresql}` |
| Integración API | Pruebas con TestClient sobre PostgreSQL, savepoints y rollback | Creación, transición, duplicados, validación, historial y recursos correctos |
| Navegador real | `npm test` / Chromium | **3 passed**, 9.3 s; navegación, gestión y móvil |
| Simulación exterior a tests | `node scripts/verify-live.mjs` | Cuatro escenarios, repetición exacta, recuperación persistida y referencia estacionaria |
| Cuaderno | Contenedor temporal con matplotlib 3.10.3 y nbformat 5.10.4; `scripts/verify_notebook.py` | Esquema válido y **12 celdas ejecutadas**; asserts de semilla y Little correctos |
| Revisión visual | `node frontend/scripts/capture.mjs` desde raíz, o `node scripts/capture.mjs` desde frontend | Capturas de inicio, configuración, resultados y móvil |

El backend emite una advertencia de deprecación de Starlette/AnyIO durante TestClient (`BlockingPortal`); no es un error y no se oculta. npm informa que Recharts 2 ya no recibe nuevas funciones; la versión está fijada y el build, la auditoría y los gráficos se verificaron. Playwright puede mostrar una advertencia de variables de color heredadas del entorno; no afecta la ejecución.

## Evidencia numérica de SimPy

Configuración: 1440 min, semilla 42, triage 1, camas 4, tasas por franja 2/5/9/6 pacientes/h, servicios 5/18/60 min, observación 0.2 y prioridad I–V. **132 llegadas idénticas en los cuatro escenarios.**

| Médicos | Consultas terminadas | Egresados | Activos al corte | Espera media consulta (min) | Utilización médica | Cola media |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 79 | 79 | 53 | 61.8793 | 92.8365 % | 19.7007 |
| 2 | 122 | 121 | 11 | 19.0404 | 75.3046 % | 2.8091 |
| 3 | 130 | 129 | 3 | 2.0226 | 53.4409 % | 0.1854 |
| 4 | 130 | 129 | 3 | 0.5980 | 40.0807 % | 0.0548 |

La espera incluye quienes iniciaron consulta; la permanencia incluye solo egresados. No se drenan los pendientes. Estos valores son una sola réplica sintética y **no recomiendan personal para un hospital**.

La repetición de 2 médicos reprodujo exactamente las métricas y los registros de pacientes. Cambiar capacidad preservó llegadas, prioridades y requerimientos de servicio, según pruebas. Cambiar semilla produjo pacientes distintos.

Little, escenario de 2 médicos:

- L observado: 5.7079517938622555.
- λ de egresos: 0.08402777777777778 pacientes/min.
- W de egresados: 51.68948208717248 min.
- λW: 4.343352314269355.
- Residuo: 1.3645994795929006.
- Contribución de pacientes pendientes: 1.3645994795929013.

La diferencia entre los dos últimos valores es redondeo de coma flotante. No se fuerza una igualdad de equilibrio en un horizonte no estacionario.

Referencia estacionaria aislada, λ=5/h, media=18 min y c=2: ρ=0.75, Wq=23.142857 min, Lq=1.928571. El DES FIFO correspondiente obtuvo Wq=14.942122 min; la diferencia se muestra con las advertencias de triage previo y horizonte finito, sin declarar equivalencia del sistema completo.

## Pruebas cubiertas

Python: reproducibilidad, capacidad 1–4, conservación, reconstrucción independiente del área, utilización finita, Little censurado, franjas con tasa cero, conteos no estacionarios, prioridad no expropiativa/FIFO, servicio inyectado, ausencia de egresos, M/M/1 conocido, inestabilidad, validación de entradas, CRUD de gestión, transiciones, aislamiento gestión/simulación, persistencia de resultados, telemetría y saturación/liberación del semáforo.

Navegador: carga de la API, navegación de siete secciones, ejecución y comparación de escenarios, gráfico, exportación JSON, calculadora, Little, 12 celdas, descarga ipynb, alta de un paciente E2E y transición a triage, navegación móvil a 390 px sin desbordamiento horizontal y sin excepciones JavaScript en el flujo principal.

Las pruebas de navegador dejan un paciente `E2E-*` y corridas sintéticas persistentes para inspección. Las pruebas de integración Python revierten sus transacciones sin borrar la base. No se ejecutaron pruebas de carga ni inferencia estadística de entregas posteriores.

## Problemas encontrados y soluciones

1. **Carpeta inicial vacía:** se creó una arquitectura completa; no había funciones previas que migrar.
2. **Python nativo ausente:** se usó Python 3.12 del contenedor. No se modificó la instalación de Python del usuario.
3. **Docker Desktop sin motor disponible:** se relanzaron los procesos bloqueados iniciados para la tarea; el motor Linux quedó disponible.
4. **Publicación de puertos:** Windows rechazó 5432; al iniciar Docker, 55432 resultó ocupado por otro proyecto. Se eligió **55440** y se parametrizó `POSTGRES_PORT`, sin detener ni modificar los contenedores ajenos.
5. **Vite 6.4.1 con avisos de seguridad:** se actualizó a 6.4.3; la auditoría quedó en cero vulnerabilidades reportadas.
6. **Build bloqueado por permisos de subprocesos:** se ejecutó con los permisos autorizados y se verificó también dentro de Docker.
7. **Bundle inicial mayor de 500 kB:** se separó el módulo de gráficos; se eliminó además un chunk vacío y se reconstruyó correctamente.

No quedan requisitos funcionales de Entrega 1 bloqueados por el entorno. Las limitaciones de modelo (sin abandono, sin calentamiento, una réplica y datos sintéticos) están declaradas en el README y la interfaz. La ejecución manual nativa del backend requiere instalar Python; la vía Docker solicitada está comprobada.

## Archivos de evidencia

- [Verificación HTTP y métricas completas](evidence/live-verification.json)
- [Inicio](evidence/inicio.png)
- [Configuración](evidence/simulacion.png)
- [Resultados](evidence/resultados.png)
- [Móvil](evidence/movil.png)

Las capturas corresponden a corridas ejecutadas y datos de demostración, no a cifras de un hospital.
