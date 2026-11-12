# Verificación final — Entrega 1

Fecha: 1 de octubre de 2026. Esta verificación reemplaza el resumen antiguo; el original se conserva en `results/previous-audit/VERIFICACION.md`.

| Área | Comprobación ejecutada | Resultado |
|---|---|---|
| Docker | compose down (sin -v), up --build -d y ps | Tres servicios activos; PostgreSQL y backend healthy; volumen conservado |
| PostgreSQL | SELECT version(); tablas; seed dos veces; migración | PostgreSQL 16.15; seis tablas; revisión 001 (head); seed idempotente |
| API | 37 solicitudes secuenciales reales, más C6 | 200/201/404/409/422 y 429 verificados |
| Backend | pytest -q | 29 aprobadas, 0 fallidas, 1 warning de deprecación Starlette/AnyIO |
| Python | python -m compileall -q app | Salida 0 |
| Frontend | npm run build | TypeScript y Vite correctos |
| Navegador | npm test contra localhost:8080 | 6 aprobadas; once páginas y cinco resoluciones |
| Notebook | verify_notebook.py con nbformat y motor real | 12 celdas ejecutadas; reproducibilidad y Little correctos |
| Modelo principal | audit_experiments.py | 120 corridas, semillas 42–71, 30 por capacidad |
| Referencia FIFO | run_mmc_reference mediante script | 60 corridas, c=3/4, warm-up explícito |
| Persistencia | audit_restart.py antes/después de reiniciar backend | Corrida idéntica y conteos de gestión/corridas intactos; contadores técnicos reiniciados |
| C6 | Motor, HTTP y PostgreSQL reales | A/B 201, C 429 con 2 activas; Retry-After=2; liberación normal y error SQLSTATE 25006 |

La suite conserva sus pruebas unitarias aisladas anteriores. La evidencia nueva de API, C6, estadística, PostgreSQL y navegador no utiliza datos ni respuestas mock. El test unitario anterior de C6 sustituye el trabajo por una barrera; se documenta como cobertura complementaria, no como evidencia única del sistema real.

La API verifica /api/health, patients GET/POST, attentions GET/POST/PATCH, resources GET/PATCH, telemetry GET, simulations/run POST, simulations/compare POST, simulations GET y GET por ID, theory/mmc POST. Swagger y frontend responden 200. Durante el probe se mantiene brevemente un bloqueo de escritura sobre simulation_runs, liberado con rollback en finally.

## Evidencia

- `results/final_checks.json`: comandos y códigos de salida finales.
- `results/pytest.txt`, `results/playwright.txt`, `results/notebook.txt`, `results/docker-final.txt`.
- `results/api_audit.json`: versión PostgreSQL, tablas, seed, peticiones y C6.
- `results/restart_validation.json`: persistencia frente a reinicio.
- `results/reproducibilidad.json`: igualdad seed42 y cambios seed100.
- `results/experiment_manifest.json`: configuración, versiones, semillas y hashes de fuentes.
- `results/repeticiones_120.csv`, `hospital_runs.json.gz`, `estadisticos_por_escenario.json`.
- `results/intervalos_confianza_95.csv`, `cambios_capacidad.csv`, `little_validation.csv`.
- Ocho figuras numeradas 01–08, cada una identificada como resultado sintético del modelo.

## Hallazgos

No se detectaron errores de cálculo que exigieran alterar las fórmulas. Se corrigió documentación desactualizada (RNG, siete frente a once páginas y conteos de tests) y se añadieron IC95%, comparación cuantificada y archivos exigidos. No se retocó el frontend, el backend funcional ni la arquitectura.

La evidencia por triage sí puede obtenerse en scripts a partir de triage_end y consultation_start reales; el frontend no tiene agregados y permanece igual. Se reporta censura de quienes no iniciaron consulta.

Git no puede verificarse: no existe .git. Se guardaron hashes antes/después y copias de resultados/documentos previos. Hay un warning de deprecación Starlette/AnyIO y avisos NO_COLOR/FORCE_COLOR en Playwright; no se ocultaron. No se actualizan dependencias fuera del alcance solo por estos avisos.

## Reproducción (PowerShell, raíz del proyecto)

```powershell
git status
git log -1 --oneline
docker compose down
docker compose up --build -d
docker compose ps
docker compose exec -T postgres psql -U simurgencias -d simurgencias -c 'SELECT version();'
docker compose exec -T backend alembic current
docker compose exec -T backend pytest -q
docker compose exec -T backend python -m compileall -q app
docker compose -f docker-compose.yml -f docker-compose.audit.yml build audit
docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_api.py
docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_experiments.py
docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/verify_notebook.py
docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_restart.py before
docker compose restart backend
# Esperar a que backend esté healthy antes de la lectura posterior.
docker compose ps
docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_restart.py after
npm --prefix frontend run build
npm --prefix frontend test
docker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_report.py
```

Ejecutar el probe de API y las pruebas de navegador de forma secuencial para no alterar los conteos medidos. El script experimental no escribe PostgreSQL. Las pruebas API/E2E sí crean corridas y pacientes sintéticos identificados; no se elimina ningún volumen. El generador documental exige `final_checks.json` con verificaciones aprobadas y lee exclusivamente resultados guardados.

Ver interpretación, tablas completas, IC y limitaciones en [RESULTADOS_ENTREGA_1.md](RESULTADOS_ENTREGA_1.md).
