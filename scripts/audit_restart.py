"""Observe actual persistence and per-process counters across an explicit restart."""
import json
import os
import sys
from pathlib import Path
import httpx
from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
from app.database import engine

out = ROOT / 'docs/results/restart_validation.json'
base = os.getenv('API_URL', 'http://localhost:8000')
telemetry = httpx.get(base + '/api/telemetry', timeout=30).json()
with engine.connect() as connection:
    counts = {name: connection.execute(text(f'SELECT count(*) FROM {name}')).scalar_one()
              for name in ('patients', 'attentions', 'simulation_runs', 'telemetry')}
state = dict(counts=counts, technical=telemetry['technical'])
if sys.argv[1] == 'before':
    run = httpx.get(base + '/api/simulations', timeout=30).json()[0]
    saved = httpx.get(base + '/api/simulations/' + run['id'], timeout=30).json()
    out.write_text(json.dumps(dict(before=state, run=saved), indent=2), encoding='utf-8')
    print('Snapshot anterior guardado', state)
else:
    report = json.loads(out.read_text(encoding='utf-8'))
    for name in ('patients', 'attentions', 'simulation_runs'):
        assert counts[name] == report['before']['counts'][name]
    assert counts['telemetry'] >= report['before']['counts']['telemetry']
    saved = httpx.get(base + '/api/simulations/' + report['run']['id'], timeout=30).json()
    assert saved == report['run']
    assert all(telemetry['technical'][key] == 0 for key in ('active_simulations', 'completed_simulations', 'rejected_simulations'))
    report.update(after=state, persisted_run_equal=True, memory_counters_reset=True)
    out.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print('Persistencia y reinicio de contadores verificados', state)
