# Inventario anterior al rediseño

- Páginas por hash: Inicio, Modelo, Simulación, Resultados, Teoría, Laboratorio, Documentación.
- App.tsx concentra navegación, formularios de gestión y simulación, resultados, historial, comparación, teoría y documentación.
- React 19 + TypeScript + Vite; CSS propio (sin Tailwind); Recharts 2 y Lucide.
- api.ts define contratos y fetch; laboratory.ts conserva 12 celdas; main.tsx monta la aplicación.
- Integraciones: patients, attentions, resources, telemetry, simulations, simulations/run, simulations/compare, simulations/{id}, theory/mmc. Health existente: /api/health verifica SELECT 1.
- Las corridas contienen pacientes individuales, timeline, metrics, theory y little. No hay agregados de espera por triage ni histogramas en el contrato.
- Pruebas: tres casos Playwright contra API real. No hay repositorio Git en este directorio.
- Alcance: presentación y navegación; preservar backend, parámetros, fórmulas, contratos de red y datos experimentales.
