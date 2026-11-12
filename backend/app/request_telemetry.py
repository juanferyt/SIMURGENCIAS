"""Per-process HTTP measurements, separate from synthetic patient times."""
import csv
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

import psutil

_lock = threading.Lock()
_log = logging.getLogger(__name__)


def record_request(method, path, status, duration_seconds):
    # No bodies, query strings, patient names or credentials enter the CSV.
    process = psutil.Process()
    try:
        target = Path(os.getenv("TELEMETRY_LOG_PATH", "datos/telemetry_log.csv"))
        cpu = process.cpu_times()
        row = dict(timestamp=datetime.now(timezone.utc).isoformat(), pid=os.getpid(),
                   method=method, path=path, status=status,
                   latency_ms=1000*duration_seconds,
                   process_rss_mib=process.memory_info().rss/1024**2,
                   process_cpu_seconds=cpu.user+cpu.system)
        with _lock:
            target.parent.mkdir(parents=True, exist_ok=True)
            header = not target.exists() or target.stat().st_size == 0
            with target.open('a', newline='', encoding='utf-8') as stream:
                writer = csv.DictWriter(stream, fieldnames=list(row))
                if header:
                    writer.writeheader()
                writer.writerow(row)
    except (OSError, psutil.Error):
        # Observation failures must not turn a successful business request into 500.
        _log.exception("No se pudo registrar telemetría HTTP")
