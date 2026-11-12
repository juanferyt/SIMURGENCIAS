"""Reproduce final-delivery experiments using the application engine.

Run from repository root: python scripts/final_experiments.py
All thresholds and scenarios are fixed here before looking at outputs.
"""
import argparse
import csv
import gzip
import hashlib
import json
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, stdev

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

OUT = ROOT / 'docs/final_results'
FIG = ROOT / 'docs/figuras'
SEEDS = list(range(42,72))
POLICIES = {'P0':dict(doctors=3), 'P1':dict(doctors=4),
            'P2':dict(doctors=3,peak_extra_doctors=1)}
SLA = {'mean_replication_p95_minutes':30, 'mean_abandoned_fraction':.03}
COLORS = ['#835ca3','#647fc6','#002a3f']


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+'\n',encoding='utf-8')


def save_csv(path, rows):
    with path.open('w',newline='',encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def stats(values):
    values = [v for v in values if v is not None]
    if not values:
        return dict(n=0,mean=None,std=None,ci95_lower=None,ci95_upper=None,margin=None)
    avg, sd = mean(values), stdev(values) if len(values)>1 else 0
    # Student t .975, df29; final analysis always has 30 independent replicas.
    margin = 2.045229642132703 * sd / len(values)**.5
    return dict(n=len(values),mean=avg,std=sd,ci95_lower=avg-margin,
                ci95_upper=avg+margin,margin=margin)


def chart_finish(fig, path):
    fig.tight_layout()
    fig.savefig(path,dpi=180,bbox_inches='tight')
    plt.close(fig)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--demo',action='store_true',help='One short run, not the final study')
    args=parser.parse_args()
    if args.demo:
        for policy,change in POLICIES.items():
            r=EmergencyDepartment(SimulationConfig(**change,seed=42,
                patience_mean_minutes=180,retry_probability=.3)).run()
            print(json.dumps(dict(policy=policy,seed=42,metrics=r.metrics),ensure_ascii=False))
        return
    begun=time.perf_counter()
    OUT.mkdir(parents=True,exist_ok=True);FIG.mkdir(parents=True,exist_ok=True)
    rows, nominal_runs = [],[]
    keys=['mean_wait_minutes','p95_wait_minutes','p99_wait_minutes','mean_queue_length',
          'doctor_utilization','bed_utilization','bed_full_fraction','throughput_per_hour',
          'abandoned_fraction','active_at_end','doctor_queue_at_end','doctor_hours',
          'nominal_doctor_hours','generated','external_generated','retry_visits','abandoned']
    for factor in (1,1.2,1.4):
        for beds in (2,4,6):
            for policy,change in POLICIES.items():
                for seed in SEEDS:
                    config=SimulationConfig(**change,seed=seed,observation_beds=beds,
                        arrival_rates_per_hour=tuple(factor*v for v in (2,5,9,6)),
                        patience_mean_minutes=180,abandonment_min_triage=4,
                        retry_probability=.3,retry_delay_minutes=60,max_retries=1)
                    result=EmergencyDepartment(config).run()
                    m=result.metrics
                    assert m['generated']==m['discharged']+m['abandoned']+m['active_at_end']
                    assert abs(result.little['difference']-result.little['censored_contribution'])<1e-8
                    assert abs(result.little['queue']['difference']-result.little['queue']['censored_contribution'])<1e-8
                    assert all(0<=point['beds_busy']<=beds for point in result.timeline)
                    assert 0<=m['doctor_utilization']<=1+1e-12
                    rows.append(dict(policy=policy,demand_factor=factor,beds=beds,seed=seed,
                                     **{key:m[key] for key in keys}))
                    if factor==1 and beds==4:
                        nominal_runs.append(dict(policy=policy,**result.model_dump(mode='json')))
            print(f'Completed demand={factor}, beds={beds}',flush=True)
    save_csv(OUT/'replicas.csv',rows)
    with gzip.open(OUT/'nominal_patient_runs.json.gz','wt',encoding='utf-8') as stream:
        json.dump(nominal_runs,stream,ensure_ascii=False,allow_nan=False)
    summary=[]
    for factor in (1,1.2,1.4):
        for beds in (2,4,6):
            for policy in POLICIES:
                records=[r for r in rows if r['policy']==policy and r['demand_factor']==factor and r['beds']==beds]
                item=dict(policy=policy,demand_factor=factor,beds=beds,
                          statistics={key:stats([r[key] for r in records]) for key in keys})
                item['meets_mean_sla']=(item['statistics']['p95_wait_minutes']['mean']<=SLA['mean_replication_p95_minutes']
                    and item['statistics']['abandoned_fraction']['mean']<=SLA['mean_abandoned_fraction'])
                item['meets_upper_ci_sla']=(item['statistics']['p95_wait_minutes']['ci95_upper']<=SLA['mean_replication_p95_minutes']
                    and item['statistics']['abandoned_fraction']['ci95_upper']<=SLA['mean_abandoned_fraction'])
                summary.append(item)
    save_json(OUT/'summary.json',summary)
    nominal=[r for r in summary if r['demand_factor']==1 and r['beds']==4]
    paired=[]
    for metric in keys:
        base={r['seed']:r[metric] for r in rows if r['policy']=='P0' and r['demand_factor']==1 and r['beds']==4}
        for policy in ('P1','P2'):
            alternatives={r['seed']:r[metric] for r in rows if r['policy']==policy and r['demand_factor']==1 and r['beds']==4}
            paired.append(dict(policy=policy,metric=metric,**stats([alternatives[s]-base[s] for s in SEEDS])))
    save_csv(OUT/'paired_differences.csv',paired)
    refs,contrast=[],[]
    for c in (3,4):
        theory=mmc(9,18,c)
        for seed in SEEDS:
            refs.append(run_mmc_reference(c,seed))
        for key in ('rho','Lq','Wq','W','L'):
            s=stats([r[key] for r in refs if r['c']==c])
            contrast.append(dict(doctors=c,metric=key,theoretical=theory[key],
                **s,relative_error_percent=100*abs(s['mean']-theory[key])/abs(theory[key])))
        print(f'Validated M/M/{c}',flush=True)
    save_csv(OUT/'mmc_replicas.csv',refs);save_csv(OUT/'mmc_contrast.csv',contrast)
    save_json(OUT/'mmc_contrast.json',contrast)
    # CI of mean per-replication percentiles, not CI of a pooled patient quantile.
    for key,title,ylabel,limit in [
        ('mean_wait_minutes','Espera media de consulta','Minutos',None),
        ('p95_wait_minutes','Media de p95 por réplica','Minutos',30),
        ('p99_wait_minutes','Media de p99 por réplica','Minutos',None),
        ('abandoned_fraction','Abandono por visita','Porcentaje',3)]:
        fig,ax=plt.subplots(figsize=(8.4,4.2))
        scale=100 if key=='abandoned_fraction' else 1
        vals=[r['statistics'][key]['mean']*scale for r in nominal]
        errors=[r['statistics'][key]['margin']*scale for r in nominal]
        ax.bar(['P0: 3 fijos','P1: 4 fijos','P2: refuerzo'],vals,yerr=errors,capsize=5,color=COLORS)
        if limit is not None:
            ax.axhline(limit,ls='--',color='#b42318',label=f'Umbral académico: {limit:g}')
            ax.legend(frameon=False)
        ax.set(title=title,xlabel='Política',ylabel=ylabel)
        ax.grid(axis='y',alpha=.15)
        chart_finish(fig,FIG/f'{key}.png')
    fig,axes=plt.subplots(1,2,figsize=(10,4))
    for ax,key,ylabel in zip(axes,['p95_wait_minutes','abandoned_fraction'],['Media p95 (min)','Abandono (%)']):
        scale=100 if key=='abandoned_fraction' else 1
        for policy,color in zip(POLICIES,COLORS):
            records=[r for r in summary if r['policy']==policy and r['beds']==4]
            ax.errorbar([100*(r['demand_factor']-1) for r in records],
                [r['statistics'][key]['mean']*scale for r in records],
                yerr=[r['statistics'][key]['margin']*scale for r in records],
                marker='o',color=color,label=policy,capsize=3)
        ax.axhline(3 if scale==100 else 30,ls='--',color='#b42318')
        ax.set(xlabel='Aumento sintético de llegadas (%)',ylabel=ylabel,xticks=[0,20,40]);ax.legend(frameon=False);ax.grid(alpha=.15)
    chart_finish(fig,FIG/'sensibilidad.png')
    fig,ax=plt.subplots(figsize=(8.4,4.2))
    for policy,color in zip(POLICIES,COLORS):
        records=[r for r in summary if r['policy']==policy and r['demand_factor']==1]
        ax.errorbar([r['beds'] for r in records],[100*r['statistics']['bed_full_fraction']['mean'] for r in records],
            yerr=[100*r['statistics']['bed_full_fraction']['margin'] for r in records],color=color,label=policy,marker='o',capsize=3)
    ax.set(xlabel='Camas de observación',ylabel='Tiempo con todas las camas ocupadas (%)',xticks=[2,4,6]);ax.legend(frameon=False);ax.grid(alpha=.15)
    chart_finish(fig,FIG/'camas.png')
    fig,ax=plt.subplots(figsize=(8.4,4.2))
    for policy,color in zip(POLICIES,COLORS):
        run=next(r for r in nominal_runs if r['policy']==policy and r['config']['seed']==42)
        ax.step([p['minute']/60 for p in run['timeline']],[p['doctor_queue'] for p in run['timeline']],where='post',color=color,label=policy)
    ax.set(xlabel='Hora simulada',ylabel='Pacientes en cola médica',xticks=list(range(0,25,3)));ax.legend(frameon=False);ax.grid(alpha=.15)
    chart_finish(fig,FIG/'cola_temporal.png')
    try:
        base_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
    except (OSError,subprocess.CalledProcessError):
        revision=ROOT/'BASE_REVISION.txt'
        base_commit=revision.read_text().strip() if revision.exists() else None
    files=list((ROOT/'backend/app/simulation').glob('*.py'))+[Path(__file__)]
    save_json(OUT/'manifest.json',dict(timestamp=datetime.now(timezone.utc).isoformat(),
        upstream_base_commit=base_commit,working_tree_changes=True,python=platform.python_version(),simpy=simpy.__version__,
        seeds=SEEDS,operational_runs=len(rows),nominal_runs=90,reference_runs=len(refs),
        thresholds=SLA,threshold_scope='Academic means across 30 replicas; not clinical standards',
        mean_p95_definition='Equal-weight mean of type-7 patient p95 within each replica',
        reference_warmup_minutes=14400,reference_observation_minutes=144000,
        elapsed_seconds=time.perf_counter()-begun,
        source_sha256={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}))
    print(json.dumps(nominal,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
