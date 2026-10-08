#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq caddy curl xz-utils sqlite3
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') -lt 24 ]]; then
  temporary=$(mktemp -d)
  curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$temporary/SHASUMS256.txt"
  filename=$(awk '$2 ~ /linux-x64.tar.xz$/ {print $2}' "$temporary/SHASUMS256.txt")
  test -n "$filename"
  curl -fsSL "https://nodejs.org/dist/latest-v24.x/$filename" -o "$temporary/$filename"
  (cd "$temporary" && grep " $filename$" SHASUMS256.txt | sha256sum -c -)
  tar -xJf "$temporary/$filename" -C /usr/local --strip-components=1
fi
id case-battel >/dev/null 2>&1 || useradd --system --home /var/lib/case-battel --shell /usr/sbin/nologin case-battel
id case-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash case-deploy
install -d -o case-deploy -g case-deploy -m 755 /opt/case-battel/releases
install -d -o case-battel -g case-battel -m 700 /var/lib/case-battel /var/backups/case-battel
install -d -o root -g case-battel -m 750 /etc/case-battel
node --version
caddy version
