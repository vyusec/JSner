#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
echo "Load unpacked extension:"
echo "  1. Open chrome://extensions"
echo "  2. Enable Developer mode"
echo "  3. Click 'Load unpacked'"
echo "  4. Select: $(pwd)"
echo
echo "Then run: pscon bridge serve"
echo "Copy the printed token into the JSner popup and click CONNECT."
