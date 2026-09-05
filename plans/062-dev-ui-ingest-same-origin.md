# Plan 062: dev UI の `POST /ingest` を same-origin に限定し、body サイズに上限を設ける

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 13aa7ad0..HEAD -- packages/vite/src/ui/middleware.ts packages/vite/src/loopback.ts packages/vite/test/ui-middleware.test.ts 'docs/src/content/docs/guides/(vite)/dev-dashboard.mdx' 'docs/src/content/docs/ja/guides/(vite)/dev-dashboard.mdx'`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                    |
| -------- | ------ | ---- | ---------- | -------- | ----------------------------- |
| P2       | S      | LOW  | none       | security | commit `13aa7ad0`, 2026-09-03 |

## Why this matters

`vite dev` 中に `/__svelte-vitals/ingest` へ POST された finding は、そのまま dashboard に表示され、各カードの「Copy AI prompt」経由でユーザーが**書き込み権限を持つコーディングエージェントに貼り付ける**テキストになる。現在のガードは「`Origin` ヘッダーがあり、かつそのホスト名が loopback でなければ拒否」であり、ホスト名しか見ていない。そのため `Host: localhost:5173` の dev サーバーに対し、`Origin: http://localhost:3000` を持つ別ポートのページ(他プロジェクトの dev サーバー、ローカルで動くツールの UI、そこに XSS があるページ)から `fetch(..., { method: 'POST', mode: 'no-cors' })` すれば、preflight なしで任意の finding を注入できる。注入された `recommendation` / `fix.description` / `fix.snippet` は型と形しか検証されない(Plan 058 が守るのは Markdown **構造**であって内容ではない)。

前提条件は「開発者のブラウザ内に攻撃者が制御する loopback オリジンのページがある」ことなので影響は LOW〜MED だが、閉じるコストは数行である。送信側 `postIngest`(`hooks/handle.ts`)は Node の `fetch` を使い、**Node の fetch は `Origin` ヘッダーを送らない**(Node 24.18.1 で実測済み: `origin: null`)。dashboard 自身からの POST は same-origin。したがって「`Origin` が無い、または `Host` と完全一致(hostname:port)」に絞っても正規経路は一切壊れない。

同じ経路の body は上限なしにメモリへ蓄積される(`chunks.push`)。same-origin 化で到達者はほぼ dashboard 自身に限られるが、防御の多層化として 4 MiB の上限を同時に入れる。根拠は 2026-09-03 の実測: built CLI で `examples/kitchen-sink`(欠陥ギャラリー、80 ルート・190 finding)を `--reporter json` で解析し、1 ルートあたりの ingest payload(`{route, results, failedRuleIds}` 相当)に換算した最大が 25 finding で約 14 KB、JSON レポート全体でも約 130 KB だった。4 MiB は最大ルートの約 300 倍にあたる。

## Current state

- `packages/vite/src/ui/middleware.ts` — dev UI のミドルウェア。HEAD の実コード(89-130 行、抜粋):

  ```ts
  server.middlewares.use('/__svelte-vitals', (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    // Same boundary as the sending side's postIngest (hooks/handle.ts): the dev UI is
    // loopback-only. Cross-site form POSTs carry an Origin header (same-origin GET
    // navigations don't), so rejecting only "Origin present AND non-loopback" never
    // breaks legitimate use. Host validation mitigates DNS rebinding (LAN use via
    // --host is already blocked on the sending side too).
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (
      (typeof origin === 'string' && !isLoopbackOrigin(origin)) ||
      host === undefined ||
      !isLoopbackOrigin(`http://${host}`)
    ) {
      // drain any unread body so the client reliably receives the 403 (unread data kills the socket)
      req.resume();
      res.statusCode = 403;
      res.end('svelte-vitals dev UI is only available from localhost');
      return;
    }

    if (req.method === 'POST' && url.startsWith('/ingest')) {
      // Collect raw Buffers and decode once: per-chunk toString() would corrupt a
      // multibyte char split across a chunk boundary, dropping that route's findings.
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const { route, results, failedRuleIds } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (typeof route === 'string' && Array.isArray(results)) {
            const failedIds = Array.isArray(failedRuleIds) ? failedRuleIds.filter((id) => typeof id === 'string') : [];
            store.set(route, results.filter(isResultLike), failedIds);
          }
        } catch {
          // ignore malformed ingest payloads — dev tooling must not crash the dev server
        }
        res.statusCode = 204;
        res.end();
      });
      return;
    }
  ```

- `packages/vite/src/loopback.ts` — 送信側・受信側で共有する loopback 判定(全文):

  ```ts
  /** Only the local dev server hosts the ingest endpoint, so never POST off-box. */
  export function isLoopbackOrigin(origin: string): boolean {
    try {
      const host = new URL(origin).hostname;
      // WHATWG URL keeps the brackets on IPv6 hostnames ('[::1]'); a bare '::1' never parses.
      return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    } catch {
      return false;
    }
  }
  ```

- `packages/vite/src/hooks/handle.ts:42-66` — 送信側 `postIngest`。``fetch(`${origin}/__svelte-vitals/ingest`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })``。`origin`は`event.url.origin`(=ページ要求の `Host`由来)で、dashboard と同じ vite サーバーを指す。Node の`fetch`(undici)は `Origin` ヘッダーを付けない。

- `packages/vite/test/ui-middleware.test.ts` — 既存テスト。`setup()` がミドルウェアのハンドラを捕まえ、`postReq(url, headers)` / `getReq(url, headers)` が `EventEmitter` ベースの疑似 `IncomingMessage`(`method`/`url`/`headers`/`resume`)を作り、`res()` が疑似 `ServerResponse` を作る。body は `ireq.emit('data', Buffer)` → `ireq.emit('end')` で流す。Origin 関連の既存ケース(206-234 行):

  ```ts
  it('rejects a cross-site ingest POST carrying a non-loopback Origin', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173', origin: 'https://evil.example' });
    call(ireq, ir);
    expect(ir.statusCode).toBe(403); // rejected before the body is even read
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.statusCode).not.toBe(403);
    expect(gr.chunks.join('')).not.toContain('seo/title-presence');
  });

  it('accepts an ingest POST without an Origin header (server-side postIngest behavior)', async () => {
    const { call } = setup();
    const ir = res();
    const ireq = postReq('/ingest', { host: 'localhost:5173' }); // node fetch sends no Origin
    call(ireq, ir);
    ireq.emit('data', Buffer.from(ingestBody));
    ireq.emit('end');
    await new Promise((r) => setTimeout(r, 0));
    expect(ir.statusCode).toBe(204);
    const gr = res();
    call(getReq('/'), gr);
    expect(gr.chunks.join('')).toContain('seo/title-presence'); // stored and rendered
  });
  ```

  **別ポートの loopback Origin を拒否するケースは存在しない**(このギャップが本計画の対象)。

- ユーザー向け docs — `docs/src/content/docs/guides/(vite)/dev-dashboard.mdx:89`(en)と `docs/src/content/docs/ja/guides/(vite)/dev-dashboard.mdx:87`(ja)の "Notes" 箇条書きに、境界の説明がある:

  > - Live updates only flow over a loopback origin (`localhost`, `127.0.0.1`, `[::1]`). When you run `vite dev --host` and open the app via a LAN IP, the handle skips the ingest POST, a guard against a spoofed `Host` header, so visited routes won't refine to `measured`. Open it from `localhost` instead.
  > - ライブ更新はループバックオリジン（`localhost`、`127.0.0.1`、`[::1]`）でのみ流れます。`vite dev --host` で LAN の IP からアプリを開いた場合、…

  AGENTS.md の規約: en を編集したら ja も同時に更新し、`pnpm --filter docs run translate:stamp <en-file>` で台帳(`docs/blume.translations.json`)に記録する。CI の `docs` ジョブ(`translate:check`)が未記録の en 変更を落とす。**ja を実際に更新せずに stamp してはならない。**

- 設計上の注意点(実装判断の根拠として固定):
  - 比較は `new URL(origin).host`(hostname と port)対 ``new URL(`http://${req.headers.host}`).host``(Host 側も URL パーサに通し、既定ポートの省略と大文字小文字を正規化する)。**scheme は比較しない** — Vite を `server.https`で動かすと`Origin`は`https://localhost:5173`、`Host` は `localhost:5173` のままで、scheme まで比べると正規の dashboard からの POST を落とす。
  - `Origin: null`(sandboxed iframe、`file://` ページ — `--reporter html` の静的レポートを含む)は `new URL('null')` が throw するので現状でも 403。そのままにし、テストで固定する。
  - 既存の loopback Host チェックと DNS rebinding 防御は**そのまま残す**。same-origin 判定は Host が loopback であることの上に重ねる。
  - `Content-Type` は見ない(現状どおり)。`no-cors` の simple request は `text/plain` で来るので、Content-Type で絞っても防御にならず、判定は Origin で行う。
  - リポジトリ規約: コードコメントは英語。非自明な WHY のみ書く。

## Commands you will need

| Purpose    | Command                                                    | Expected on success |
| ---------- | ---------------------------------------------------------- | ------------------- |
| Install    | `pnpm install`                                             | exit 0              |
| Build      | `pnpm build`                                               | exit 0              |
| Vite tests | `pnpm build && pnpm --filter @svelte-vitals/vite run test` | all pass            |
| Docs gate  | `pnpm --filter docs run translate:check`                   | exit 0              |
| Full       | `pnpm build && pnpm typecheck && pnpm test && pnpm lint`   | 全て exit 0         |

vite パッケージのテストは `@svelte-vitals/core` / `svelte-vitals` の**ビルド済み dist** を import するため、テスト前に必ず `pnpm build` を通すこと。

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/vite/src/loopback.ts`(`isSameOrigin` を追加)
- `packages/vite/src/ui/middleware.ts`(ガード条件・コメント・body 上限)
- `packages/vite/test/ui-middleware.test.ts`(テスト追加)
- `packages/vite/test/loopback.test.ts`(新規)
- `docs/src/content/docs/guides/(vite)/dev-dashboard.mdx` と `docs/src/content/docs/ja/guides/(vite)/dev-dashboard.mdx`(Notes に 1 文追加)
- `docs/blume.translations.json`(`translate:stamp` が更新する — 手で編集しない)
- `.changeset/`(新規 changeset 1 件)

**Out of scope**(触らない):

- `packages/vite/src/hooks/handle.ts` — 送信側は変更不要(Node fetch は Origin を送らない。もし送っていたら STOP 条件)。
- `packages/vite/src/ui/snapshot.ts` / `store.ts` / `packages/core/src/reporter/app-shell.ts` — 表示側の無害化(058 で済み)。
- `examples/kitchen-sink` — ユーザーが設定する「lever」ではないので kitchen-sink の e2e ガード(AGENTS.md)は不要。
- `GET /`・`/events`・`/data.json` の応答形式・CORS ヘッダーの追加。

## Git workflow

- Branch: `advisor/062-dev-ui-ingest-same-origin`
- Conventional commits、例: `fix(vite): accept dev UI ingest only from the dashboard's own origin and cap the body`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: `isSameOrigin` を loopback.ts に追加し、単体テストを書く

`packages/vite/src/loopback.ts` に追加:

```ts
/**
 * Whether `origin` (an Origin header value) names exactly the server this request reached —
 * `host` is the Host header, `hostname[:port]`. The scheme is deliberately ignored: under
 * `server.https` the Origin is https while the Host header is unchanged. Both sides go
 * through the URL parser so a default port (`localhost:80`) and hostname case compare equal.
 */
export function isSameOrigin(origin: string, host: string): boolean {
  try {
    return new URL(origin).host === new URL(`http://${host}`).host;
  } catch {
    return false;
  }
}
```

`packages/vite/test/loopback.test.ts` を新規作成(vitest、`describe`/`it`/`expect`。既存テストの import スタイルに合わせる):

| ケース                                         | 期待    |
| ---------------------------------------------- | ------- |
| `('http://localhost:5173', 'localhost:5173')`  | `true`  |
| `('https://localhost:5173', 'localhost:5173')` | `true`  |
| `('http://[::1]:5173', '[::1]:5173')`          | `true`  |
| `('http://localhost', 'localhost:80')`         | `true`  |
| `('http://LOCALHOST:5173', 'localhost:5173')`  | `true`  |
| `('http://localhost:3000', 'localhost:5173')`  | `false` |
| `('http://127.0.0.1:5173', 'localhost:5173')`  | `false` |
| `('null', 'localhost:5173')`                   | `false` |

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test` → 新ファイルの 8 ケース含め all pass

### Step 2: 失敗するミドルウェアテストを先に追加する(TDD red)

`packages/vite/test/ui-middleware.test.ts` に、既存の `rejects a cross-site ingest POST carrying a non-loopback Origin` をコピーして次を追加する(store が変化しないことの確認まで同じ形で):

1. `rejects an ingest POST from another loopback port (cross-origin on localhost)` — `postReq('/ingest', { host: 'localhost:5173', origin: 'http://localhost:3000' })` → `403`、その後の `GET /` に `seo/title-presence` が現れない。
2. `accepts an ingest POST from the dashboard's own origin` — `origin: 'http://localhost:5173'` → `204`、`GET /` に反映。
3. `accepts a same-host https Origin (server.https)` — `origin: 'https://localhost:5173'` → `204`。
4. `rejects Origin: null` — `origin: 'null'` → `403`(現状でも通るはずのケースを固定する)。
5. `rejects an ingest body over the size cap and stores nothing` — `Buffer.alloc(4 * 1024 * 1024 + 1, 0x20)` を 1 回または複数回 `emit('data')` してから `emit('end')` → `413`、`GET /` に `seo/title-presence` が現れない。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test` → ケース 1 と 5 が **fail**、2〜4 は pass(4 は既存挙動で pass する)

### Step 3: ミドルウェアのガードを same-origin 化し、body 上限を入れる

`packages/vite/src/ui/middleware.ts`:

1. import に `isSameOrigin` を追加(`'../loopback.js'`)。
2. ファイル先頭の定数に `const INGEST_BODY_LIMIT = 4 * 1024 * 1024;` を追加し、英語コメントで「same-origin にしても dashboard 自身の XSS からの巨大 POST は残るので、メモリ蓄積に上限を置く。kitchen-sink の最大ルート(25 finding)で約 14 KB」と WHY を 1〜2 行で書く。
3. ガード条件を次の形に置き換え、直上のコメントも書き直す(「Origin present AND non-loopback を拒否」の説明は誤りになるので残さない):

   ```ts
   // Loopback Host defeats DNS rebinding; on top of that, a request carrying an Origin must come
   // from this very server (host:port). The handle's server-side fetch sends no Origin, and the
   // dashboard's own fetches are same-origin, so nothing legitimate is lost — while a page on any
   // other localhost port (another dev server, a local tool UI) can no longer POST findings in.
   const origin = req.headers.origin;
   const host = req.headers.host;
   if (
     host === undefined ||
     !isLoopbackOrigin(`http://${host}`) ||
     (typeof origin === 'string' && !isSameOrigin(origin, host))
   ) {
   ```

   403 の本文・`req.resume()` はそのまま。

4. `POST /ingest` 分岐に上限を入れる。`chunks` の合計バイト数を数え、超えたら以後のチャンクを捨て、`end` で `413` を返して parse も `store.set` もしない:

   ```ts
   const chunks: Buffer[] = [];
   let received = 0;
   req.on('data', (c: Buffer) => {
     received += c.length;
     if (received <= INGEST_BODY_LIMIT) chunks.push(c);
   });
   req.on('end', () => {
     if (received > INGEST_BODY_LIMIT) {
       res.statusCode = 413;
       res.end();
       return;
     }
     try { ... 既存どおり ... } catch { ... }
     res.statusCode = 204;
     res.end();
   });
   ```

   `req.destroy()` は使わない — テストの疑似 `IncomingMessage` は `resume` しか持たず、実サーバーでも 413 を返し切る方が挙動が読みやすい。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test` → Step 2 の 5 ケース含め all pass。特に既存の `accepts an ingest POST without an Origin header` と `rejects a dashboard GET with a non-loopback Host (DNS rebinding)` が無変更で pass すること。

### Step 4: docs(en/ja)に境界の 1 文を追加し、台帳に stamp する

`docs/src/content/docs/guides/(vite)/dev-dashboard.mdx` の "Live updates only flow over a loopback origin …" の箇条書きの**直後**に 1 項目追加:

```md
- The dashboard's ingest endpoint accepts POSTs only from the dashboard's own origin (same host and port) or from the server-side handle, so a page served by another local dev server or tool cannot feed it findings.
```

`docs/src/content/docs/ja/guides/(vite)/dev-dashboard.mdx` の対応する箇条書きの直後には、次の 1 項目を追加する。

```md
- dashboard の ingest エンドポイントは、dashboard 自身のオリジン（同じホストとポート）またはサーバー側ハンドルからの POST だけを受け付けます。別のローカル dev サーバーやツールが配信するページから finding を流し込むことはできません。
```

両方を編集し終えたら、次のコマンドで台帳に記録する。

```bash
pnpm --filter docs run translate:stamp 'src/content/docs/guides/(vite)/dev-dashboard.mdx'
```

**Verify**: `pnpm --filter docs run translate:check` → exit 0。`git diff --stat docs/blume.translations.json` → 変更が 1 エントリ(dev-dashboard.mdx)のみ。

### Step 5: changeset を書き、最終検証

`pnpm changeset` で `@svelte-vitals/vite` **patch**(英語)。内容例:

> The dev dashboard's `/__svelte-vitals/ingest` endpoint now accepts POSTs only from the dashboard's own origin (same host and port) or from the server-side handle, and answers 413 to bodies over 4 MiB. Previously a page served from any other localhost port could inject findings — including fix snippets that reach "Copy AI prompt" — into the dashboard.

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0

## Test plan

- Step 1 の `loopback.test.ts`(8 ケース)— `isSameOrigin` の port/scheme/IPv6/既定ポート/大文字小文字/不正値の意味論を固定。
- Step 2 の 5 ケース — 別ポート拒否(本命)、same-origin 受理、https 受理、`Origin: null` 拒否、413。
- 既存ケースが回帰検出を担う: `accepts an ingest POST without an Origin header`(送信側の実挙動)、`rejects a cross-site ingest POST carrying a non-loopback Origin`、`rejects a dashboard GET with a non-loopback Host`、multibyte 分割 body。
- 手本: `packages/vite/test/ui-middleware.test.ts:206-234`(構造をそのままコピーして origin と期待値だけ変える)。

## Done criteria

- [ ] `Origin: http://localhost:3000` + `Host: localhost:5173` の `POST /ingest` が 403 で、store が変化しないことをテストが証明している
- [ ] `Origin` なし / same-origin(http, https)の `POST /ingest` が 204 で反映されることをテストが証明している
- [ ] 4 MiB 超の body が 413 で、store が変化しないことをテストが証明している
- [ ] `grep -n "Origin present AND non-loopback" packages/vite/src/ui/middleware.ts` → 0 件(古い説明コメントが消えている)
- [ ] en/ja の dev-dashboard.mdx の両方に新しい箇条書きがあり、`pnpm --filter docs run translate:check` が exit 0
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` 全て exit 0
- [ ] `git status` で in-scope 外の変更ゼロ
- [ ] changeset(`@svelte-vitals/vite` patch、英語)が存在する
- [ ] `plans/README.md` の 062 行を更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- "Current state" の `middleware.ts` 抜粋・既存テスト抜粋と実コードが不一致。
- Step 3 の変更後に既存の `accepts an ingest POST without an Origin header` が fail する、または `packages/vite/test/ui-ingest.test.ts` / `ui-integration.test.ts` が fail する — 送信側が Origin を付けている可能性があり、`hooks/handle.ts` は out of scope なので報告。
- Vite 本体が `/__svelte-vitals` に届く前に同等の Origin 検証を行っていて、テストの前提(ハンドラに Origin 付き要求が届く)が成り立たないと判明した場合。
- `translate:stamp` が dev-dashboard.mdx 以外の台帳エントリも書き換える(台帳を丸ごと再生成してはならない)。
- ja ページに en の "Live updates only flow over a loopback origin" に対応する箇条書きが見つからない(挿入位置を推測せず報告)。

## Maintenance notes

- `/__svelte-vitals` 配下に新しいルートを足すとき、このガードは自動的にかかる(ミドルウェア先頭で一括判定)。ルート個別の緩和は作らないこと。
- 将来 dev UI を LAN 公開(`--host`)で使いたい要望が来たら、緩める箇所は **3 つ同時**: ここの loopback Host チェック、same-origin 判定、送信側 `postIngest` の loopback 判定。片方だけ緩めると live 更新が黙って止まる(Plan 006 の Maintenance notes と同じ注意)。docs の 2 つの箇条書き(en/ja)も追随させる。
- レビュー観点: ガード条件が「Host が loopback」**かつ**「Origin があるなら Host と一致」の 2 段になっているか。`isLoopbackOrigin(origin)` を残して same-origin を省く戻し方は、本計画が閉じるギャップをそのまま再導入する。
- 上限 `INGEST_BODY_LIMIT` を上げる場合は、実際に超えた route の finding 数と payload サイズを changeset に記録すること(値の根拠が kitchen-sink 実測の約 14 KB/ルート(2026-09-03)であるため)。
