"""Execute all code cells with the backend importable; no Jupyter required."""
import json
import os
from pathlib import Path
import sys
import nbformat

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
os.environ.setdefault("MPLBACKEND", "Agg")
notebook = json.loads((root / "notebooks/SIMURGENCIAS_Entrega_1.ipynb").read_text(encoding="utf-8"))
nbformat.validate(notebook)
namespace = {"__name__": "__notebook__"}
count = 0
for cell in notebook["cells"]:
    if cell["cell_type"] == "code":
        count += 1
        exec(compile("".join(cell["source"]), f"cell_{count}", "exec"), namespace)
assert count == 12
print("OK: 12 celdas ejecutadas, reproducibilidad y Little verificados.")
