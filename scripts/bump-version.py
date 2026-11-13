#!/usr/bin/env python3
"""Bump stable versions and changelog together; Git commits/tags belong to CI."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import tomllib

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('bump', choices=['patch', 'minor', 'major'])
parser.add_argument('--dry-run', action='store_true')
parser.add_argument('--notes-file', type=Path)
args = parser.parse_args()
subprocess.run(['python3', str(root / 'scripts/check-release.py')], check=True, stdout=subprocess.DEVNULL)
rust = (root / 'Cargo.toml').is_file()
if rust:
    package = tomllib.loads((root / 'Cargo.toml').read_text())['package']
    old = package['version']
else:
    manifest = json.loads((root / 'manifest.json').read_text())
    old = manifest['version']
parts = list(map(int, old.split('.')))
index = {'major': 0, 'minor': 1, 'patch': 2}[args.bump]
parts[index] += 1
for i in range(index + 1, 3):
    parts[i] = 0
version = '.'.join(map(str, parts))
if not rust and any(part > 65535 for part in parts):
    raise SystemExit('Chrome version components cannot exceed 65535')
if args.dry_run:
    print(version)
    raise SystemExit(0)
if args.notes_file is None:
    raise SystemExit('--notes-file is required when writing a release')
notes = args.notes_file.read_text().strip()
if not notes:
    raise SystemExit('Release notes must not be empty')
if rust:
    path = root / 'Cargo.toml'
    text = path.read_text()
    text, count = re.subn(r'(?m)^version = "' + re.escape(old) + r'"$', f'version = "{version}"', text, count=1)
    if count != 1:
        raise SystemExit('Cannot locate package version in Cargo.toml')
    lock = root / 'Cargo.lock'
    locked, count = re.subn(r'(\[\[package\]\]\nname = "' + re.escape(package['name']) + r'"\nversion = ")' + re.escape(old) + r'"', lambda m: m[1] + version + '"', lock.read_text())
    if count != 1:
        raise SystemExit('Cannot locate package version in Cargo.lock')
    path.write_text(text)
    lock.write_text(locked)
else:
    manifest['version'] = version
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (root / 'version.txt').write_text(version + '\n')
changelog = root / 'CHANGELOG.md'
text = changelog.read_text()
heading = '# Changelog\n'
if not text.startswith(heading):
    raise SystemExit('CHANGELOG.md must begin with # Changelog')
date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
changelog.write_text(heading + f'\n## {version} ({date})\n\n{notes}\n\n' + text[len(heading):].lstrip())
subprocess.run(['python3', str(root / 'scripts/check-release.py')], check=True, stdout=subprocess.DEVNULL)
print(version)
