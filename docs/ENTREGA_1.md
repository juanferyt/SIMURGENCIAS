# Entrega 1 — trazabilidad final de SIMURGENCIAS

Auditoría ejecutada el 1 de octubre de 2026. Alcance: software y modelo académico con datos sintéticos; no herramienta clínica. La interfaz ya rediseñada se conserva sin cambios. La evidencia anterior está archivada en `results/previous-audit/`.

## Matriz C1–C7

| Criterio | Implementación | Archivo | Prueba | Evidencia | Estado |
|---|---|---|---|---|---|
| C1 Recursos finitos | Resource triage/camas; PriorityResource médicos | backend/app/simulation/engine.py | test_conservation_utilization_and_finite_horizon_little; test_observation_consumes_beds_and_precedes_discharge | results/pytest.txt; repeticiones_120.csv | CUMPLE |
| C2 Software real | React/Nginx → FastAPI → PostgreSQL; Alembic y persistencia | docker-compose.yml; backend/app/main.py; database.py; migrations/versions/001_initial.py | test_management_and_persistence; audit_api.py; audit_restart.py | api_audit.json; restart_validation.json; docker-final.txt; playwright.txt | CUMPLE |
| C3 Etapas/prioridad | Triage, cola, consulta, observación opcional, egreso; prioridad no expropiativa | engine.py; strategies.py | test_priority_arrives_after_service_started_and_cannot_interrupt | Orden 1→3→2; intervalos (0.5,10.5), (10.5,11.5), (11.5,12.5); pytest.txt | CUMPLE |
| C4 Variable controlable | Médicos 1–4, demás parámetros constantes y demandas emparejadas | domain.py; scripts/audit_experiments.py | test_reproducibility_and_capacity_experiment; assert de demandas de 120 corridas | escenarios_1_4_medicos.csv; reproducibilidad.json | CUMPLE |
| C5 Llegadas no estacionarias | Inversión del riesgo integrado con tasas 2/5/9/6 por hora | strategies.py | test_arrivals_cross_boundaries_and_zero_rate_periods; test_nonstationary_profile_has_distinct_expected_counts | llegadas_por_franja.csv; 07_llegadas_por_franja.png | CUMPLE |
| C6 Límite técnico medible | Dos plazas por proceso; semáforo; cola interna 0; 429 y Retry-After | services.py; main.py; scripts/audit_api.py | HTTP A/B reales ocupadas y C rechazada; error SQL real y reutilización | api_audit.json: concurrency y error_release | CUMPLE |
| C7 Preparación para agentes | Interfaces Strategy inyectables, configuración, estados y telemetría separadas | strategies.py; domain.py; engine.py; services.py | test_strategy_injection_and_no_departures; ejecución de política FIFO | pytest.txt; API con timestamp/fuente/ID; código inspeccionado | CUMPLE |

C7 evalúa preparación estructural, no agentes implementados. No se añadieron agentes, Mesa, aprendizaje automático, Locust, KS ni PyMC. C6 es exclusivamente el **límite técnico de admisión de simulaciones por proceso**.

## Alcance matemático

Motor principal sin cambios: 1440 min; triage=1, camas=4; servicios exponenciales 5/18/60 min; observación 0.2; prioridades I–V; llegadas por franja. 30 réplicas por capacidad, semillas 42–71. Mismo motor importado directamente, sin 120 escrituras en el historial ni duplicación de lógica.

Referencia M/M/c aislada preexistente: FIFO, una cola, sin triage ni observación; c=3/4; 30 réplicas cada una; 14400 min de warm-up y 144000 min observados. No sustituye el modelo principal.

Se publican p50/p95/p99, probabilidad de esperar, medias, dispersión e IC95% t. Los percentiles de pacientes no son percentiles de medias entre réplicas. Resultados completos en [RESULTADOS_ENTREGA_1.md](RESULTADOS_ENTREGA_1.md).

## Integridad y términos

Generados = llegadas; atendidos = consultas terminadas; egresados = salidas; pendientes = presentes al corte. No son sinónimos. Wq usa quienes iniciaron consulta, W usa egresados y Lq/ocupaciones integran todos los eventos hasta el corte. El residuo de Little incluye explícitamente tiempo acumulado de pendientes.

El contrato exporta marcas de transición por paciente, no la agenda interna de eventos SimPy. Reproducibilidad verifica esas marcas, todos los pacientes, métricas y timeline. SHA256 permite verificar que backend/app y frontend/src no fueron modificados en esta auditoría.

## Entregables y pruebas

[Verificación y comandos](VERIFICACION.md), [modelo y unidades](MODELO_DES.md), [datos/figuras](results/), [inventario de cambios](results/final-audit-changes.json). Git no está disponible: git status y git log -1 --oneline reportan que el directorio no es repositorio; no se ejecutó reset ni clean.
