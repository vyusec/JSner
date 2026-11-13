# Extension versioning and releases

Each release has a version commit, `vMAJOR.MINOR.PATCH` Git tag, GitHub release,
reproducible ZIP, SHA-256 checksum, and `release.json` recording its source commit
and archive digest. Chrome Web Store submission is a separate final step.

## Release a version

1. Merge and review changes on `main`.
2. Open Actions → **Run release** → **Run workflow**, choose `main`, and select
   `patch` for fixes, `minor` for features, or `major` for breaking changes.
3. CI runs, then the workflow updates `version.txt`, `manifest.json`, and
   `CHANGELOG.md` together. Release notes are generated from Git history. The
   popup and connector display the version from the manifest.
4. The version commit and annotated Git tag are pushed atomically, then CI runs
   on that exact tag. The publisher uploads `JSner-<version>.zip`, its checksum,
   and revision metadata to GitHub Releases.
5. Upload that exact ZIP in the Chrome Web Store Developer Dashboard and submit
   it for review. Store copies update after approval/publication. An unpacked
   development copy requires a manual reload.

For example, the next patch after `3.0.1` is `3.0.2`:

```bash
gh workflow run release.yml --repo vyusec/JSner --ref main -f bump=patch
```

The release button is the publication decision. Ordinary source pushes run CI
and do not increment the version or publish a store update. The built-in GitHub
token handles commits and releases without requiring bot pull-request permissions.
The publisher is called directly rather than relying on bot-created tag events.

## Checks and retries

CI checks version consistency, runtime assets, JavaScript/shell syntax, ZIP
contents, and the unpacked extension in Chromium. It checks linked-source scans,
results, theme controls, and narrow popup layouts. The extension builds without
the CLI checkout. All third-party Actions are pinned to verified commit SHAs.

If publication fails after the tag exists, use Actions → **Publish JSner package**
→ **Run workflow** from `main` and enter the existing tag, or:

```bash
gh workflow run publish.yml --repo vyusec/JSner --ref main -f tag=v3.0.2
```

Existing assets must match their checksums and are never silently overwritten.
If code needs changing, create a new version instead of moving the tag. If main
changes while release preparation is running, the workflow stops safely.

For local checks:

```bash
python3 scripts/check-release.py
./scripts/package.sh
python3 -m venv /tmp/jsner-tests
/tmp/jsner-tests/bin/pip install -r requirements-dev.txt
/tmp/jsner-tests/bin/python -m playwright install chromium
/tmp/jsner-tests/bin/python tests/ui_smoke.py
```

## Optional store automation

The [Chrome Web Store API](https://developer.chrome.com/docs/webstore/using-api)
can upload and submit updates to an existing listing using the publisher's Google
credentials. Those credentials and publisher access are not configured here.
The pipeline supplies a tested, versioned ZIP for manual upload. Store review
still applies, including to API submissions. Preserve the existing extension ID.
