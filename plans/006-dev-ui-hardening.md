# Plan 006: vite dev UI ミドルウェアを堅牢化する(loopback チェック + ingest 検証の完全化 + ダッシュボードのクラッシュ防止)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1f6f233..HEAD -- packages/vite/src/ui/middleware.ts packages/vite/src/hooks/handle.ts packages/vite/test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `1f6f233`, 2026-07-05

## Why this matters

dev サーバーにマウントされる `/__svelte-vitals` ミドルウェアに、防御の非対称と検証漏れが3点ある。(1) `POST /ingest` に Origin/Host チェックがない — **送信側**(`hooks/handle.ts` の `isLoopbackOrigin`)は loopback 以外への POST を拒否しているのに、**受信側**は誰からでも受け付ける。ブラウザの cross-site form POST は CORS preflight なしで届くため、開発者が開いた任意の Web ページが偽の所見をダッシュボードに注入できる(CSRF write)。(2) ingest の型ガード `isResultLike` は自身のコメントで「レンダラーが参照するフィールドを検証済み」と主張するが、実際には `category` / `location` / `recommendation` / `fix` を検証しておらず、これらに非文字列を入れたペイロードは `escapeHtml`(= `String.prototype.replace`)で throw する。(3) `GET /` のハンドラに try/catch がなく、(2) の throw でダッシュボードが 500 になる — 「malformed ingest can't crash it」というコメントの主張が守られていない。すべて dev 専用面だが、修正は S 工数で完結する。

## Current state

- `packages/vite/src/ui/middleware.ts` — 全 93 行。問題箇所:

```ts
// middleware.ts:14-28 — 現在の型ガード(category/location/recommendation/fix を見ていない)
function isResultLike(x: unknown): x is Result {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  const d = r.detection as Record<string, unknown> | undefined;
  return (
    typeof r.id === 'string' &&
    typeof r.message === 'string' &&
    typeof r.severity === 'string' &&
    SEVERITIES.has(r.severity) &&
    typeof d === 'object' &&
    d !== null &&
    typeof d.presence === 'string' &&
    typeof d.value === 'string'
  );
}
```

```ts
// middleware.ts:58-76 — POST /ingest: Origin/Host チェックなし、Content-Type 非依存で JSON.parse
// middleware.ts:90-91 — GET /: try/catch なし
res.setHeader('Content-Type', 'text/html');
res.end(renderDashboard(store.snapshot(), config, { version }));
```

- クラッシュ経路の根拠: `packages/core/src/reporter/json.ts:6-17` の `issueOf` は `category: result.category ?? 'seo'`(数値 `123` は `??` を素通り)、`location` / `recommendation` をそのまま転記。`packages/core/src/reporter/html.ts:69,73,74` の `renderFinding` は `escapeHtml(issue.category)` を無条件、`issue.location` / `issue.recommendation` を truthy チェックのみで `escapeHtml` に渡す。`escapeHtml`(html.ts:18-22)は `s.replace(...)` なので非文字列で TypeError。
- 送信側の既存防御(再利用する手本): `packages/vite/src/hooks/handle.ts:22-29`:

```ts
function isLoopbackOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}
```

- 既存テスト(手本): `packages/vite/test/ui-middleware.test.ts`(ミドルウェアの req/res モックパターン)、`packages/vite/test/ui-ingest.test.ts`(送信側)、`packages/vite/test/ui-serve.test.ts`。
- HTTP の前提知識(実装判断の根拠として計画に固定): ブラウザは cross-origin の form POST / fetch に `Origin` ヘッダーを付ける。同一オリジンの GET ナビゲーションには通常付けない。サーバーサイド fetch(送信側 `postIngest` は Node から同一オリジンへ POST)は `Origin` を付けない。したがって **「`Origin` ヘッダーが存在し、かつ loopback でない場合のみ拒否」** が正規のダッシュボード/送信側を壊さない判定になる。加えて `Host` ヘッダーの loopback 検証で DNS リバインディングを緩和する(`--host` で LAN 公開した場合に dev UI が 403 になるのは、送信側が既に同条件で ingest を止めている(handle.ts:34-43)ため一貫した挙動)。

## Commands you will need

| Purpose   | Command                                       | Expected on success |
| --------- | --------------------------------------------- | ------------------- |
| Install   | `pnpm install`                                | exit 0              |
| Build     | `pnpm --filter @svelte-vitals/vite build`     | exit 0              |
| Typecheck | `pnpm --filter @svelte-vitals/vite typecheck` | exit 0              |
| Tests     | `pnpm --filter @svelte-vitals/vite test`      | all pass            |
| Lint      | `pnpm lint`                                   | exit 0              |

## Scope

**In scope** (the only files you should modify/create):

- `packages/vite/src/ui/middleware.ts`
- `packages/vite/src/loopback.ts`(新規 — 共有ヘルパー)
- `packages/vite/src/hooks/handle.ts`(ローカル定義を共有ヘルパーの import に置換するのみ)
- `packages/vite/test/ui-middleware.test.ts`(テスト追加)

**Out of scope**:

- `packages/core/src/reporter/html.ts` / `json.ts` — core のレンダラーは「型どおりの `JsonReport`」を前提としてよい。防御は信頼境界である ingest 側で行う。
- `packages/vite/src/ui/serve.ts` / `store.ts` — 変更不要。
- SSE エンドポイント `/events` の認証 — 読み取りは Host チェック(下記 Step 2 で全パスに適用)で足りる。

## Git workflow

- Branch: `advisor/006-dev-ui-hardening`
- コミット例: `fix(vite): validate origin/host and complete ingest validation in the dev UI middleware`
- `@svelte-vitals/vite` の patch changeset を追加。
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `isLoopbackOrigin` を共有モジュールに抽出

`packages/vite/src/loopback.ts` を新規作成し、`hooks/handle.ts:22-29` の関数を(doc コメントごと)移動して export。`hooks/handle.ts` は import に置換。挙動は一切変えない。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → 既存テスト(特に `ui-ingest.test.ts` の non-loopback ケース)が無変更で pass

### Step 2: ミドルウェアに loopback ガードを追加

`middleware.ts` のハンドラ先頭(`const url = req.url ?? '/';` の直後)に追加:

```ts
// 送信側 postIngest(hooks/handle.ts)と同じ境界: dev UI は loopback からのみ利用可能。
// cross-site form POST は Origin を運ぶ(same-origin GET ナビゲーションは運ばない)ので、
// 「Origin があり、かつ loopback でない」場合のみ拒否すれば正規利用は壊れない。
// Host の検証は DNS リバインディング対策(--host での LAN 利用は送信側も既に ingest を止める)。
const origin = req.headers.origin;
const host = req.headers.host;
if ((typeof origin === 'string' && !isLoopbackOrigin(origin)) || !isLoopbackHost(host)) {
  res.statusCode = 403;
  res.end('svelte-vitals dev UI is only available from localhost');
  return;
}
```

`isLoopbackHost(host: string | undefined)` は `loopback.ts` に追加する小関数: `host` が undefined なら false、`new URL('http://' + host)` で hostname を取り出して同じ判定を再利用(`[::1]:5173` のようなポート付き IPv6 も URL パースで正しく扱える)。

**Verify**: `pnpm --filter @svelte-vitals/vite typecheck` → exit 0

### Step 3: `isResultLike` をレンダラーの実参照に合わせて完全化

`middleware.ts:14-28` のガードに以下を追加(`Result` 型は `packages/core/src/types.ts:50-68` 参照):

- `category`: `undefined` または `'seo' | 'performance' | 'correctness' | 'security' | 'architecture'` のいずれか(Set で判定)
- `location`: `undefined` または string
- `recommendation`: `undefined` または string
- `docsUrl`: `undefined` または string
- `fix`: `undefined` または `{ description: string, snippet?: string, lang?: string }` 形状(`snippet`/`lang` は `undefined` か string)
- `line`: `undefined` または number
- `route`: `undefined` または string

冒頭の doc コメント(middleware.ts:9-13)を実態に合わせて更新する。

**Verify**: `pnpm --filter @svelte-vitals/vite test` → 既存の ingest 系テストが pass

### Step 4: `GET /` を try/catch で包む

`renderDashboard` 呼び出しを try/catch に包み、throw 時は 500 + 短い平文メッセージを返す(コメント: 「検証済みデータでは到達しないはずの最終防衛線」)。

**Verify**: `pnpm --filter @svelte-vitals/vite build` → exit 0

### Step 5: テスト追加 + changeset

`packages/vite/test/ui-middleware.test.ts` に追加(同ファイルの既存 req/res モックパターンに従う):

1. `Origin: https://evil.example` 付き `POST /ingest` → 403、store が変化しない
2. `Origin` なし・`Host: localhost:5173` の `POST /ingest`(送信側の実挙動)→ 204、store 反映
3. `Host: evil.example` の `GET /` → 403
4. `category: 123` を持つがそれ以外は valid な結果オブジェクトの ingest → その要素はフィルタされ、直後の `GET /`(loopback Host 付き)が 200 で HTML を返す
5. `fix: { description: 5 }` のような不正 fix 形状 → 同上(フィルタされる)

changeset(`.changeset/<slug>.md`):

```md
---
'@svelte-vitals/vite': patch
---

Harden the dev UI middleware: reject non-loopback origins/hosts, fully validate ingested findings against what the dashboard renderer dereferences, and never let a malformed payload crash the dashboard.
```

**Verify**: `pnpm --filter @svelte-vitals/vite test && pnpm lint` → all pass / exit 0

## Test plan

Step 5 の 5 ケース。手本: `packages/vite/test/ui-middleware.test.ts` の既存モック構造。回帰確認として `ui-ingest.test.ts` / `ui-serve.test.ts` / `integration.test.ts` が無変更で通ること。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm --filter @svelte-vitals/vite build && pnpm --filter @svelte-vitals/vite test` exit 0(新規 5 ケース含む)
- [ ] `grep -n "isLoopbackOrigin" packages/vite/src/hooks/handle.ts` → import 行のみ(ローカル定義が消えている)
- [ ] `grep -n "403" packages/vite/src/ui/middleware.ts` → ガードが存在
- [ ] `pnpm typecheck && pnpm lint` exit 0
- [ ] `plans/README.md` のステータス行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- 既存テスト(特に `integration.test.ts` / `ui-middleware.test.ts`)が Host ヘッダーを付けずにリクエストを作っており、Step 2 のガードで大量に落ちる場合 — テスト側に `Host: localhost` を足すのが正しいか、ガードの `Host` 判定を `undefined` 許容にすべきか判断が要るため報告(実ブラウザ/HTTP1.1 では Host は必須ヘッダーであり、undefined 拒否が正しいはずだが、テスト実装との整合を確認したい)。
- Vite 本体(vite 8)が既に同等の Host/Origin ガードをミドルウェア到達前に行っていることが判明した場合(その場合もこの防御は無害だが、報告の上でテスト前提を調整)。

## Maintenance notes

- 将来 dev UI を LAN 公開(`--host`)で使いたい要望が来たら、このガードと送信側 `postIngest` の loopback 判定の**両方**を同時に緩める必要がある(片方だけだと機能しない)。
- レビューで見るべき点: Step 2 の「Origin が無い場合は許可」という判定の根拠(同一オリジン GET / サーバーサイド fetch は Origin を運ばない)がコメントで残っていること。
- `isResultLike` は `Result` 型のフィールド追加に追随が必要 — `Result` を変更する PR では middleware のガードも確認対象。
