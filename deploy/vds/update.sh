#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin"
state=/var/lib/case-battel-deploy
exec 9>"$state/update.lock"
flock -n 9 || exit 0
source="$state/source"
if [[ ! -d "$source/.git" ]]; then
  git clone --depth 1 --branch main https://github.com/veylcode/Case-Battel.git "$source"
fi
cd "$source"
git fetch --depth 1 origin main
revision=$(git rev-parse FETCH_HEAD)
if [[ -f "$state/deployed-revision" ]] && [[ $(cat "$state/deployed-revision") == "$revision" ]]; then
  exit 0
fi
git reset --hard "$revision"
npm ci --no-audit --no-fund
node node_modules/typescript/bin/tsc --noEmit
npm run build:vds
release="$(date -u +%Y%m%d%H%M%S)-${revision:0:8}"
directory="/opt/case-battel/releases/$release"
mkdir "$directory"
cp -a dist-vds/. "$directory/"
printf '%s\n' "$revision" > "$directory/revision.txt"
chmod -R a+rX "$directory"
sudo /usr/local/sbin/case-battel-activate "$release"
printf '%s\n' "$revision" > "$state/deployed-revision.next"
mv "$state/deployed-revision.next" "$state/deployed-revision"
