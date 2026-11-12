# Estado de la revisión final

## Ejecutado en este entorno

- Revisión base a1f2c193d957c56f7d593a46b2ac6cd29f0245df.
- 31 pruebas de modelo y reconstrucción de métricas aprobadas. Se excluyó la prueba que requiere el ciclo de vida PostgreSQL.
- 810 corridas operativas y 60 referencias M/M/c ejecutadas con SimPy 4.1.1 y Python 3.12.14.
- Conservación de visitas, identidades de áreas de Little, límite de camas, retiro no expulsivo y reproducibilidad comprobados.
- 100 peticiones reales al endpoint de teoría mediante ASGI local, sin lifespan, conexión PostgreSQL o transporte TCP.
- CSV de latencia del middleware, RAM RSS y CPU acumulada del proceso.

## Pendiente de verificación en el computador con Docker

1. `docker compose up --build -d` y comprobar `docker compose ps`.
2. `docker compose exec -T backend pytest -q` con PostgreSQL activo.
3. Ejecutar una corrida en Swagger con `peak_extra_doctors: 1`, `patience_mean_minutes: 180` y `retry_probability: 0.3`; recuperarla por su ID tras reiniciar el backend.
4. Verificar escritura de `datos/telemetry_log.csv` y ejecutar la sonda HTTP contra localhost:8000.
5. `docker compose -f docker-compose.final.yml run --build --rm experiments` para reproducir el estudio en contenedor.
6. Hacer commit de los archivos y registrar su SHA completo. El SHA de base no identifica los cambios locales entregados.
7. Verificar con el docente cómo aplica la modalidad individual. Correo del autor incorporado: juan.murillo334@pascualbravo.edu.co.

## Incertidumbres

No se certifica la nueva versión como desplegada en Docker ni se confunden los registros de Entrega 1 con una ejecución actual. Los umbrales son académicos. El cliente web histórico no incorpora controles para todos los parámetros nuevos: se utiliza Swagger/CLI para la demostración final.
