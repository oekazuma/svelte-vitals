#!/usr/bin/env bash
# One holdout app: clone at its pin, install with its own package manager, measure the installed
# checkout with the packed CLI (the first look), wrap its vite config with the packed plugin, run its
# build script, and record what the plugin did.
set -uo pipefail
: "${REPO:?}" "${APP_PATH:?}" "${SHA:?}" "${PLUGIN_DIR:?}" "${OUT:?}" "${MEASURE:?}"
# The clone sits where corpus-measure.js looks for it (`<cache>/<owner>__<repo>`), so its `run`
# measures this installed checkout instead of fetching a fresh one.
cache="$RUNNER_TEMP/cache"
mkdir -p "$OUT"; log="$OUT/build.log"; work="$cache/${REPO//\//__}"
fl_exit=""
result() { # stage status
  node -e 'const [app,stage,status,exit,fl]=process.argv.slice(1);const fs=require("fs");const log=fs.existsSync(process.env.OUT+"/build.log")?fs.readFileSync(process.env.OUT+"/build.log","utf8"):"";const m=log.match(/Analyzed \d+ prerendered route\(s\)[^\n]*|no prerendered pages found[^\n]*/);fs.writeFileSync(process.env.OUT+"/result.json",JSON.stringify({app,stage,status,exit:Number(exit),firstLookExit:fl===""?null:Number(fl),gate:/svelte-vitals: build failed — findings at or above/.test(log),pluginLine:m?m[0]:null,report:fs.existsSync(process.env.REPORT||"")},null,1))' "$REPO:$APP_PATH" "$1" "$2" "${3:-0}" "$fl_exit"
}
# Runs before the build, which rewrites the vite config and adds files the source pass would read.
# An app whose install fails is still measured, uninstalled, and says so.
first_look() {
  echo "{\"installed\":$([ "$1" = installed ] && echo true || echo false)}" >"$OUT/first-look-state.json"
  node -e 'console.log(JSON.stringify([{repo:process.env.REPO,path:process.env.APP_PATH,sha:process.env.SHA}]))' >"$RUNNER_TEMP/target.json"
  node "$MEASURE" run --cli "$PLUGIN_DIR/node_modules/svelte-vitals/dist/bin.js" --cache "$cache" \
    --targets "$RUNNER_TEMP/target.json" --out "$OUT/first-look.json" >>"$log" 2>&1
  fl_exit=$?
  echo "first look ($1) exit $fl_exit" >>"$log"
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
  # pnpm 11+ fails an install whose dependencies have build scripts nobody approved (ERR_PNPM_IGNORED_BUILDS);
  # `--ignore-scripts` installs the same packages and does not fail, though a build needing those scripts may.
  # Only for that failure: a script failing for any other reason must still fail the install. The failed
  # install's node_modules remember the ignored builds and fail the retry too, so they go first.
  pnpm-lock.yaml) corepack enable >>"$log" 2>&1; pnpm install --frozen-lockfile >>"$log" 2>&1 || pnpm install --no-frozen-lockfile >>"$log" 2>&1 ||
    { grep -q ERR_PNPM_IGNORED_BUILDS "$log" && echo "retrying with --ignore-scripts" >>"$log" &&
      find . -name node_modules -type d -prune -exec rm -rf {} + &&
      pnpm install --no-frozen-lockfile --ignore-scripts >>"$log" 2>&1; } ;;
  bun.lock|bun.lockb) bun install --frozen-lockfile >>"$log" 2>&1 || bun install >>"$log" 2>&1 ;;
  # npm reports a failing install script (the app's own postinstall, a native build) as "command failed";
  # the retry installs the same packages without scripts. `npm ci` clears node_modules itself.
  package-lock.json) npm ci >>"$log" 2>&1 ||
    { grep -q "npm error command failed" "$log" && echo "retrying with --ignore-scripts" >>"$log" &&
      npm ci --ignore-scripts >>"$log" 2>&1; } ;;
  yarn.lock) corepack enable >>"$log" 2>&1; yarn install --immutable >>"$log" 2>&1 || yarn install --frozen-lockfile >>"$log" 2>&1 ;;
  *) npm install >>"$log" 2>&1 ;;
esac || { code=$?; first_look uninstalled; result install failed $code; exit 0; }
cd "$app" || exit 1
# A `link:`/`file:` dependency outside the installed workspace keeps its own dependencies, which
# the install above never reaches.
node -e 'const p=require("./package.json");for(const d of Object.values({...p.dependencies,...p.devDependencies}))if(/^(link|file):/.test(d))console.log(d.replace(/^(link|file):/,""))' |
  while read -r dep; do
    [ -f "$dep/package.json" ] && [ ! -d "$dep/node_modules" ] || continue
    echo "installing linked package $dep" >>"$log"
    (cd "$dep" && case "$lock" in
      pnpm-lock.yaml) pnpm install --ignore-workspace >>"$log" 2>&1 ;;
      bun.lock|bun.lockb) bun install >>"$log" 2>&1 ;;
      *) npm install --no-audit --no-fund >>"$log" 2>&1 ;;
    esac) || echo "linked package $dep failed to install" >>"$log"
  done
first_look installed
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
