"""Real HTTP/PostgreSQL audit; preserves data and labels new records AUDIT-*.

The bounded six-request concurrency probe verifies admission, not load capacity.
"""
import json
import os
import platform
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
from threading import Barrier

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'backend'))
import httpx
from sqlalchemy import inspect, text
from app.database import engine
from app.seed import seed

BASE=os.getenv('API_URL','http://localhost:8000')
FRONT=os.getenv('FRONTEND_URL','http://localhost:8080')
OUT=ROOT/'docs/results'
OUT.mkdir(parents=True,exist_ok=True)


def counts():
    with engine.connect() as conn:
        return {table:conn.execute(text(f'SELECT count(*) FROM {table}')).scalar_one()
                for table in ('patients','attentions','resource_configurations','simulation_runs','telemetry')}


def main():
    operations=[]
    with httpx.Client(base_url=BASE,timeout=180) as client:
        def request(method,path,expected=200,body=None):
            response=client.request(method,path,json=body) if body is not None else client.request(method,path)
            payload=response.json() if 'application/json' in response.headers.get('content-type','') else None
            operations.append(dict(method=method,path=path,expected=expected,status=response.status_code,
                passed=response.status_code==expected,request=body,response=payload if response.status_code>=400 else None))
            assert response.status_code==expected,(method,path,response.status_code,response.text[:200])
            return payload
        health=request('GET','/api/health');assert health=={'status':'ok','database':'postgresql'}
        assert client.get('/docs').status_code==200
        assert httpx.get(FRONT,timeout=30).status_code==200
        schema=request('GET','/openapi.json')
        tables=inspect(engine).get_table_names()
        assert set(('patients','attentions','resource_configurations','simulation_runs','telemetry','alembic_version'))<=set(tables)
        with engine.connect() as conn:
            migration=conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one()
            pg=conn.execute(text('SELECT version()')).scalar_one()
        before_seed=counts();seed();after_once=counts();seed();after_twice=counts()
        assert before_seed==after_once==after_twice
        request('GET','/api/patients');request('GET','/api/attentions')
        patient=request('POST','/api/patients',201,{'code':'AUDIT-'+uuid.uuid4().hex,'triage_level':2})
        assert patient['synthetic'] is True and isinstance(patient['id'],int)
        request('POST','/api/patients',409,{'code':patient['code'],'triage_level':2})
        request('POST','/api/patients',422,{'code':'','triage_level':6})
        request('POST','/api/attentions',404,{'patient_id':2147483647})
        attention=request('POST','/api/attentions',201,{'patient_id':patient['id']})
        request('POST','/api/attentions',409,{'patient_id':patient['id']})
        request('PATCH',f'/api/attentions/{attention["id"]}',409,{'stage':'discharged'})
        request('PATCH',f'/api/attentions/{attention["id"]}',422,{'stage':'unknown'})
        request('PATCH','/api/attentions/2147483647',404,{'stage':'triage'})
        for stage in ('triage','waiting','consultation','observation','discharged'):
            updated=request('PATCH',f'/api/attentions/{attention["id"]}',200,{'stage':stage})
            assert updated['stage']==stage
        resource=request('GET','/api/resources')[0]
        unchanged={k:resource[k] for k in ('doctors','triage_staff','observation_beds')}
        patched=request('PATCH',f'/api/resources/{resource["id"]}',200,unchanged)
        assert all(patched[k]==v for k,v in unchanged.items())
        request('PATCH','/api/resources/2147483647',404,unchanged)
        request('PATCH',f'/api/resources/{resource["id"]}',422,{**unchanged,'doctors':0})
        request('POST','/api/simulations/run',422,{'doctors':0})
        request('POST','/api/simulations/run',422,{'arrival_rates_per_hour':[0,0,0,0]})
        request('POST','/api/simulations/run',422,{'duration_minutes':10081})
        request('GET','/api/simulations/not-found',404)
        before_sim=counts()
        run=request('POST','/api/simulations/run',201,{'seed':42})
        replay=request('GET','/api/simulations/'+run['id'])
        assert replay==run and run['config']['rng_scheme']=='sha256-v1'
        assert all(k in run['metrics'] for k in ('mean_wait_minutes','mean_system_minutes','mean_queue_length','p95_wait_minutes','throughput_per_hour'))
        comp=request('POST','/api/simulations/compare',201,{'seed':42})
        assert [r['config']['doctors'] for r in comp['scenarios']]==[1,2,3,4]
        assert comp['scenarios'][1]['metrics']==run['metrics']
        request('GET','/api/simulations?limit=100')
        after_sim=counts()
        assert before_sim['patients']==after_sim['patients'] and before_sim['attentions']==after_sim['attentions']
        assert after_sim['simulation_runs']-before_sim['simulation_runs']==5
        for c in (1,2,3,4):
            theory=request('POST','/api/theory/mmc',200,{'arrival_per_hour':9,'service_mean_minutes':18,'servers':c})
            assert theory['stable']==(c>=3)
        request('POST','/api/theory/mmc',422,{'arrival_per_hour':0,'service_mean_minutes':18,'servers':3})
        request('GET','/api/patients?limit=0',422)
        before_telemetry=request('GET','/api/telemetry')
        assert before_telemetry['timestamp'] and before_telemetry['management']['synthetic']
        assert all(s['source']=='simulation' and s['simulation_id'] for s in before_telemetry['simulations'])
        assert before_telemetry['technical']['max_concurrent_simulations']==2

    # Real PostgreSQL lock holds the two real HTTP jobs at persistence, after DES.
    # No engine replacement and no fabricated HTTP payloads.
    with engine.connect() as blocker:
        transaction=blocker.begin()
        blocker.execute(text("LOCK TABLE simulation_runs IN SHARE MODE"))
        def concurrent(index):
            start=time.perf_counter()
            res=httpx.post(BASE+'/api/simulations/run',json={'seed':42+index},timeout=90)
            return dict(index=index,status=res.status_code,retry_after=res.headers.get('retry-after'),
                elapsed_seconds=time.perf_counter()-start,run_id=res.json().get('id'))
        with ThreadPoolExecutor(max_workers=2) as pool:
            pending=[pool.submit(concurrent,index) for index in (0,1)]
            try:
                deadline=time.monotonic()+30
                while time.monotonic()<deadline:
                    occupied=httpx.get(BASE+'/api/telemetry',timeout=10).json()['technical']['active_simulations']
                    if occupied==2: break
                    time.sleep(.05)
                assert occupied==2, 'No se observaron ambas plazas ocupadas'
                third=httpx.post(BASE+'/api/simulations/run',json={'seed':44},timeout=10)
                assert third.status_code==429 and third.headers.get('retry-after')=='2'
                concurrent_results=[dict(index=2,status=third.status_code,retry_after=third.headers.get('retry-after'),active_at_rejection=occupied)]
            finally:
                transaction.rollback()
            concurrent_results.extend(f.result() for f in pending)
    assert sorted(r['status'] for r in concurrent_results)==[201,201,429]
    # A genuine database failure (read-only transaction) must release admission too.
    from app.main import simulate
    from app.services import capacity as local_capacity
    from app.simulation.domain import SimulationConfig
    from sqlalchemy.orm import Session
    from sqlalchemy.exc import DBAPIError
    with engine.connect() as conn:
        trans=conn.begin()
        conn.execute(text('SET TRANSACTION READ ONLY'))
        with Session(bind=conn,join_transaction_mode='create_savepoint') as db:
            try:
                simulate(SimulationConfig(seed=42),db)
                raise AssertionError('La transacción de solo lectura debía rechazar INSERT')
            except DBAPIError as error:
                error_sqlstate=getattr(error.orig,'sqlstate',None)
                assert error_sqlstate=='25006'
                assert local_capacity.snapshot()['active_simulations']==0
        trans.rollback()
    with local_capacity.slot():
        assert local_capacity.snapshot()['active_simulations']==1
    telemetry=httpx.get(BASE+'/api/telemetry',timeout=30).json()
    assert telemetry['technical']['active_simulations']==0
    assert httpx.post(BASE+'/api/simulations/run',json={'duration_minutes':60},timeout=60).status_code==201
    report=dict(timestamp=datetime.now(timezone.utc).isoformat(),python=platform.python_version(),postgres=pg,
        dependencies={p:version(p) for p in ('fastapi','SQLAlchemy','psycopg','simpy','pydantic','pytest')},
        health=health,docs_http=200,frontend_http=200,tables=tables,migration=migration,
        seed_counts=[before_seed,after_once,after_twice],seed_idempotent=True,
        before_simulation=before_sim,after_simulation=after_sim,management_isolated=True,
        persisted_run=run['id'],operations=operations,openapi_operations=sum(len(v) for v in schema['paths'].values()),
        telemetry=telemetry,concurrency=concurrent_results,slot_reused_after_probe=True,error_release=dict(sqlstate=error_sqlstate,active_after_error=0,slot_reused=True,method='Ruta simulate, motor real y PostgreSQL READ ONLY; sin mocks'))
    (OUT/'api_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ('operations','telemetry')},ensure_ascii=False,indent=2))
    print(f'{len(operations)} solicitudes secuenciales auditadas; 3 solicitudes C6 coordinadas; sin mocks HTTP.',flush=True)


if __name__=='__main__':
    main()
