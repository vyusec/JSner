#!/usr/bin/env python3
"""Build a reproducible extension ZIP, SHA-256 checksum, and revision metadata."""
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
subprocess.run(['python3', str(root / 'scripts/check-release.py')], check=True)
manifest = json.loads((root / 'manifest.json').read_text())
files = {
    'manifest.json', 'background.js', 'content-scanner.js',
    'popup.html', 'popup.js', 'popup.css',
    'results.html', 'results.js', 'results.css',
    'theme.js', 'theme.css', 'LICENSE', 'PRIVACY.md',
}
files.update(str(path.relative_to(root)) for path in (root / 'icons').rglob('*') if path.is_file())
class References(HTMLParser):
    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        reference = data.get('src') if tag in {'script', 'img'} else data.get('href') if tag == 'link' else None
        if reference and reference not in files:
            raise SystemExit('Missing packaged HTML asset: ' + reference)
for name in files:
    path = root / name
    if not path.is_file():
        raise SystemExit('Missing extension file: ' + name)
    if name.endswith('.html'):
        References().feed(path.read_text())
dist = root / 'dist'
dist.mkdir(exist_ok=True)
archive = dist / f"JSner-{manifest['version']}.zip"
with ZipFile(archive, 'w', compression=ZIP_DEFLATED, compresslevel=9) as package:
    for name in sorted(files):
        entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
        entry.create_system = 3
        entry.external_attr = 0o100644 << 16
        entry.compress_type = ZIP_DEFLATED
        package.writestr(entry, (root / name).read_bytes())
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(archive.with_suffix('.zip.sha256')).write_text(f'{checksum}  {archive.name}\n')
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
(dist / 'release.json').write_text(json.dumps({'version': manifest['version'], 'commit': commit, 'archive': archive.name, 'sha256': checksum}, indent=2) + '\n')
print('package:', archive)
