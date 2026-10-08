#!/usr/bin/env bash
set -euo pipefail
release=${1:?Release identifier required}
[[ "$release" =~ ^[0-9]{14}-[a-f0-9]{8}$ ]]
directory="/opt/case-battel/releases/$release"
test -f "$directory/server.mjs"
test -f "$directory/client/index.html"
test ! -L "$directory"
previous=$(readlink -f /opt/case-battel/current || true)
if [[ -f /var/lib/case-battel/game.sqlite ]]; then systemctl start case-battel-backup.service; fi
ln -sfn "$directory" /opt/case-battel/current.next
mv -Tf /opt/case-battel/current.next /opt/case-battel/current
systemctl restart case-battel.service
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:3000/healthz >/dev/null; then
    printf 'Deployed release %s\n' "$release"
    exit 0
  fi
  sleep 1
done
if [[ -n "$previous" && "$previous" == /opt/case-battel/releases/* ]]; then
  ln -sfn "$previous" /opt/case-battel/current.next
  mv -Tf /opt/case-battel/current.next /opt/case-battel/current
  systemctl restart case-battel.service
fi
exit 1
