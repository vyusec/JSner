#!/usr/bin/env python3
"""Check all version sources; optionally require a matching stable release tag."""
import argparse
import json
from pathlib import Path
import re
import tomllib

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--tag')
args = parser.parse_args()
if (root / 'Cargo.toml').exists():
    package = tomllib.loads((root / 'Cargo.toml').read_text())['package']
    version = package['version']
    locked = [p['version'] for p in tomllib.loads((root / 'Cargo.lock').read_text())['package'] if p['name'] == package['name'] and 'source' not in p]
    if locked != [version]:
        raise SystemExit('Cargo.lock and Cargo.toml package versions differ')
else:
    manifest = json.loads((root / 'manifest.json').read_text())
    version = manifest['version']
    if (root / 'version.txt').read_text().strip() != version:
        raise SystemExit('version.txt and manifest.json versions differ')
    references = [manifest['background']['service_worker'], manifest['action']['default_popup']]
    references.extend(manifest['action']['default_icon'].values())
    for item in manifest.get('content_scripts', []):
        references.extend(item.get('js', []))
        references.extend(item.get('css', []))
    for item in manifest.get('web_accessible_resources', []):
        references.extend(item['resources'])
    for name in references:
        if not (root / name).is_file():
            raise SystemExit('Missing runtime asset: ' + name)
if not re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', version):
    raise SystemExit('Stable numeric major.minor.patch version required')
if not re.search(r'^## (?:v)?' + re.escape(version) + r'(?:\s|$)', (root / 'CHANGELOG.md').read_text(), re.M):
    raise SystemExit('Current version has no CHANGELOG.md entry')
if (root / 'manifest.json').is_file() and any(int(part) > 65535 for part in version.split('.')):
    raise SystemExit('Chrome version components cannot exceed 65535')
if args.tag and args.tag != 'v' + version:
    raise SystemExit(f'Release tag {args.tag!r} must equal v{version}')
print(version)
