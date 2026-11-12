#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 - <<'PYTHON'
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path.cwd()
manifest = json.loads((root / "manifest.json").read_text())
files = [
    "manifest.json", "background.js", "content-scanner.js",
    "popup.html", "popup.js", "popup.css",
    "results.html", "results.js", "results.css",
    "theme.js", "theme.css", "LICENSE", "PRIVACY.md",
]
files.extend(str(path.relative_to(root)) for path in sorted((root / "icons").rglob("*")) if path.is_file())
missing = [name for name in files if not (root / name).is_file()]
if missing:
    raise SystemExit("Missing extension files: " + ", ".join(missing))
for name in manifest["action"]["default_icon"].values():
    if name not in files:
        raise SystemExit("Missing extension icon: " + name)

dist = root / "dist"
dist.mkdir(exist_ok=True)
archive = dist / f"JSner-{manifest['version']}.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED) as package:
    for name in files:
        package.write(root / name, name)
print(f"package: {archive}")
PYTHON
