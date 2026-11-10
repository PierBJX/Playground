#!/bin/sh
# Empaquette les libs d'un scénario, puis installe, lance et bundle chacune de ses apps
# (app, et app-with-lodash côté peers).
# Usage : ./run.sh deps | ./run.sh peers | ./run.sh (les deux)
set -e
cd "$(dirname "$0")"

for scenario in ${@:-deps peers}; do
  (cd "$scenario/lib1" && pnpm pack --pack-destination .. >/dev/null)
  (cd "$scenario/lib2" && pnpm pack --pack-destination .. >/dev/null)
  for app in "$scenario"/app*; do
    [ -d "$app" ] || continue
    echo "\n══════════ $app ══════════"
    (
      cd "$app"
      pnpm install
      pnpm peers check || echo "→ pnpm peers check a trouvé des problèmes (code $?)"
      pnpm --silent start || echo "→ pnpm start a échoué (code $?)"
      pnpm --silent build || echo "→ pnpm build a échoué (code $?)"
    )
  done
done
