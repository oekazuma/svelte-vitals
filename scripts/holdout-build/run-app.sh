#!/usr/bin/env bash
# One holdout app: clone at its pin, install with its own package manager, wrap its vite config
# with the packed plugin, run its build script, and record what the plugin did.
set -uo pipefail
: "${REPO:?}" "${APP_PATH:?}" "${SHA:?}" "${PLUGIN_DIR:?}" "${OUT:?}"
mkdir -p "$OUT"; log="$OUT/build.log"; work="$RUNNER_TEMP/app"
result() { # stage status
  node -e 'const [app,stage,status,exit]=process.argv.slice(1);const fs=require("fs");const log=fs.existsSync(process.env.OUT+"/build.log")?fs.readFileSync(process.env.OUT+"/build.log","utf8"):"";const m=log.match(/Analyzed \d+ prerendered route\(s\)[^\n]*|no prerendered pages found[^\n]*/);fs.writeFileSync(process.env.OUT+"/result.json",JSON.stringify({app,stage,status,exit:Number(exit),gate:/svelte-vitals: build failed — findings at or above/.test(log),pluginLine:m?m[0]:null,report:fs.existsSync(process.env.REPORT||"")},null,1))' "$REPO:$APP_PATH" "$1" "$2" "${3:-0}"
}
mkdir -p "$work" && cd "$work" || exit 1
{ git init -q . && git remote add origin "https://github.com/$REPO.git" && git fetch -q --depth 1 origin "$SHA" && git checkout -q FETCH_HEAD; } >>"$log" 2>&1 || { result clone failed; exit 0; }
app="$work/$APP_PATH"; app="${app%/.}"
dir="$app"; root=""; lock=""
while :; do
  for f in pnpm-lock.yaml bun.lock bun.lockb package-lock.json yarn.lock; do
    if [ -f "$dir/$f" ]; then root="$dir"; lock="$f"; break 2; fi
  done
  [ "$dir" = "$work" ] && break; dir="$(dirname "$dir")"
done
echo "lockfile: ${lock:-none} at ${root:-none}" >>"$log"
cd "${root:-$app}" || exit 1
case "$lock" in
  pnpm-lock.yaml) corepack enable >>"$log" 2>&1; pnpm install --frozen-lockfile >>"$log" 2>&1 || pnpm install --no-frozen-lockfile >>"$log" 2>&1 ;;
  bun.lock|bun.lockb) bun install --frozen-lockfile >>"$log" 2>&1 || bun install >>"$log" 2>&1 ;;
  package-lock.json) npm ci >>"$log" 2>&1 ;;
  yarn.lock) corepack enable >>"$log" 2>&1; yarn install --immutable >>"$log" 2>&1 || yarn install --frozen-lockfile >>"$log" 2>&1 ;;
  *) npm install >>"$log" 2>&1 ;;
esac || { result install failed $?; exit 0; }
cd "$app" || exit 1
cfg=""; for e in ts mts js mjs; do [ -f "vite.config.$e" ] && cfg="vite.config.$e" && break; done
[ -n "$cfg" ] || { echo "no vite.config" >>"$log"; result wrap failed; exit 0; }
ext="${cfg##*.}"; mv "$cfg" "vite.config.orig.$ext"
cat >"$cfg" <<CFG
import * as orig from './vite.config.orig';
import { mergeConfig } from 'vite';
import { svelteVitals } from '@svelte-vitals/vite';
export default async (env) => {
  const base = typeof orig.default === 'function' ? await orig.default(env) : await orig.default;
  return mergeConfig(base, { plugins: [svelteVitals({ outFile: 'svelte-vitals-report.json' })] });
};
CFG
# Node resolves through the symlink's real path, so the plugin's own deps come from PLUGIN_DIR.
mkdir -p node_modules/@svelte-vitals && ln -sfn "$PLUGIN_DIR/node_modules/@svelte-vitals/vite" node_modules/@svelte-vitals/vite
export REPORT="$app/svelte-vitals-report.json"
if node -e 'process.exit(require("./package.json").scripts?.build ? 0 : 1)'; then
  case "$lock" in bun.lock|bun.lockb) runner="bun run" ;; pnpm-lock.yaml) runner="pnpm run" ;; yarn.lock) runner="yarn run" ;; *) runner="npm run" ;; esac
  timeout 1200 $runner build >>"$log" 2>&1
else
  timeout 1200 npx vite build >>"$log" 2>&1
fi
code=$?
[ -f "$REPORT" ] && cp "$REPORT" "$OUT/report.json"
result build "$([ $code = 0 ] && echo ok || echo failed)" "$code"
exit 0
