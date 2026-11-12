export const cells = [
  {
    title: "Importaciones",
    text: "Usamos el mismo motor del backend; no mantenemos una segunda implementación.",
    code: "from pathlib import Path\nimport sys\n\nbackend_candidates = (Path.cwd() / \"backend\", Path.cwd().parent / \"backend\", Path.cwd())\nbackend_path = next((path.resolve() for path in backend_candidates if (path / \"app\").is_dir()), None)\nif backend_path is None:\n    raise RuntimeError(\"No se encontró backend/app. Abre el notebook del proyecto o ejecuta desde backend/.\")\nsys.path.insert(0, str(backend_path))\n\nfrom app.simulation.domain import SimulationConfig\nfrom app.simulation.engine import EmergencyDepartment\nfrom app.simulation.theory import mmc\nimport matplotlib.pyplot as plt",
  },
  {
    title: "Configuración",
    text: "Todas las tasas son sintéticas. El reloj empieza a las 00:00 y mide minutos.",
    code: "config = SimulationConfig(doctors=2, triage_staff=1,\n    duration_minutes=1440, seed=42,\n    arrival_rates_per_hour=(2, 5, 9, 6))",
  },
  {
    title: "Entidades",
    text: "Patient conserva marcas de tiempo individuales para reconstruir cada recorrido.",
    code: "from app.simulation.domain import Patient, Doctor, TriageStation\n# Las entidades se crean dentro del motor, al ocurrir la llegada.",
  },
  {
    title: "Recursos",
    text: "SimPy limita de verdad el acceso a triage, médicos y camas.",
    code: "department = EmergencyDepartment(config)\nprint(department.doctors.resource.capacity)\nprint(department.triage.resource.capacity)\nprint(department.beds.capacity)",
  },
  {
    title: "Proceso del paciente",
    text: "El generador solicita recursos, espera, consume tiempo y libera capacidad.",
    code: "import inspect\nprint(inspect.getsource(EmergencyDepartment.patient_process))",
  },
  {
    title: "Llegadas",
    text: "La inversión del riesgo acumulado respeta cada cambio de franja, incluso tasas cero.",
    code: "from app.simulation.strategies import TimeVaryingArrivalStrategy\nprint(inspect.getsource(TimeVaryingArrivalStrategy))",
  },
  {
    title: "Ejecución",
    text: "Una instancia nueva por réplica: la semilla reproduce sus resultados.",
    code: "result = department.run().model_dump()\nassert result == EmergencyDepartment(config).run().model_dump()",
  },
  {
    title: "Métricas",
    text: "Las utilizaciones y longitudes promedio se integran por evento, sin depender del muestreo.",
    code: 'result["metrics"]',
  },
  {
    title: "Gráficas",
    text: "La serie muestra pacientes esperando consulta. Los promedios incluyen todo el horizonte.",
    code: 'points = result["timeline"]\nplt.step([p["minute"] for p in points],\n         [p["doctor_queue"] for p in points], where="post")\nplt.xlabel("Minuto"); plt.ylabel("Pacientes en cola de consulta")\nplt.show()',
  },
  {
    title: "M/M/c",
    text: "Solo calculamos una referencia analítica para una cola aislada con Poisson estacionario, servicio exponencial y FIFO.",
    code: "reference = mmc(arrival_per_hour=5, service_mean_minutes=18, servers=2)\nreference",
  },
  {
    title: "Ley de Little",
    text: "El corte deja pacientes sin egreso; su tiempo acumulado explica el residuo.",
    code: 'little = result["little"]\nprint(little)\nif little["difference"] is not None:\n    assert abs(little["difference"] - little["censored_contribution"]) < 1e-8',
  },
  {
    title: "Comparación",
    text: "Una réplica para cada decisión de capacidad. No constituye una recomendación hospitalaria.",
    code: 'scenarios = [EmergencyDepartment(config.model_copy(update={"doctors": c})).run()\n             for c in (1, 2, 3, 4)]\n[(r.config.doctors, r.metrics["mean_wait_minutes"]) for r in scenarios]',
  },
];
