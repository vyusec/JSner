#!/usr/bin/env python3
"""Upload new assets; verify matching checksums when retrying an existing asset."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
import tempfile

tag, *filenames = sys.argv[1:]
release = json.loads(subprocess.check_output(['gh', 'release', 'view', tag, '--json', 'assets'], text=True))
assets = {a['name']: a for a in release['assets']}
for filename in filenames:
    path = Path(filename)
    if path.name in assets:
        with tempfile.TemporaryDirectory() as temporary:
            subprocess.run(['gh', 'release', 'download', tag, '--pattern', path.name, '--dir', temporary], check=True)
            remote = Path(temporary) / path.name
            if hashlib.sha256(remote.read_bytes()).digest() != hashlib.sha256(path.read_bytes()).digest():
                raise SystemExit('Refusing to overwrite a different release asset: ' + path.name)
        print('Verified existing asset:', path.name)
    else:
        subprocess.run(['gh', 'release', 'upload', tag, str(path)], check=True)
