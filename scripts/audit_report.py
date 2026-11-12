"""Render the academic report exclusively from the audit's saved observations."""
import csv
import json
from pathlib import Path
from statistics import mean

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/results'


def read_json(name):
    return json.loads((OUT/name).read_text(encoding='utf-8'))


def read_csv(name):
    with (OUT/name).open(encoding='utf-8',newline='') as f:
        return list(csv.DictReader(f))


def fmt(value,places=4):
    return 'No definido' if value is None else f'{float(value):.{places}f}'


def table(headers,rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','|'+'|'.join(['---']*len(headers))+'|']+
                     ['| '+' | '.join(map(str,row))+' |' for row in rows])


def main():
    checks=read_json('final_checks.json')
    assert all(r['exit_code']==0 for r in checks), 'Verificaciones finales incompletas o fallidas'
    master=read_json('escenarios_1_4_medicos.json')
    stats=read_json('estadisticos_por_escenario.json')
    theory=read_json('mmc_analitico.json')
    contrast=read_json('mmc_vs_simpy.json')
    reproduction=read_json('reproducibilidad.json')
    manifest=read_json('experiment_manifest.json')
    api=read_json('api_audit.json')
    little=read_csv('little_modelo_completo.csv')
    reference_little=read_csv('little_referencia.csv')
    arrivals=read_csv('llegadas_por_franja.csv')
    triage=read_csv('espera_por_triage.csv')
    queue_error=max(abs(float(r['queue_residue'])-float(r['queue_pending_contribution'])) for r in little)
    system_error=max(abs(float(r['residue'])-float(r['pending_contribution'])) for r in little)
    rejected=sum(r['status']==429 for r in api['concurrency'])
    accepted=sum(r['status']==201 for r in api['concurrency'])
    text=['# Resultados de auditoría final · SIMURGENCIAS · Entrega 1',
        f"Auditoría experimental: {manifest['timestamp']} (UTC). Datos sintéticos. Todos los valores de este informe proceden de ejecuciones de esta auditoría, no de las evidencias previas.",
        '## A. Configuración experimental',
        'Se ejecutaron **120 corridas del modelo completo**, 30 para cada c=1,2,3,4. Semillas 42–71, comunes entre escenarios para comparación emparejada. Horizonte 1440 min, sistema vacío, sin calentamiento ni drenaje. Triage=1, camas=4, llegadas 2/5/9/6 por hora en cuatro franjas de 6 h, servicios exponenciales con medias 5/18/60 min, observación 0.2 y prioridad I–V no expropiativa.',
        'La API conserva el modo interactivo de una réplica por escenario. Las 120 réplicas académicas se ejecutan con el mismo motor mediante scripts y se guardan en archivos, sin crear 120 atenciones de gestión.',
        'Esquema actual sha256-v1: clave por (semilla, rol). La compatibilidad legacy-v1 ya existía antes de esta auditoría. No se modificaron motor, fórmulas, semillas ni resultados para esta entrega. Las secuencias distintas sustentan réplicas independientes operacionalmente; no prueban independencia estadística.',
        '## B. Reproducibilidad',
        f"Dos corridas completas con semilla 42: igualdad exacta **{reproduction['same_seed_equal']}**. Cambio a 100: métricas distintas **{reproduction['seed100_changed']}**. Entradas individuales idénticas entre los cuatro escenarios para cada semilla: **{reproduction['paired_demands_equal']}**.",
        table(['Semilla','Generados','Atendidos','Egresados','Wq (min)','p95 (min)','Throughput (egresos/h)'],
              [[s,reproduction[f'seed{s}']['generated'],reproduction[f'seed{s}']['treated'],reproduction[f'seed{s}']['discharged'],
                fmt(reproduction[f'seed{s}']['mean_wait_minutes']),fmt(reproduction[f'seed{s}']['p95_wait_minutes']),fmt(reproduction[f'seed{s}']['throughput_per_hour'])] for s in (42,100)]),
        '[Configuración y métricas completas](results/reproducibilidad.json). Los UUID, fechas y tiempo de cómputo de la API no son variables reproducibles y no se confunden con el resultado DES.',
        '## C–D. Comparación 1–4 médicos y tabla de KPI',
        'Cada valor es la media aritmética de 30 estadísticas de réplica. **p95** significa aquí media de los 30 percentiles 95 de esperas de pacientes, no percentil 95 de las 30 medias. Cola máxima es la media de máximos exactos por réplica. Unidades: tiempos en minutos, colas en personas, throughput en egresos/hora. Los conteos medios pueden ser fraccionarios.',
        table(['c','Wq','p95 espera','W','Lq','Cola máx. media','Util. %','Throughput','Atendidos','Egresados','Pendientes'],
              [[r['doctors'],fmt(r['Wq_mean'],2),fmt(r['p95_wait_mean_of_replications'],2),fmt(r['W_mean'],2),fmt(r['Lq_mean'],3),fmt(r['max_queue_mean'],2),
                fmt(r['utilization_mean']*100,2),fmt(r['throughput_per_hour_mean'],3),fmt(r['treated_mean'],2),fmt(r['discharged_mean'],2),fmt(r['pending_mean'],2)] for r in master]),
        '[Tabla maestra CSV](results/escenarios_1_4_medicos.csv) · [JSON](results/escenarios_1_4_medicos.json) · [120 filas por réplica](results/repeticiones_120.csv) · [Pacientes y series originales comprimidos](results/hospital_runs.json.gz).',
        'La espera Wq y sus percentiles incluyen a quienes iniciaron consulta. W incluye solo egresados. Quienes siguen esperando al corte no tienen una espera final observada; se reportan en los pendientes y en Little. Una media menor no describe automáticamente a todos los pacientes.',
        '### Dispersión entre réplicas',
        table(['c','Wq media','Wq mediana','DE muestral','Mín.','Máx.','p95 de las 30 medias'],
              [[c]+[fmt(stats[str(c)]['mean_wait_minutes'][k],3) for k in ('mean','median','std','min','max','p95')] for c in range(1,5)]),
        'Se usa desviación estándar muestral (n−1). Media, mediana, DE, mínimo, máximo y p95 de todas las métricas están en [estadisticos_por_escenario.json](results/estadisticos_por_escenario.json).',
        '### Tres percentiles que no son intercambiables',
        table(['c','Media de p95 de pacientes por réplica','p95 de pacientes agrupados','p95 de medias Wq de réplica'],
              [[r['doctors'],fmt(r['p95_wait_mean_of_replications']),fmt(r['p95_wait_pooled_patients']),fmt(r['p95_of_replication_mean_Wq'])] for r in master]),
        'Percentiles empíricos con interpolación lineal tipo 7, posición (n−1)p. El agrupado pondera implícitamente por cantidad de pacientes atendidos de cada réplica; la media de percentiles da peso igual a cada réplica. También se registran p50, p99 y probabilidad de espera (Wq > 10⁻⁹ min) por corrida.',
        '## E. Gráficas reales',
    ]
    for title,name in [('Médicos y espera media','medicos_vs_Wq.png'),('Médicos y p95 de pacientes','medicos_vs_p95.png'),
        ('Médicos y utilización','medicos_vs_utilizacion.png'),('Médicos y cola media','medicos_vs_Lq.png'),
        ('Médicos y throughput','medicos_vs_throughput.png'),('Cola temporal','evolucion_cola.png'),
        ('Llegadas por franja','llegadas_por_franja.png'),('Espera por triage','espera_por_triage.png')]:
        text.append(f'![{title}](results/{name})')
    text += ['La serie temporal usa c=2, semilla 42, elegida de antemano. Está muestreada para visualización; las medias y la cola máxima no se estiman a partir de esa muestra.',
        '## F. M/M/c analítico',
        'λ=9 pacientes/h=0.15/min; servicio medio=18 min; μ=60/18=3.333333 pacientes/h por servidor. ρ=λ/(cμ). La función calcula P0 por normalización y Pq mediante Erlang C. Wq=Pq/(cμ−λ), W=Wq+1/μ, Lq=λWq, L=λW.',
        table(['c','ρ','Estado','P0','Pq','Lq','Wq (min)','W (min)','L'],
              [[r['c'],fmt(r['rho'],3),'ESTABLE' if r['stable'] else 'INESTABLE']+
               [fmt(r[k]) if r['stable'] else 'No definido' for k in ('P0','Pq','Lq','Wq','W','L')] for r in theory]),
        'Para c=1 y c=2 no existe distribución estacionaria normalizable ni medias estacionarias finitas. No se atribuyen valores finitos a esas métricas. [Resultados analíticos](results/mmc_analitico.json). Fórmula contrastada con [material académico de MIT sobre colas](https://web.mit.edu/dimitrib/www/Queueing_Data_Nets.pdf).',
        '## G. Referencia SimPy compatible',
        '**60 corridas adicionales:** c=3 y c=4, 30 semillas 42–71 para cada una. Una única cola FIFO, Resource con c servidores, Poisson estacionario, servicio exponencial, sin triage, prioridad ni observación. Código: `backend/app/simulation/reference.py`. El modelo completo no se cambia por este experimento.',
        'Se eligió antes de ejecutar una ventana larga: 14400 min (10 días) de warm-up y 144000 min (100 días) de observación. Las áreas de ocupación y cola se recortan exactamente a esa ventana. W y Wq usan la cohorte que llega durante la ventana, seguida hasta completar servicio. Se drena esa cohorte después del corte, sin contaminar las áreas temporales. En FIFO, las llegadas posteriores al corte no retrasarían a esa cohorte.',
        'El warm-up reduce el efecto de partir vacío, sin demostrar que lo elimina. No se seleccionaron semillas ni se ajustó el horizonte después de ver los errores. [60 réplicas de referencia](results/mmc_repeticiones_60.csv).',
        '## H. M/M/c frente a SimPy y diferencias',
        table(['c','Métrica','Teoría','SimPy medio','Diferencia absoluta','Diferencia %','DE entre réplicas'],
              [[r['doctors'],r['metric'],fmt(r['theoretical'],6),fmt(r['simpy_mean'],6),fmt(r['absolute_difference'],6),fmt(r['percent_difference'],3),fmt(r['replication_std'],6)] for r in contrast]),
        'Diferencia % = |SimPy−teoría| / |teoría| × 100. No se calcula si el denominador es cero o indefinido. ρ es una fracción, L/Lq personas y W/Wq minutos. [CSV del contraste](results/mmc_vs_simpy.csv).',
        f"Los errores relativos observados van de {min(r['percent_difference'] for r in contrast):.3f} % a {max(r['percent_difference'] for r in contrast):.3f} %. No se presentan como tolerancia garantizada ni como prueba estadística de equivalencia.",
        'Las diferencias son compatibles con una observación finita y variable de un sistema aleatorio: treinta réplicas no eliminan el error muestral, las tasas y medias realizadas difieren de los parámetros nominales y los bordes de la ventana introducen términos medibles. A ρ=0.9 la variabilidad de la cola es mayor que con cuatro servidores. La DE entre réplicas se publica; no se ocultan valores desfavorables ni se atribuye automáticamente la diferencia a un defecto de SimPy.',
        'El DES completo puede diferir mucho más porque tiene llegadas no estacionarias, salida de triage como entrada a consulta, prioridades, varias etapas, observación y pacientes pendientes al cierre. Su comparación interactiva estacionaria sigue siendo solo una referencia nominal, no este contraste compatible.',
        '## I. Ley de Little: sistema y cola',
        'Para el modelo completo: λ=egresos/H y W=permanencia de egresados. L integra a todos los presentes. Se verifica L−λW=Σ(H−llegada de pendientes)/H. Para consulta, λq=inicios de consulta/H y Wq=espera de quienes iniciaron; Lq−λqWq=Σ(H−entrada a cola de quienes siguen esperando)/H. Las dos tasas tienen poblaciones distintas y no se intercambian.',
        table(['c (seed 42)','L','λ egreso/min','W','λW','Residuo','Aporte pendientes'],
              [[r['doctors']]+[fmt(r[k],6) for k in ('L','lambda_per_minute','W','lambda_W','residue','pending_contribution')] for r in little if r['seed']=='42']),
        table(['c (seed 42)','Lq','λ inicios/min','Wq','λWq','Residuo','Aporte pendientes cola'],
              [[r['doctors']]+[fmt(r[k],6) for k in ('Lq','lambda_starts','Wq','lambda_Wq','queue_residue','queue_pending_contribution')] for r in little if r['seed']=='42']),
        f'En las 120 corridas, máximo error de la identidad de sistema: {system_error:.3e}; de cola: {queue_error:.3e}. La magnitud es compatible con redondeo de coma flotante. [Tabla completa de Little](results/little_modelo_completo.csv).',
        'En la referencia con warm-up hay además pacientes que ingresaron antes de la ventana. La identidad exacta es área temporal = área de la cohorte + aporte de entrada − aporte posterior al corte. Se verificó para L y Lq en las 60 corridas. No se fuerza L=λW ignorando esos bordes. [Little de referencia](results/little_referencia.csv).',
        '## J. Llegadas no estacionarias',
        'Se cuentan las marcas de llegada del motor completo, usando c=2 y las 30 semillas. No se cuadruplican las llegadas al agregar escenarios emparejados.',
        table(['Franja','λ configurada /h','Conteo esperado por 6 h','Conteo medio observado','λ observada /h'],
              [[r['period'],r['expected_per_hour'],r['expected_count'],fmt(r['mean_count'],3),fmt(r['observed_per_hour'],3)] for r in arrivals]),
        'Las diferencias frente a las esperanzas son variación de muestreo, no tasas cambiadas para ajustar el resultado. La mayor demanda aparece efectivamente en 12–18 h. [Conteos y tasas](results/llegadas_por_franja.csv) · [Por semilla](results/llegadas_por_franja_replicas.csv).',
        '## K. Límite técnico C6',
        f"Con MAX_CONCURRENT_SIMULATIONS=2, tres solicitudes HTTP coordinadas mediante bloqueo transaccional real en PostgreSQL produjeron **{accepted} respuestas 201 y {rejected} respuestas 429**. Todas las 429 incluyeron Retry-After=2; al terminar active_simulations=0 y una solicitud posterior fue admitida. [Evidencia HTTP](results/api_audit.json).",
        'A y B ejecutan SimPy real y esperan al guardar por un bloqueo SHARE temporal sobre simulation_runs. Se observa active_simulations=2 y C recibe 429. El bloqueo se libera siempre con rollback y A/B reciben 201. Una transacción PostgreSQL READ ONLY causa el error real SQLSTATE 25006 en la ruta simulate; active vuelve a 0 y la plaza puede reutilizarse. No se reemplazan el motor ni las respuestas para esta evidencia. El test unitario aislado preexistente usa una barrera y se conserva como cobertura complementaria.',
        '**Límite técnico de admisión de simulaciones por proceso**, cola interna de espera=0. No es capacidad hospitalaria, prueba de rendimiento máximo ni componente formal de carga de Entrega 2. El servidor HTTP y su threadpool pueden tener esperas propias fuera de este semáforo.',
        '## L. Hallazgos que deben discutirse',
        'Bajo los parámetros sintéticos utilizados, las medias de Wq, p95, Lq y pendientes disminuyen al aumentar médicos. El throughput crece, pero de 3 a 4 médicos lo hace menos: se aproxima al límite impuesto por la demanda y otras etapas. Esta observación se refiere al modelo y a las 30 semillas, no a una dotación hospitalaria óptima.',
        'Resultado no monotónico por prioridad que se conserva: con un médico, triage V tiene menor espera observada que III. Eso no demuestra mejor atención de V. Solo 70 de sus 604 pacientes iniciaron consulta, frente a 1077 de 1648 en III; 534 pacientes V aún no iniciaban. Con dos médicos empiezan 338 pacientes V, incluyendo esperas largas antes censuradas: su media observada sube. La selección de pacientes completados/iniciados cambia entre escenarios.',
        table(['c','Triage','Generados','Iniciaron','No iniciaron','Wq de iniciados','p95 de iniciados'],
              [[r['doctors'],r['triage'],r['generated'],r['started'],r['not_started'],fmt(r['mean_wait'],3),fmt(r['p95_wait'],3)] for r in triage if r['doctors'] in ('1','2') and r['triage'] in ('3','4','5')]),
        'La utilización de un médico no llega a 100 % en todo el día pese a la cola acumulada: hay un arranque vacío y una franja inicial de menor demanda. Medir solo horas congestionadas produciría otra definición.',
        '## M. Limitaciones y conclusión',
        'Modelo académico sin datos hospitalarios ni validación clínica; sin abandono, bloqueo médico esperando cama, cambios de turno o calentamiento en el modelo completo. Las esperas censuradas no se imputan. Los percentiles de muestra no son garantías de servicio. El contraste largo reduce transitorios pero no prueba estacionariedad exacta ni error universal. Se calculan IC95% t de las medias de réplica; no inferencia bayesiana ni KS.',
        'La API de gestión es una demo local sin autenticación y con una atención por paciente. La telemetría de gestión interpreta etapas registradas, no asignaciones reales de médicos. Contadores técnicos en memoria se reinician al reiniciar el proceso; snapshots y resultados guardados permanecen en PostgreSQL. La interfaz interactiva conserva una réplica por escenario; el lote académico de 30 está en scripts y archivos.',
        'Git: git status y git log -1 --oneline fallan porque no existe .git. Se guardó el estado previo en results/previous-audit/ y hashes en final-audit-before.json; la ejecución usa Python 3.12.14 en Docker.',
        '**ENTREGA 1: LISTA PARA ENTREGAR**, en su alcance académico y con las limitaciones anteriores. La matriz C1–C7 y el detalle de pruebas están en [ENTREGA_1.md](ENTREGA_1.md) y [VERIFICACION.md](VERIFICACION.md). No se implementaron Locust, PyMC, KS, ML, Mesa, agentes, modelo híbrido ni predictor.',
        '## Reproducir los resultados',
        'Desde la raíz, con Docker activo:',
        '```powershell\ndocker compose up --build -d\ndocker compose -f docker-compose.yml -f docker-compose.audit.yml build audit\ndocker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_api.py\ndocker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_experiments.py\ndocker compose -f docker-compose.yml -f docker-compose.audit.yml run --rm --no-deps audit python /workspace/scripts/audit_report.py\n```',
        'Las ejecuciones siguientes regeneran los archivos de resultados con los mismos valores numéricos si versiones/esquema/semillas coinciden; fechas, tiempos de cómputo, UUID y orden de respuesta concurrente pueden cambiar. Se recomienda conservar una copia de `docs/results/` antes de volver a auditar si se necesita guardar cada ejecución histórica.',
    ]
    ci=read_json('intervalos_confianza_95.json')
    changes=read_json('cambios_capacidad.json')
    restart=read_json('restart_validation.json')
    text += ['## N. Intervalos de confianza 95% de las medias',
        'n=30; t(0.975,29)=2.045229642132703; IC = media ± t × s / sqrt(30), con s muestral (n−1). Son intervalos marginales por escenario, no intervalos de pacientes ni de diferencias emparejadas. No se deduce significación de comparar su solapamiento. Su cobertura es aproximada bajo independencia entre réplicas y aproximación de la media; no se efectuó KS ni se ajustaron parámetros.',
        table(['c','Métrica','Media','DE','IC inferior','IC superior'],[[r['doctors'],r['metric']]+[fmt(r[k],6) for k in ('mean','std','ci95_lower','ci95_upper')] for r in ci]),
        'Las utilizaciones de esta tabla son fracciones (multiplicar por 100 para porcentaje). Archivo: [intervalos_confianza_95.csv](results/intervalos_confianza_95.csv).',
        '## O. Cambios de capacidad',
        table(['Cambio','Reducción Wq min','Reducción Wq %','Cambio p95 min','Cambio Lq','Cambio utilización pp','Cambio egresos/h'],[[str(r['from_doctors'])+' → '+str(r['to_doctors'])]+[fmt(r[k],4) for k in ('Wq_reduction','Wq_reduction_percent','p95_change','Lq_change','utilization_change_pp','throughput_change')] for r in changes]),
        'Bajo los parámetros sintéticos del experimento, pasar de 3 a 4 médicos reduce espera y utilización, mientras el throughput aumenta solo 0.0625 egresos/h. No existe una función de costos ni un objetivo de optimización que permita declarar automáticamente mejor el escenario de cuatro médicos.',
        '## P. Telemetría y persistencia comprobadas',
        'La respuesta real contiene timestamp, management, technical y simulations (plural). Cada corrida produce un snapshot source=simulation con ID; consultar telemetría persiste un snapshot source=management. simulation_runs, pacientes, atenciones y snapshots sobreviven al reinicio. El GET de telemetría tiene ese efecto de escritura documentado.',
        table(['Medida','Antes del reinicio','Después'],[[k,restart['before']['technical'][k],restart['after']['technical'][k]] for k in ('completed_simulations','rejected_simulations','active_simulations','requests_processed')]),
        'Los contadores técnicos son memoria del proceso y vuelven a cero; solicitudes de health/telemetría pueden incrementarlos inmediatamente. Corrida recuperada idéntica: '+str(restart['persisted_run_equal'])+'. [Evidencia de reinicio](results/restart_validation.json).',
        '## Q. Auditoría de KPI y unidades',
        table(['KPI','Fórmula/población','Unidad','Censura'],[
            ['Wq','media(inicio consulta − fin triage), solo inicios','min','No imputa la espera final de pendientes'],
            ['p95','tipo 7, posición (n−1)×0.95 de las esperas individuales','min','Misma población que Wq'],
            ['W','media(egreso − llegada), solo egresados','min','Excluye permanencias inconclusas'],
            ['Lq','integral exacta de cola / H','pacientes','Incluye tiempo acumulado de quienes esperan al corte'],
            ['Utilización','integral ocupación / (c×H)','fracción','Incluye servicio parcial antes de H'],
            ['Throughput','egresados / (H/60)','egresos/h','No confunde consultas terminadas con egresos'],
            ['429','solicitud que no adquiere plaza técnica','respuesta HTTP','No cuenta pacientes ni rechazo clínico']]),
        'test_kpis_reconstructed_from_individual_records reconstruye Wq, W, cuantiles, Lq, utilización, probabilidad de espera y throughput desde los registros. Conservación: generados = egresados + pendientes. Atendidos = consultas terminadas, y no se suman a egresados.',
        '## R. Triage y alcance del contrato',
        'La API sí aporta triage_end y consultation_start por paciente: el script científico calcula correctamente la espera por triage desde esas observaciones. La ausencia de agregados en el frontend no impide el análisis fuera de él. Se generó 08_espera_por_triage.png, solo para pacientes que iniciaron consulta; los no iniciados se publican como censurados.',
        '## S. Validaciones finales',
        table(['Comando','Código de salida'],[[r['command'],r['exit_code']] for r in checks]),
        'La evidencia de prioridad no expropiativa preexistente obtuvo (inicio,fin): paciente 1=(0.5,10.5), paciente 3 urgente=(10.5,11.5), paciente 2 esperando=(11.5,12.5). El urgente no interrumpió al primero.',
        '## T. Hallazgos corregidos y pendientes',
        'Corregidos: documentación con siete páginas y pruebas antiguas; descripción obsoleta de RNG seed/seed+1; ausencia de IC95%; falta de nombres numerados de figuras y de cambios cuantificados entre escenarios. La documentación histórica se conserva en previous-audit. No fue necesario corregir fórmulas ni código funcional del backend o frontend.',
        'Limitaciones: no Git/commit verificable; eventos representados por marcas de transición por paciente, no por un dump interno de la agenda SimPy; datos sintéticos y censura; IC aproximados de medias; límite técnico por proceso; sin autenticación. Ninguna requiere implementar Entrega 2. No quedan correcciones funcionales obligatorias dentro del alcance auditado.']
    (ROOT/'docs/RESULTADOS_ENTREGA_1.md').write_text('\n\n'.join(text)+'\n',encoding='utf-8')
    print('Informe académico generado exclusivamente desde resultados guardados.')


if __name__=='__main__':
    main()
