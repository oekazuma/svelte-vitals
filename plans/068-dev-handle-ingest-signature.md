# Plan 068: dev handle の ingest 署名を POST 成功後に記録し、同一ルートの POST を直列化する(初回失敗でルートが `static` に固定される問題)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d3828d9e..HEAD -- packages/vite/src/hooks/handle.ts packages/vite/test/dev-handle.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category    | Planned at                                                                   |
| -------- | ------ | ---- | ---------- | ----------- | ---------------------------------------------------------------------------- |
| P2       | S      | LOW  | none       | correctness | commit `13aa7ad0`(= `origin/main` `d3828d9e` と同内容のファイル)、2026-09-03 |

## Why this matters

`svelteVitalsHandle`(`packages/vite/src/hooks/handle.ts`)は dev でページを描画するたびに、そのルートの rendered HTML を解析して dashboard の `/ingest` に POST する。同じ finding が続く再描画で POST を繰り返さないよう、ルートごとに「最後に送った finding の署名」を `lastSignature` に持ち、同じなら return する。

問題は順序で、`lastSignature.set(route, signature)` が **POST を試みる前**に実行される(`handle.ts:117` → `:119`)。しかも `postIngest` は `fetch` を `catch {}` で握りつぶし、`res.ok` も見ない(`:55-65`)。したがって最初の ingest が届かなかった場合(dev サーバー再起動直後で middleware がまだ載っていない、#640 以降の same-origin ゲートに引っかかる 403、一時的なソケットエラー、500)、署名は「送った」として残り、以後そのルートを何度描画しても `:116` の early return で **二度と POST されない**。dashboard 上ではそのルートが `static` バッジのまま固定され、ユーザーには理由が見えない。dev サーバーを止めて起動し直すまで直らない。

もう 1 点、`postIngest` も `analyzeAndIngest` も `void` で投げっぱなし(`:119`、`:167`)なので、同じルートの 2 回の描画は 2 つの順序保証のない in-flight POST になる。受け側の `store.set(route, …)`(`packages/vite/src/ui/store.ts:92-100`)は last-write-wins の置換なので、編集 → 描画 → 編集 → 描画の連打で**古いほうの結果が後から着いて残る**ことがある。

修正はどちらも `analyzeAndIngest` の中で閉じる。`postIngest` が成功したかを返し、成功したときだけ署名を記録する。ルートごとに Promise の尾を持って POST を直列化する。

## Current state

- `packages/vite/src/hooks/handle.ts:44-66`(`postIngest`):

  ```ts
  async function postIngest(origin: string, route: string, results: Result[], failedRuleIds: string[]): Promise<void> {
    // `origin` comes from the request (Host header), so a spoofed Host must not
    // redirect this server-side POST to an arbitrary external host.
    if (!isLoopbackOrigin(origin)) {
      // Accessing the app over LAN/--host yields a non-loopback origin, so the live
      // UI silently stops updating — surface why when debugging is enabled.
      if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
        warn(
          `svelte-vitals: live UI ingest skipped for non-loopback origin ${origin} — open the dashboard via localhost`
        );
      }
      return;
    }
    try {
      await fetch(`${origin}/__svelte-vitals/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // failedRuleIds is always sent, empty array included, so a route that recovers from
        // a previously-crashing rule clears its stale entry on the receiving store.
        body: JSON.stringify({ route, results, failedRuleIds })
      });
    } catch {
      // dev tooling must never break a request — swallow ingest failures
    }
  }
  ```

- `packages/vite/src/hooks/handle.ts:68-76`(`analyzeAndIngest` のシグネチャ)と `:111-127`(署名と POST):

  ```ts
  async function analyzeAndIngest(
    html: string,
    route: string,
    origin: string,
    rules: Rule[],
    config: Config,
    lastSignature: Map<string, string>
  ): Promise<void> {
    try {
      …
      const signature = `${findingSignature(results, config)}|failed:${[...failedRuleIds].sort().join(',')}`;
      if (lastSignature.get(route) === signature) return;
      lastSignature.set(route, signature);

      if (globalThis.process?.env?.SVELTE_VITALS_UI) void postIngest(origin, route, results, failedRuleIds);
    } catch (err) {
      // Dev tooling must never break the request: swallow any parse/rule error.
      // Set SVELTE_VITALS_DEBUG to surface tool-internal errors while debugging.
      if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
        warn(`svelte-vitals: dev analysis failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  ```

- `packages/vite/src/hooks/handle.ts:152-153`: `const lastSignature = new Map<string, string>();` を `svelteVitalsHandle` のクロージャで 1 つ持つ。`:158-169`(`transformPageChunk`): `done && event.route.id != null` のとき `void analyzeAndIngest(buffer, event.route.id, event.url.origin, rules, config, lastSignature)`。コメントに「観測専用、レスポンスをブロックしない、`analyzeAndIngest` は自分で例外を握るので floating promise は reject しない」とある。**この契約は保つ。**

- `packages/vite/test/dev-handle.test.ts`:
  - `:64-72`(`setup()`): `process.env.SVELTE_VITALS_UI = '1'` を立て、`fetch` を `vi.fn(async () => ({ ok: true }) as Response)` でスタブし `vi.stubGlobal('fetch', fetchMock)`。
  - `:31` の `flush = () => new Promise((resolve) => setTimeout(resolve, 0))` で fire-and-forget を 1 マクロタスクぶん待つ。
  - `:143-151`: 「同じ finding の再訪問は 1 回だけ POST」を `fetchMock` の呼び出し回数で pin。
  - `:192-214`: `vi.doMock('@svelte-vitals/core/internal', …)` で `runAnalysis` を差し替えて `failedRuleIds` の転送を pin。

- 設計上の注意(実装判断の根拠として固定):
  - `postIngest` は `Promise<boolean>` を返す。`fetch` が resolve し `res.ok` なら `true`。throw、`!res.ok`、非 loopback で skip した場合は `false`。**`false` のときは署名を記録しない**ので、次の描画で再送される。
  - 非 loopback(`--host` で LAN 経由)は毎回 skip されるが、署名を記録しないぶん毎回 `analyze` が走る。これは現状(署名を記録して 2 回目以降は解析だけ走る)と解析コストは同じで、POST が 1 回も出ないのも同じ。挙動差なし。
  - 直列化は `Map<string, Promise<void>>` をルート単位で持ち、`analyzeAndIngest` の POST 部分を `tail = tail.then(() => send())` で繋ぐ。解析(`runAnalysis`)自体は直列化しない(重い処理を待ち行列にする理由がない)。署名の比較と記録は POST の成功後に行うので、直列化された POST の中で「送る直前に署名を再確認」する必要はない(同じ署名の 2 つ目は送信前の `lastSignature.get(route) === signature` で落ちる。1 つ目がまだ in-flight で署名未記録なら 2 つ目も送られるが、同内容の POST が 2 回になるだけで無害)。
  - `lastSignature` Map の型は変えず、`inflight: Map<string, Promise<void>>` を `svelteVitalsHandle` のクロージャに**追加**して引数で渡す。
  - `SVELTE_VITALS_DEBUG` 時は失敗した POST を `warn` する(現状の非 loopback と同じ表面)。
  - リポジトリ規約: コードコメントは英語、非自明な WHY のみ。

## Commands you will need

| Purpose    | Command                                                    | Expected on success |
| ---------- | ---------------------------------------------------------- | ------------------- |
| Install    | `pnpm install`                                             | exit 0              |
| Build      | `pnpm build`                                               | exit 0              |
| Vite tests | `pnpm build && pnpm --filter @svelte-vitals/vite run test` | all pass            |
| Full       | `pnpm build && pnpm typecheck && pnpm test && pnpm lint`   | 全て exit 0         |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/vite/src/hooks/handle.ts`
- `packages/vite/test/dev-handle.test.ts`
- `.changeset/`(新規 changeset 1 件、`@svelte-vitals/vite` の patch)

**Out of scope**(触らない):

- `packages/vite/src/ui/middleware.ts` / `store.ts` — 受け側の置換セマンティクスは正しい。送り側で順序を保証する。
- `packages/vite/src/loopback.ts`。
- dashboard に「ingest が失敗している」ことを描画する UI。
- `findingSignature` の形式。

## Git workflow

- Branch: `advisor/068-dev-handle-ingest-signature`(`origin/main` から)
- Conventional commits、例: `fix(vite): record a route's ingest signature only after the POST succeeds and serialize POSTs per route`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 失敗するテストを書く(TDD red)

`packages/vite/test/dev-handle.test.ts` に追加する。`setup()` は `fetch` を成功固定でスタブするので、失敗させたいケースでは `fetchMock.mockImplementationOnce(...)` で上書きする。

```ts
it('retries the ingest on the next render when the first POST failed (non-ok response)', async () => {
  const fetchMock = setup();
  fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 403 }) as Response);
  const handle = svelteVitalsHandle();
  await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
  await flush();
  await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
  await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('retries the ingest on the next render when the first POST threw', async () => {
  const fetchMock = setup();
  fetchMock.mockImplementationOnce(async () => {
    throw new Error('ECONNREFUSED');
  });
  const handle = svelteVitalsHandle();
  await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
  await flush();
  await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
  await flush();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('after a successful POST the same findings are still deduplicated', async () => {
  const fetchMock = setup();
  fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500 }) as Response);
  const handle = svelteVitalsHandle();
  for (let i = 0; i < 3; i++) {
    await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
    await flush();
  }
  // 1st fails → 2nd succeeds → 3rd is deduplicated.
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('sends POSTs for the same route in render order even when an earlier one is slow', async () => {
  const fetchMock = setup();
  const bodies: string[] = [];
  let releaseFirst!: () => void;
  fetchMock.mockImplementationOnce(async (_url, init) => {
    bodies.push(String(init?.body));
    await new Promise<void>((r) => (releaseFirst = r));
    return { ok: true } as Response;
  });
  fetchMock.mockImplementation(async (_url, init) => {
    bodies.push(String(init?.body));
    return { ok: true } as Response;
  });
  const handle = svelteVitalsHandle();
  await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_NO_TITLE]) });
  await flush();
  await handle({ event: fakeEvent('/none', '/none'), resolve: resolveWith([PAGE_TWO_H1]) });
  await flush();
  // The second POST must not have been issued while the first is still in flight.
  expect(bodies).toHaveLength(1);
  releaseFirst();
  await flush();
  await flush();
  expect(bodies).toHaveLength(2);
  expect(JSON.parse(bodies[0]!).results.some((r: Result) => r.id === 'seo/title-presence')).toBe(true);
  expect(JSON.parse(bodies[1]!).results.some((r: Result) => r.id === 'seo/single-h1')).toBe(true);
});
```

`PAGE_TWO_H1` の finding が `seo/single-h1` であることは同ファイルの既存ケース(`:47-50` のコメント)に依拠する。id が違えば既存ケースで使われている id に合わせる。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test -- dev-handle` → 新 4 ケースのうち、1〜3 が **fail**(2 回目の POST が出ない / 回数が 1)、4 が **fail**(`bodies` が先に 2 になる)。既存ケースは pass。

### Step 2: `postIngest` を成功可否を返す形にし、署名記録を成功後に移し、ルート単位で直列化する

`packages/vite/src/hooks/handle.ts`:

1. `postIngest` を `Promise<boolean>` にする。

   ```ts
   /** True only when the dashboard acknowledged the POST — the caller records the route's signature on that, so a lost ingest is retried on the next render instead of pinning the route to `static`. */
   async function postIngest(origin: string, route: string, results: Result[], failedRuleIds: string[]): Promise<boolean> {
     if (!isLoopbackOrigin(origin)) {
       … (unchanged debug warn)
       return false;
     }
     try {
       const res = await fetch(`${origin}/__svelte-vitals/ingest`, { … unchanged … });
       if (!res.ok && globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
         warn(`svelte-vitals: live UI ingest for ${route} rejected with HTTP ${res.status}`);
       }
       return res.ok;
     } catch (err) {
       // dev tooling must never break a request — swallow ingest failures
       if (globalThis.process?.env?.SVELTE_VITALS_DEBUG) {
         warn(`svelte-vitals: live UI ingest for ${route} failed: ${err instanceof Error ? err.message : String(err)}`);
       }
       return false;
     }
   }
   ```

2. `analyzeAndIngest` に `inflight: Map<string, Promise<void>>` 引数を足し、署名ブロックを置き換える。

   ```ts
   const signature = `${findingSignature(results, config)}|failed:${[...failedRuleIds].sort().join(',')}`;
   if (lastSignature.get(route) === signature) return;

   if (!globalThis.process?.env?.SVELTE_VITALS_UI) return;
   // Per-route FIFO: two renders of one route are two unordered fetches otherwise, and the
   // store replaces last-write-wins, so an older payload could land last. The signature is
   // recorded only after the dashboard acknowledged the POST.
   const previous = inflight.get(route) ?? Promise.resolve();
   const next = previous.then(async () => {
     if (await postIngest(origin, route, results, failedRuleIds)) lastSignature.set(route, signature);
   });
   inflight.set(route, next);
   await next;
   if (inflight.get(route) === next) inflight.delete(route);
   ```

   `await next` は `analyzeAndIngest` 自身が `void` で呼ばれているのでレスポンスをブロックしない。`postIngest` は throw しないので `next` は reject しない。

3. `svelteVitalsHandle` に `const inflight = new Map<string, Promise<void>>();` を `lastSignature` の隣に足し、`analyzeAndIngest(..., lastSignature, inflight)` で渡す。

**Verify**: `pnpm build && pnpm typecheck && pnpm --filter @svelte-vitals/vite run test` → all pass(Step 1 の 4 ケース含む。既存の `dedups` ケースと `failedRuleIds` 転送ケースが無変更で通ること)。

### Step 3: changeset を書き、最終検証

`.changeset/` に新規ファイル(例 `dev-handle-ingest-retry.md`)。

```md
---
'@svelte-vitals/vite': patch
---

`svelteVitalsHandle` now records a route's ingest signature only after the dashboard acknowledged the POST, so a route whose first ingest was lost (dev server restarting, a rejected origin, a transient socket error) is retried on its next render instead of staying `static` for the rest of the session. POSTs for the same route are sent in render order, so a slow earlier ingest can no longer overwrite a newer one. With `SVELTE_VITALS_DEBUG` set, a rejected or failed ingest is logged.
```

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0。

## Test plan

- 新規 4 ケース(非 ok で再送、throw で再送、成功後は重複除去、同一ルートの順序保証)。
- 既存: `dedups` / `failedRuleIds` 転送 / pass-through(非 dev)ケースが無変更で通ること。
- 判別性: Step 2 の「署名を成功後に記録」だけを revert すると 1〜3 が赤、「直列化」だけを revert すると 4 が赤になることを確認する。

## Done criteria

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` が全て exit 0
- [ ] `grep -n "Promise<boolean>" packages/vite/src/hooks/handle.ts` が 1 行ヒット
- [ ] `grep -n "lastSignature.set" packages/vite/src/hooks/handle.ts` のヒットが `postIngest` の成功分岐の 1 行だけ
- [ ] `plans/README.md` の 068 行を更新済み

## Maintenance notes

- `inflight` の Promise 尾はルート数ぶんしか増えず、完了後に自分を削除する。SSR ルート id は有限なので無限に育たない(unmatched request は `event.route.id == null` で最初から対象外)。
- ingest の受け側(`middleware.ts`)がステータスコードを変えたら、`res.ok` の判定はそのまま追従する。204 以外の 2xx を返しても成功扱い。

## STOP conditions

- Drift check でいずれかの in-scope ファイルが変わっており、抜粋と一致しない。
- Step 1 の既存 `dedups` ケースが Step 2 の後で fail する(署名記録のタイミングが `flush` 1 回では足りない)。その場合は `flush` を 2 回に増やして通るかを確認し、通るならテスト側を直す。通らなければ報告。
- `transformPageChunk` の契約(レスポンスをブロックしない)を守れない変更が必要になった場合。
