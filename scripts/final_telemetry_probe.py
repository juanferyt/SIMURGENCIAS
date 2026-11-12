"""Measure actual HTTP requests. Does not calibrate synthetic patient services."""
import argparse
import json
import platform
import time
from pathlib import Path
from statistics import mean
from urllib.request import Request, urlopen


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base-url',default='http://localhost:8000')
    parser.add_argument('--execution-scope',choices=['local-asgi-no-db','docker-user-run'],required=True)
    parser.add_argument('--requests',type=int,default=100)
    args=parser.parse_args()
    rows=[]
    client=None
    if args.execution_scope=='local-asgi-no-db':
        import os
        import sys
        root=Path(__file__).resolve().parents[1]
        sys.path.insert(0,str(root/'backend'))
        os.environ['TELEMETRY_LOG_PATH']=str(root/'datos/telemetry_log.csv')
        from fastapi.testclient import TestClient
        from app.main import app
        # No context manager: lifespan/DB connection not invoked. Actual ASGI
        # middleware and theory route execute, without a TCP or container claim.
        client=TestClient(app)
    for i in range(args.requests):
        body=json.dumps(dict(arrival_per_hour=9,service_mean_minutes=18,servers=3+i%2)).encode()
        req=Request(args.base_url+'/api/theory/mmc',data=body,headers={'Content-Type':'application/json'})
        started=time.perf_counter()
        if client is not None:
            response=client.post('/api/theory/mmc',json=json.loads(body))
            result=response.json()
            status=response.status_code
        else:
            with urlopen(req,timeout=30) as response:
                result=json.load(response)
                status=response.status
        assert result['stable'] and status==200
        rows.append(dict(index=i,status=status,wall_latency_ms=1000*(time.perf_counter()-started)))
    values=sorted(r['wall_latency_ms'] for r in rows)
    def quantile(p):
        idx=(len(values)-1)*p;i=int(idx)
        return values[i]+(idx-i)*(values[min(i+1,len(values)-1)]-values[i])
    out=Path(__file__).resolve().parents[1]/'docs/final_results'
    out.mkdir(parents=True,exist_ok=True)
    summary=dict(scope=args.execution_scope,endpoint='/api/theory/mmc',requests=len(rows),
        request_mode='sequential; no concurrency or maximum throughput claim',
        mean_ms=mean(values),p95_ms=quantile(.95),p99_ms=quantile(.99),
        python=platform.python_version(),client_rows=rows,
        note='Local ASGI probe skips lifespan/DB and TCP; Docker/persistence not verified by this probe.')
    (out/'http_probe.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k!='client_rows'},indent=2))


if __name__=='__main__':
    main()
