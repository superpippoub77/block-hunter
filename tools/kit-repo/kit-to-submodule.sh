#!/usr/bin/env bash
# Sposta kit/ (motore SpikeCode) nel suo repository e lo ricollega a questo gioco come git submodule.
#
#   1. crea su GitHub il repository VUOTO superpippoub77/spike-game-kit (privato, senza README)
#   2. dalla cartella del gioco, con tutto già committato:
#        bash tools/kit-repo/kit-to-submodule.sh [url-del-repo]
#   3. git push
#
# La storia di kit/ viene conservata nel nuovo repository (git subtree split).
set -euo pipefail

URL="${1:-https://github.com/superpippoub77/spike-game-kit.git}"
BRANCH="${KIT_BRANCH:-main}"
cd "$(git rev-parse --show-toplevel)"

if [ -f .gitmodules ] && grep -q 'path = kit' .gitmodules; then
  echo "kit/ è già un submodule."; exit 0
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Ci sono modifiche non committate: fai prima commit (o stash)."; exit 1
fi

echo "== 1/4 estraggo la storia di kit/"
git subtree split --prefix=kit -b spike-game-kit-split

echo "== 2/4 pubblico il motore su $URL ($BRANCH)"
git push "$URL" "spike-game-kit-split:$BRANCH"

echo "== 3/4 tolgo la copia di kit/ dal gioco"
git rm -r -q kit
git commit -q -m "kit/ moves to its own repository (spike-game-kit)"

echo "== 4/4 aggiungo il submodule"
git submodule add -b "$BRANCH" "$URL" kit
git commit -q -m "Add the SpikeCode engine (spike-game-kit) as submodule in kit/"
git branch -D spike-game-kit-split >/dev/null

echo
echo "Fatto. Ora: git push"
echo "Chi clona il gioco:      git clone --recursive <url>   (oppure git submodule update --init)"
echo "Aggiornare il motore:    git submodule update --remote kit && git commit -am 'Update engine'"
