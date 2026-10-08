#!/usr/bin/env bash
set -euo pipefail
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
cat > "$archive"
release="$(date -u +%Y%m%d%H%M%S)-$(sha256sum "$archive" | cut -c1-8)"
directory="/opt/case-battel/releases/$release"
mkdir "$directory"
python3 - "$archive" "$directory" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    archive.extractall(sys.argv[2], filter='data')
PY
chmod -R a+rX "$directory"
sudo /usr/local/sbin/case-battel-activate "$release"
