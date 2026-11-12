"""Run reproducible experiments without an API or database connection."""
import argparse
import json
from pathlib import Path
from .simulation.domain import SimulationConfig
from .simulation.engine import EmergencyDepartment


def main():
    parser = argparse.ArgumentParser(description="SIMURGENCIAS · experimento sintético")
    parser.add_argument("--doctors", type=int, default=2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--minutes", type=float, default=1440)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = EmergencyDepartment(SimulationConfig(doctors=args.doctors, seed=args.seed, duration_minutes=args.minutes)).run()
    if args.output:
        args.output.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    print(json.dumps(result.metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
