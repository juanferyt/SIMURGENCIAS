"""Reproducible Entrega 1 experiments; real engine runs, no fabricated observations."""
import csv
import gzip
import hashlib
import json
import platform
import sys
import time
import math
import shutil
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median, stdev

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import simpy
from app.simulation.domain import SimulationConfig
from app.simulation.engine import EmergencyDepartment
from app.simulation.reference import run_mmc_reference
from app.simulation.statistics import percentile
from app.simulation.theory import mmc

OUT = ROOT / 'docs/results'
OUT.mkdir(exist_ok=True, parents=True)
SEEDS = list(range(42,72))
NOTE = 'Resultados del modelo SIMURGENCIAS. Datos sintéticos.'


def save_json(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')


def save_csv(name, rows):
    with (OUT / name).open('w',newline='',encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def stats(values):
    valid = [v for v in values if v is not None]
    if not valid:
        return dict(n=0)
    result = dict(n=len(valid), mean=mean(valid), median=median(valid), std=stdev(valid) if len(valid)>1 else 0,
                  min=min(valid), max=max(valid), p95=percentile(valid,.95))
    # Two-sided Student t(.975, 29), for the prespecified 30 replications.
    if len(valid) == 30:
        margin = 2.045229642132703 * result['std'] / math.sqrt(30)
        result.update(ci95_lower=result['mean']-margin, ci95_upper=result['mean']+margin, t_critical=2.045229642132703)
    return result


def finish(fig, name):
    fig.text(.5,.015,NOTE,ha='center',fontsize=8,color='#526571')
    fig.tight_layout(rect=(0,.05,1,1))
    fig.savefig(OUT / name,dpi=170)
    plt.close(fig)


def main():
    begun = time.perf_counter()
    runs, rows, little, arrival_rows = [], [], [], []
    for c in range(1,5):
        for seed in SEEDS:
            result = EmergencyDepartment(SimulationConfig(doctors=c,seed=seed, duration_minutes=1440,
                arrival_profile='time_varying', arrival_rates_per_hour=(2,5,9,6), triage_staff=1,
                observation_beds=4, triage_mean_minutes=5, consultation_mean_minutes=18,
                observation_mean_minutes=60, observation_probability=.2, priority_policy='triage',
                rng_scheme='sha256-v1')).run().model_dump(mode='json')
            runs.append(result)
            rows.append(dict(doctors=c,seed=seed,**{k:v for k,v in result['metrics'].items() if not isinstance(v,dict)}))
            l = result['little']
            assert abs(l['difference']-l['censored_contribution'])<1e-8
            assert abs(l['queue']['difference']-l['queue']['censored_contribution'])<1e-8
            little.append(dict(doctors=c,seed=seed,L=l['L_observed'],lambda_per_minute=l['lambda_observed_per_minute'],
                W=l['W_observed_minutes'],lambda_W=l['lambda_W'],residue=l['difference'],pending=result['metrics']['active_at_end'],pending_contribution=l['censored_contribution'],
                Lq=l['queue']['Lq_observed'],lambda_starts=l['queue']['lambda_starts_per_minute'],Wq=l['queue']['Wq_observed_minutes'],
                lambda_Wq=l['queue']['lambda_Wq'],queue_residue=l['queue']['difference'],queue_pending_contribution=l['queue']['censored_contribution']))
            if c==2:
                for period in range(4):
                    count=sum(int(p['arrival']//360)%4==period for p in result['patients'])
                    arrival_rows.append(dict(seed=seed,period=period,count=count))
        print(f'Modelo completo: {c} médicos, 30 réplicas ejecutadas.',flush=True)
    def demands(r):
        return [[p[k] for k in ('arrival','triage_level','triage_service','consultation_service','observation_service','needs_observation')] for p in r['patients']]
    for i,seed in enumerate(SEEDS):
        assert all(demands(runs[i])==demands(runs[i+30*c]) for c in range(1,4))
    r42 = EmergencyDepartment(SimulationConfig(seed=42)).run().model_dump(mode='json')
    again = EmergencyDepartment(SimulationConfig(seed=42)).run().model_dump(mode='json')
    r100 = EmergencyDepartment(SimulationConfig(seed=100)).run().model_dump(mode='json')
    assert r42==again and demands(r42)!=demands(r100)
    def event_records(r):
        return [[p['id'], k, p[k]] for p in r['patients'] for k in ('arrival','triage_start','triage_end','consultation_start','consultation_end','observation_start','departure') if p[k] is not None]
    save_json('reproducibilidad.json',dict(config=r42['config'],same_seed_equal=r42==again,
        patients_equal=r42['patients']==again['patients'], metrics_equal=r42['metrics']==again['metrics'],
        timeline_equal=r42['timeline']==again['timeline'], patient_events_equal=event_records(r42)==event_records(again),
        event_scope='Marcas de transición por paciente; el motor no exporta la cola interna de eventos SimPy.',
        seed100_patients_changed=r42['patients']!=r100['patients'],seed100_timeline_changed=r42['timeline']!=r100['timeline'],
        seed100_events_changed=event_records(r42)!=event_records(r100),seed42_repeat=again['metrics'],
        seed100_changed=r42['metrics']!=r100['metrics'],seed42=r42['metrics'],seed100=r100['metrics'],paired_demands_equal=True))
    save_csv('repeticiones_120.csv',rows)
    with gzip.GzipFile(filename=str(OUT/'hospital_runs.json.gz'),mode='wb',mtime=0) as f:
        f.write(json.dumps(runs,ensure_ascii=False,allow_nan=False).encode('utf-8'))
    statistics = {}
    master = []
    triage_rows = []
    for c in range(1,5):
        selected=[r for r in rows if r['doctors']==c]
        statistics[str(c)]={key:stats([r[key] for r in selected]) for key in selected[0] if key not in ('doctors','seed')}
        pooled=[]
        for level in range(1,6):
            patients=[p for r in runs if r['config']['doctors']==c for p in r['patients'] if p['triage_level']==level]
            waits=[p['consultation_start']-p['triage_end'] for p in patients if p['consultation_start'] is not None]
            pooled.extend(waits)
            triage_rows.append(dict(doctors=c,triage=level,generated=len(patients),started=len(waits),
                not_started=len(patients)-len(waits),mean_wait=mean(waits) if waits else None,p95_wait=percentile(waits,.95)))
        s=statistics[str(c)]
        master.append(dict(doctors=c,replications=30,Wq_mean=s['mean_wait_minutes']['mean'],
            p95_wait_mean_of_replications=s['p95_wait_minutes']['mean'],p95_wait_pooled_patients=percentile(pooled,.95),
            p95_of_replication_mean_Wq=s['mean_wait_minutes']['p95'],W_mean=s['mean_system_minutes']['mean'],
            Lq_mean=s['mean_queue_length']['mean'],max_queue_mean=s['max_queue_length']['mean'],
            max_queue_all_replications=s['max_queue_length']['max'],utilization_mean=s['doctor_utilization']['mean'],
            throughput_per_hour_mean=s['throughput_per_hour']['mean'],treated_mean=s['treated']['mean'],
            discharged_mean=s['discharged']['mean'],pending_mean=s['active_at_end']['mean'],generated_mean=s['generated']['mean']))
    save_json('estadisticos_por_escenario.json',statistics)
    save_json('escenarios_1_4_medicos.json',master)
    save_csv('escenarios_1_4_medicos.csv',master)
    save_csv('little_modelo_completo.csv',little)
    save_csv('little_validation.csv',little)
    ci_rows=[dict(doctors=c,metric=key,**statistics[str(c)][key]) for c in range(1,5)
        for key in ('mean_wait_minutes','mean_queue_length','doctor_utilization','throughput_per_hour')]
    save_csv('intervalos_confianza_95.csv',ci_rows)
    save_json('intervalos_confianza_95.json',ci_rows)
    changes=[]
    for before,after in zip(master,master[1:]):
        changes.append(dict(from_doctors=before['doctors'],to_doctors=after['doctors'],
            Wq_reduction=before['Wq_mean']-after['Wq_mean'],
            Wq_reduction_percent=100*(before['Wq_mean']-after['Wq_mean'])/before['Wq_mean'],
            p95_change=after['p95_wait_mean_of_replications']-before['p95_wait_mean_of_replications'],
            Lq_change=after['Lq_mean']-before['Lq_mean'],
            utilization_change_pp=100*(after['utilization_mean']-before['utilization_mean']),
            throughput_change=after['throughput_per_hour_mean']-before['throughput_per_hour_mean']))
    save_csv('cambios_capacidad.csv',changes)
    save_json('cambios_capacidad.json',changes)
    save_csv('espera_por_triage.csv',triage_rows)
    save_csv('llegadas_por_franja_replicas.csv',arrival_rows)
    arrivals=[]
    for period, rate in enumerate((2,5,9,6)):
        counts=[r['count'] for r in arrival_rows if r['period']==period]
        arrivals.append(dict(period=['00–06','06–12','12–18','18–24'][period],expected_per_hour=rate,
            expected_count=6*rate,total=sum(counts),mean_count=mean(counts),std_count=stdev(counts),observed_per_hour=mean(counts)/6))
    save_csv('llegadas_por_franja.csv',arrivals)
    for key,ylabel,title,name in [
        ('Wq_mean','Wq (min)','Espera media de consulta','medicos_vs_Wq.png'),
        ('p95_wait_mean_of_replications','p95 de espera (min)','Promedio de p95 intrarréplica de pacientes','medicos_vs_p95.png'),
        ('utilization_mean','Fracción ocupada','Utilización médica media','medicos_vs_utilizacion.png'),
        ('Lq_mean','Pacientes','Longitud media de cola de consulta','medicos_vs_Lq.png'),
        ('throughput_per_hour_mean','Egresos / hora','Throughput medio de egreso','medicos_vs_throughput.png')]:
        fig,ax=plt.subplots(figsize=(7,4.5))
        ax.plot([r['doctors'] for r in master],[r[key] for r in master],marker='o',color='#087e80',label='Media de 30 réplicas')
        ax.set(title=title,xlabel='Número de médicos',ylabel=ylabel,xticks=[1,2,3,4])
        ax.grid(alpha=.2);ax.legend();finish(fig,name)
    representative=runs[30]  # c=2, seed42, predetermined (not selected for appearance)
    fig,ax=plt.subplots(figsize=(9,4.5));points=representative['timeline']
    ax.step([p['minute']/60 for p in points],[p['doctor_queue'] for p in points],where='post',label='2 médicos · semilla 42',color='#087e80')
    ax.set(title='Cola de consulta durante 24 horas',xlabel='Hora simulada',ylabel='Pacientes en cola');ax.legend();ax.grid(alpha=.2);finish(fig,'evolucion_cola.png')
    fig,ax=plt.subplots(figsize=(8,4.5));x=list(range(4))
    ax.bar([i-.17 for i in x],[r['mean_count'] for r in arrivals],width=.34,label='Observado: media de 30 réplicas',color='#087e80')
    ax.bar([i+.17 for i in x],[r['expected_count'] for r in arrivals],width=.34,label='Esperanza sintética λ × 6 h',color='#e7b562')
    ax.set(title='Llegadas no estacionarias por franja',xlabel='Franja horaria',ylabel='Llegadas en 6 horas',xticks=x,xticklabels=[r['period'] for r in arrivals]);ax.legend();finish(fig,'llegadas_por_franja.png')
    fig,ax=plt.subplots(figsize=(8,4.5))
    for c in range(1,5):
        records=[r for r in triage_rows if r['doctors']==c]
        ax.plot([r['triage'] for r in records],[r['mean_wait'] for r in records],marker='o',label=f'{c} médicos')
    ax.set(title='Espera por nivel de triage · pacientes que iniciaron consulta',xlabel='Triage académico',ylabel='Espera media agrupada (min)',xticks=[1,2,3,4,5],xticklabels=['I','II','III','IV','V']);ax.grid(alpha=.2);ax.legend();finish(fig,'espera_por_triage.png')
    for old,new in zip(['medicos_vs_Wq.png','medicos_vs_p95.png','medicos_vs_utilizacion.png','medicos_vs_Lq.png','medicos_vs_throughput.png','evolucion_cola.png','llegadas_por_franja.png','espera_por_triage.png'],
        ['01_wq_por_medicos.png','02_p95_espera_por_medicos.png','03_utilizacion_por_medicos.png','04_lq_por_medicos.png','05_throughput_por_medicos.png','06_cola_temporal.png','07_llegadas_por_franja.png','08_espera_por_triage.png']):
        shutil.copyfile(OUT/old,OUT/new)

    theoretical=[mmc(9,18,c) for c in range(1,5)]
    save_json('mmc_analitico.json',theoretical)
    references=[]
    for c in (3,4):
        for seed in SEEDS:
            r=run_mmc_reference(c,seed)
            assert abs(r['L']-r['lambda_W']-r['boundary_L'])<1e-8
            assert abs(r['Lq']-r['lambda_Wq']-r['boundary_Lq'])<1e-8
            references.append(r)
        print(f'Referencia M/M/{c}: 30 réplicas, 10 días warm-up + 100 días observados.',flush=True)
    save_csv('mmc_repeticiones_60.csv',references)
    contrast=[]
    for c in (3,4):
        ref=theoretical[c-1]
        for metric in ('rho','Lq','Wq','W','L'):
            values=[r[metric] for r in references if r['c']==c]
            empirical=mean(values);absolute=abs(empirical-ref[metric])
            contrast.append(dict(doctors=c,metric=metric,theoretical=ref[metric],simpy_mean=empirical,
                absolute_difference=absolute,percent_difference=100*absolute/abs(ref[metric]) if ref[metric] else None,
                replication_std=stdev(values)))
    save_csv('mmc_vs_simpy.csv',contrast)
    save_json('mmc_vs_simpy.json',contrast)
    save_csv('little_referencia.csv',[{k:r[k] for k in ('c','seed','L','lambda_observed','W','lambda_W','boundary_L','Lq','Wq','lambda_Wq','boundary_Lq')} for r in references])
    save_json('experiment_manifest.json',dict(timestamp=datetime.now(timezone.utc).isoformat(),python=platform.python_version(),simpy=simpy.__version__,
        seeds=SEEDS,full_model_runs=len(runs),reference_runs=len(references),config=r42['config'],
        reference=dict(arrival_per_hour=9,service_mean_minutes=18,warmup_minutes=14400,observation_minutes=144000),
        rng_scheme='sha256-v1',percentile='Type 7 linear interpolation; patients who started consultation',
        elapsed_seconds=time.perf_counter()-begun,source_sha256={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
        for p in list((ROOT/'backend/app/simulation').glob('*.py'))+[Path(__file__)]}))
    print(json.dumps(master,indent=2),flush=True)
    print(json.dumps(contrast,indent=2),flush=True)


if __name__=='__main__':
    main()
