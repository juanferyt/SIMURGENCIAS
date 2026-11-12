# Entrega del rediseño visual de SIMURGENCIAS

Fecha: 1 de octubre de 2026.

## Sistema visual

Interfaz operativa de ingeniería con fondo gris claro, paneles blancos, navegación azul hospitalario y una familia consistente de azules para gráficas. Verde reservado para estados positivos, ámbar para advertencias y rojo para error/inestabilidad. Triage I–V conserva su semántica mediante etiquetas discretas.

Tipografía local Segoe UI/Arial, sin descargar fuentes: títulos de 30 px, secciones de 19 px, texto de 14 px, etiquetas de 11–13 px y KPI de 27 px. Bordes finos, radios de 6–9 px y ausencia de sombras decorativas. CSS propio; se mantienen React, TypeScript, Recharts y Lucide sin añadir dependencias ni Tailwind.

## Archivos de aplicación

- `frontend/src/App.tsx`: navegación, shell, once vistas, health check, formularios organizados, pestañas, teclado y composición de resultados.
- `frontend/src/styles.css`: sustitución del sistema visual y reglas responsive.
- `frontend/src/api.ts`: tipos TypeScript para campos que el backend ya devuelve (`patients`, P0, Pq, λ, μ y c). Sin cambios en fetch, endpoints ni payloads.
- `frontend/src/components.tsx` (nuevo): componentes reutilizables.
- `frontend/tests/app.spec.ts`: conserva los tres flujos existentes y adapta sus selectores a las nuevas etiquetas y tres gráficas.
- `frontend/tests/redesign.spec.ts` (nuevo): fidelidad de datos, persistencia, reproducibilidad, 55 combinaciones página/resolución, teoría inestable y controles por teclado.

También se regeneran `frontend/dist/` y el caché de compilación TypeScript. El inventario previo está en `INVENTARIO.md`. No existe un repositorio Git en esta carpeta; no se creó commit.

## Componentes

Nuevos: `StatusBadge`, `EmptyState`, `LoadingState`, `ChartCard`, `QueueChart`, `ResourceState`, `DemandProfile`, `HistoryTable`, `Comparison`, `TriageBadge` y `PatientResults`. Se reutilizan `Panel`, `Metric`, `Tag` y `Flow`.

Las gráficas comparten colores, ejes, grilla y tooltips. Las tablas desplazan su contenido horizontalmente. Los pacientes de simulación tienen filtro por triage y paginación de 25 registros, separados de los pacientes de gestión.

## Páginas

1. Inicio: última corrida persistida, resumen compacto, acciones rápidas, cola, utilización de recursos y últimas simulaciones. Se conserva la gestión de pacientes debajo.
2. Simulación: grupos de recursos, tiempo, demanda/prioridad y servicio; resumen lateral y barras del perfil de llegadas.
3. Resultados: cinco KPI y pestañas Resumen, Triage, Recursos, Pacientes y Análisis; exportación JSON preservada.
4. Historial: tabla con configuración, métricas y apertura de corrida guardada.
5. Comparar escenarios: configuración común, tabla, Wq/utilización/p95 y lectura basada en las respuestas reales.
6. Teoría de colas: λ, μ, c, ρ; P0, Pq, Lq, Wq, W, L; estado estable/inestable; contraste DES y Little existentes.
7. Telemetría: health de API/BD, datos técnicos y fecha de consulta. Capacidad explícitamente del motor, no del hospital.
8. Modelo DES: seis etapas con observación opcional, recursos del escenario y elementos del modelo.
9. Laboratorio: doce celdas originales, código oscuro, copia, explicación y resultado identificado como disponible al ejecutar Python en el notebook.
10. Metodología: procedimiento experimental y límites de interpretación.
11. Documentación: navegación interna, arquitectura, API, arranque, supuestos y autoría académica.

## Responsive y accesibilidad

Probadas 1920×1080, 1366×768, 1024×768, 768×1024 y 390×844: once páginas en cada tamaño, sin desbordamiento horizontal de documento ni errores de JavaScript.

Sidebar de 250 px colapsable; drawer móvil con fondo, cierre por Escape, foco contenido y restauración del foco. Navegación oculta inerte al teclado. Pestañas con flechas, Inicio/Fin y panel identificado. Enlace para saltar al contenido, focus visible, labels, nombres accesibles, estados con texto y `prefers-reduced-motion`. La revisión no equivale a una certificación formal WCAG.

## Validación real

- `npm run build`: correcto; TypeScript y Vite, 2251 módulos. También se construye la imagen local de producción.
- `npm test`: seis pruebas aprobadas contra FastAPI y PostgreSQL reales. Los tres tests originales siguen pasando.
- `/api/health`: `status: ok`, `database: postgresql`.
- Configurar → ejecutar → guardar → recuperar → comparar: verificado.
- JSON recuperado por ID idéntico a la respuesta completa de ejecución.
- Repetición con la misma configuración: igualdad exacta de métricas y pacientes.
- Valores visibles cotejados contra la API, sin datos mock.
- Exportación JSON y notebook, gestión y transición de paciente sintético verificadas.

Evidencia numérica: `real-validation.json`. Ejemplo de corrida real con 2 médicos, semilla 42 y 24 h: 144 pacientes generados, Wq = 21.612886320761618 min, p95 = 97.09306297097127 min, utilización = 0.8289230434093117. La interfaz presenta esos valores con formato es-CO; no reemplaza ni recalcula los indicadores.

Las pruebas autorizadas crean corridas y pacientes de gestión sintéticos de prueba en la base local; no alteran los archivos de resultados experimentales anteriores.

## Problemas y límites

Docker estaba inicialmente detenido y se inició el entorno existente. Vite/esbuild necesitó permiso para crear procesos fuera del sandbox; la compilación posterior terminó correctamente. Playwright emite una advertencia inocua por NO_COLOR/FORCE_COLOR.

El backend no entrega histogramas ni promedios de espera desglosados por triage. Para cumplir la restricción de no recalcular métricas en frontend, no se inventaron estas gráficas: se muestra el detalle original filtrable y se explica la ausencia de agregados. Tampoco se inventa un umbral de saturación: la comparación identifica menor espera y mayor utilización; la inestabilidad M/M/c se toma del backend.

El notebook no ejecuta Python en el navegador; sus resultados se obtienen al descargarlo y ejecutarlo, como antes. El health disponible verifica API y BD; el simulador se identifica por disponibilidad de telemetría, no con una prueba de salud inexistente.

Se preservaron backend, FastAPI, PostgreSQL, migraciones, SimPy, fórmulas M/M/c y Ley de Little, semillas, parámetros predeterminados, endpoints, JSON, celdas y datos experimentales. Solo se añadieron tipos de lectura para campos existentes.

## Presentación

Durante la sustentación, SIMURGENCIAS se presenta como un centro de análisis: navegación organizada, cifras legibles, configuración trazable y comparación de capacidad en tablas y tres gráficas coherentes. El proyecto académico y la naturaleza sintética de los datos quedan visibles de forma discreta.

Capturas: `Inicio-1366.png`, `Simulación-1366.png`, `Resultados-1366.png`, `comparacion-real-1366.png` y variantes móviles de 390 px.

Validación de producción: las seis pruebas también pasaron contra `http://localhost:8080` (Nginx, frontend compilado y API real). Registro: `tests-production.txt`. El contenedor frontend actualizado queda disponible en esa dirección; backend y PostgreSQL conservan sus implementaciones existentes.
