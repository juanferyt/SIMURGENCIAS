# Mejora pedagógica y explicativa de SIMURGENCIAS

Fecha: 1 de octubre de 2026. Alcance: interfaz de la Entrega 1 existente. Las guías se abren a demanda; configurar, ejecutar, consultar y comparar conservan su funcionamiento.

## A y C. Páginas modificadas y explicaciones

| Página | Contenido añadido |
|---|---|
| Inicio | Qué estudia la plataforma, variable de decisión de 1–4 médicos, cinco indicadores con explicación breve y flujo visual de siete pasos. |
| Simulación | Ayuda asociada a cada parámetro, unidades y efectos esperados; duración y corte; semilla; franjas de llegada; triage; servicios exponenciales; prioridad no expropiativa con pacientes A, B y C. |
| Resultados | Poblaciones y unidades de Wq, p95, Lq, utilización y throughput; diferencias entre generados, atendidos, egresados y pendientes; límites del promedio y de los percentiles. |
| Historial | Qué es una corrida, qué se guarda, cómo abrirla y cómo conservar condiciones para comparar. Tooltips en encabezados. |
| Comparar escenarios | Compromiso entre espera, cola, utilización y egresos; referencia auditada separada de los resultados interactivos; ausencia de función de costos. |
| Teoría | M/M/c desde cero, λ, μ, c, ρ, estabilidad, P0/Pq/Lq/Wq/W/L con unidades; diferencias frente a SimPy; verificación simplificada y Little con horizonte finito. Las ayudas teóricas no atribuyen triage a M/M/c. |
| Modelo | Entidad paciente, recursos, eventos, variables de estado, flujo y ejemplo de prioridad sin interrupción. |
| Metodología | Diez pasos desde delimitar el problema hasta documentar limitaciones; diferencia entre verificación del software y validación externa. |
| Telemetría | Estado técnico frente a métricas simuladas; ejecuciones activas, corridas recientes, gestión, timestamps y persistencia. |
| Laboratorio | Qué se aprende, doce partes descritas y ejecución ordenada del notebook; copiar/descargar no ejecuta Python en el navegador. |
| Documentación | Acceso por preguntas: entender proyecto, modelo, resultados, pruebas o código; rutas concretas y enlace al Laboratorio. |

Aviso académico discreto y común: datos sintéticos, modelo académico, sin representación de un hospital real ni recomendaciones clínicas.

## B. Componentes reutilizables

En `frontend/src/education.tsx`:

- `InfoPanel`: title, description, howItWorks, example, interpretation, warning; campos opcionales, resumen visible y despliegue controlado.
- `MetricHelp`: tooltip por ratón, foco o clic; descripción teórica cuando corresponde.
- `ExampleCard`, `InterpretationCard`, `FormulaCard`: presentación consistente de ejemplos, lecturas y fórmulas.
- `MetricLabel`: encabezados con ayuda sin repetir la etiqueta.
- `MetricGuide`, `PriorityExample`, `PageGuide`: contenido compartido entre páginas.
- `glossary` y `fieldHelp`: definiciones y explicaciones de parámetros centralizadas.

## D. Ejemplos numéricos y trazabilidad

| Ejemplo | Naturaleza y fuente |
|---|---|
| 1.440 min = 24 h; 1 médico atiende una consulta simultánea, 3 hasta tres | Explicación del parámetro, no resultado experimental. |
| Seed 42: 144 generados, 130 atendidos, 130 egresados, 14 pendientes | Auditoría, 2 médicos y configuración documentada; comprobado de nuevo con API real. |
| Seed 100: 143 generados, 119 atendidos, 117 egresados, 26 pendientes | Misma configuración; comprobado de nuevo con API real. |
| Tasas 2/5/9/6 pacientes/h en cuatro franjas | Configuración sintética inicial del proyecto; no conteos garantizados. |
| Wq 21,61 min y p95 ≈ 97 min | Corrida auditada de 2 médicos, seed 42. |
| Lq 6,46; utilización 72,25 %; throughput 4,90 egresos/h | Medias de 30 réplicas de 2 médicos, no valores atribuidos a una sola corrida. |
| Tabla 1–4 médicos: Wq 88,33/43,05/10,61/1,75; utilización 87,11/72,25/54,05/40,91 %; egresos/h 3,00/4,90/5,49/5,56 | Referencia auditada de 30 réplicas por escenario, semillas 42–71, horizonte 24 h. Incluye Lq. |
| λ = 9/h, media de servicio = 18 min, μ ≈ 3,33/h; ρ = 2,70/1,35/0,90/0,675 | Ejemplo de estabilidad con los parámetros del proyecto. |
| Wq M/M/3 = 49,02 min frente a SimPy simplificado ≈ 50,73 min, diferencia ≈ 3,48 % | Verificación auditada compatible; no corresponde al modelo completo. |
| Little: 5 pacientes/h × 0,5 h ≈ 2,5 pacientes | Ejemplo sencillo en equilibrio, expresamente pedagógico. |

Fuente experimental: [RESULTADOS_ENTREGA_1.md](RESULTADOS_ENTREGA_1.md), apartados B, C–D y F–H. No se generaron nuevas medias experimentales ni se sobrescribieron los archivos de esa auditoría.

## E. Tooltips

Wq, W, Lq, L, p95, utilización, throughput, λ, μ, ρ, P0, Pq, DES, seed, horizonte, pendientes, prioridad, M/M/c y Little. Disponibles en guías, indicadores, tablas de historial/comparación y salida teórica según corresponda. Las ayudas de Wq/W/Lq/L distinguen M/M/c del modelo completo.

## F. Accesibilidad y responsive

- Despliegues con botones nativos, `aria-expanded`, `aria-controls` y contenido oculto fuera del recorrido de teclado.
- Inputs y selects con nombre accesible y explicación conectada mediante `aria-describedby`.
- Tooltips con `role="tooltip"`, asociación por identificador, activación con foco/clic/hover y cierre mediante Escape sin perder foco.
- Tab, Enter y Espacio comprobados; navegación y cierre del menú móvil conservados.
- Posicionamiento de tooltips limitado al ancho de pantalla; tablas anchas con desplazamiento local y contenedor enfocable.
- Estilos de foco y reglas de movimiento reducido existentes conservados. Las nuevas guías no añaden animaciones.
- Once páginas, guías cerradas y abiertas, en 1920×1080, 1366×768, 1024×768, 768×1024 y 390×844, sin desbordamiento horizontal del documento.

## G–I. Pruebas y compilación

Siete pruebas nuevas en `frontend/tests/education.spec.ts`: cinco resoluciones para las once guías; parámetros, teclado y reproducibilidad real; ejemplos, percentiles, tooltip teórico y estabilidad. Se conservan las seis pruebas anteriores.

Cambios en pruebas existentes: selector exacto para el título principal en `app.spec.ts`; salida de evidencias de `redesign.spec.ts` redirigida a `docs/pedagogy/regression` para conservar las capturas y resultados anteriores.

- `npm run build`: compilación TypeScript y Vite correcta, salida 0. [Registro](pedagogy/build.txt).
- `npm test`: **13/13 pruebas aprobadas, 37,0 segundos, salida 0**. [Registro completo](pedagogy/tests.txt).
- Docker: frontend construido y servido en `http://localhost:8080`, conectado al backend y PostgreSQL reales. No se sustituyeron respuestas de API en las pruebas.
- Corridas persistidas y repetidas comprobadas; métricas y pacientes comparados por la suite existente.
- Integridad: los nueve hashes del manifiesto experimental (ocho archivos del motor y el script de auditoría) coinciden. [Comprobación](pedagogy/source-integrity.json).

## J. Evidencia visual

Las pruebas producen **33 capturas**: 22 con guías abiertas (once páginas en escritorio y móvil) y 11 de regresión con guías cerradas. Se inspeccionaron visualmente muestras de Inicio y Simulación; todas las páginas se recorrieron con Chromium y se verificaron automáticamente sus anchos y errores de JavaScript.

- [Inicio, escritorio, guía abierta](pedagogy/Inicio-1366-guia.png).
- [Simulación, móvil, guía abierta](pedagogy/Simulación-390-guia.png).
- [Resultados, escritorio, guía abierta](pedagogy/Resultados-1366-guia.png).
- [Teoría, escritorio, guía abierta](pedagogy/Teoría-1366-guia.png).
- [Comparación, escritorio, guía abierta](<pedagogy/Comparar escenarios-1366-guia.png>).
- [Simulación, escritorio, guía cerrada](pedagogy/regression/Simulación-1366.png).
- [Evidencia de corrida real, persistencia y comparación](pedagogy/regression/real-validation.json).

## K–L. Archivos

**Creados:** `frontend/src/education.tsx`, `frontend/tests/education.spec.ts`, este informe y las evidencias bajo `docs/pedagogy/` (registros, hashes, JSON de validación y PNG).

**Modificados:** `frontend/src/App.tsx`, `frontend/src/components.tsx`, `frontend/src/styles.css`, `frontend/tests/app.spec.ts`, `frontend/tests/redesign.spec.ts`. La compilación también actualiza artefactos generados en `frontend/dist/` y `frontend/tsconfig.tsbuildinfo`.

No se editaron backend, fórmulas, contratos JSON, dependencias, notebook ni resultados experimentales originales. La ejecución de pruebas añade corridas y registros sintéticos a la base local, como ya hacía la suite existente.

## M. Límites de la comprobación

Pruebas de navegador realizadas con Chromium; no se certifica compatibilidad con todos los navegadores ni se hizo una sesión con lector de pantalla. Las rutas de documentos del repositorio se explican en la interfaz; no se agregó un servidor de documentos ni un visor Markdown. La carpeta de trabajo no contiene `.git`, por lo que la integridad del motor se contrastó con el manifiesto previo. No se incorporaron funciones de la Entrega 2 ni una función de costos.
