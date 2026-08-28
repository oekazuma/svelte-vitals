# Plan 058: dashboard の「Copy AI prompt」出力を Markdown 的に無害化する(`buildAiPrompt` の生連結)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 690dd5e4..HEAD -- packages/core/src/reporter/app-shell.ts packages/vite/test/dashboard-script-ai-prompt.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

| Priority | Effort | Risk | Depends on | Category | Planned at                    |
| -------- | ------ | ---- | ---------- | -------- | ----------------------------- |
| P1       | S      | LOW  | none       | security | commit `690dd5e4`, 2026-08-28 |

## Why this matters

dashboard の各 finding カードにある「Copy AI prompt」は、finding のフィールド(title / location / recommendation / fix / docsUrl)を Markdown 風テキストに連結してクリップボードへ渡す。これらのフィールドは解析対象リポジトリ由来(ルートパス、`<title>` や JSON-LD の引用値、ソース抜粋)であり、ユーザーはこの文字列を**書き込み権限を持つコーディングエージェントに貼り付ける**。PR #465/#473/#475 で markdown/agent レポーターは `mdEscape` 化されたのに、消費者がまさにエージェントであるこの 1 シンクだけが生のままになっている。フィールド内の改行は新しい箇条書き/見出し行を開き、snippet 内のバッククォート 3 連はフェンスを早期に閉じて残りを地の文(=エージェントへの指示に見える文)へ変える。

## Current state

- `packages/core/src/reporter/app-shell.ts:320-344` — `buildAiPrompt` は `APP_SCRIPT`(ブラウザで実行される ES5 のテンプレート文字列、`export const APP_SCRIPT: string = \`...\`` 内)にある。HEAD の実コード(抜粋):

  ```js
  function buildAiPrompt(issue, route) {
    var lines = ['Fix this svelte-vitals finding:', ''];
    lines.push('- Rule: ' + issue.id + ' — ' + issue.title + ' (' + issue.severity + ')');
    if (route) lines.push('- Route: ' + route);
    if (issue.location) {
      lines.push('- Location: ' + issue.location + (issue.line !== undefined ? ':' + issue.line : ''));
    }
    if (issue.recommendation) lines.push('- Recommendation: ' + issue.recommendation);
    if (issue.fix) {
      lines.push('- Fix: ' + issue.fix.description);
      if (issue.fix.snippet) {
        lines.push('', '\`\`\`' + (issue.fix.lang || 'svelte'), issue.fix.snippet, '\`\`\`');
      }
    }
    if (issue.docsUrl) lines.push('- Docs: ' + issue.docsUrl);
    ...
  }
  ```

- 重要な制約 — `buildAiPrompt` はクライアントサイド(ブラウザ内)で動く。`packages/core/src/reporter/sanitize.ts` の `mdEscape`/`inlineCode` はビルド時の TS モジュールなので **import できない**。修正は APP_SCRIPT 文字列内に小さな ES5 エスケーパを実装する形になる。また同じ issue フィールドは DOM 表示(`h()`/`textContent` 経由 — こちらは安全)にも使われるため、埋め込みデータ側で事前エスケープしてはならない(表示が壊れる)。

- 手本にする既存実装 — `packages/core/src/reporter/sanitize.ts:9-37`(この**意味論**を ES5 で移植する。single-line フィールド向け):

  ```ts
  function inlineCode(text: string): string {
    const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
    const fence = '`'.repeat(longestRun + 1);
    const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
    return `${fence}${pad}${text}${pad}${fence}`;
  }
  export function mdEscape(text: string): string {
    return text
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/<[^>]+>/g, (tag) => inlineCode(tag))
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '[$1]\\($2\\)');
  }
  ```

  `fix.snippet` には `mdEscape` は不適(改行を潰すと正当な複数行 snippet が壊れる)。snippet は `inlineCode` と同じ最長バッククォート連長ロジックで**フェンス長を可変化**する(スニペット内の最長 `` ` `` 連+1、最低 3)。

- 既存テスト(このパターンに新テストを足す): `packages/vite/test/dashboard-script-ai-prompt.test.ts` — happy-dom 環境で `APP_SCRIPT` を `@svelte-vitals/core/internal` から import して `eval` 実行し、snapshot JSON を流し込んで prompt テキストを assert する形。

- リポジトリ規約: コードコメントは英語のみ。APP_SCRIPT 内は ES5(`var`、`function`)で書かれている — 合わせること。

## Commands you will need

| Purpose    | Command                                      | Expected on success |
| ---------- | -------------------------------------------- | ------------------- |
| Install    | `pnpm install`                               | exit 0              |
| Build      | `pnpm build`                                 | exit 0              |
| Core tests | `pnpm --filter @svelte-vitals/core run test` | all pass            |
| Vite tests | `pnpm --filter @svelte-vitals/vite run test` | all pass            |
| Full       | `pnpm test && pnpm lint`                     | exit 0              |

## Scope

**In scope**(変更してよいファイルはこれだけ):

- `packages/core/src/reporter/app-shell.ts`(`APP_SCRIPT` 内の `buildAiPrompt` 周辺のみ)
- `packages/vite/test/dashboard-script-ai-prompt.test.ts`(テスト追加)
- `.changeset/`(新規 changeset 1 件)

**Out of scope**(触らない):

- `packages/core/src/reporter/sanitize.ts` — 変更不要(ES5 移植の参照元なだけ)。
- `APP_SCRIPT` の他の関数、`APP_STYLE`、`buildHtmlDocument` — DOM 表示パス(`textContent`)は既に安全。
- 埋め込み JSON(`embedJson`)側での事前エスケープ — 表示パスを壊すので禁止。
- `packages/vite/src/ui/middleware.ts` — 別所見(260828-SEC-03)。

## Git workflow

- Branch: `advisor/058-dashboard-ai-prompt-escape`
- Conventional commits、例: `fix(core): escape analyzed-repo strings in the dashboard's AI prompt builder`
- push / PR 作成はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 失敗するテストを先に追加する(TDD red)

`packages/vite/test/dashboard-script-ai-prompt.test.ts` に、既存の snapshot ビルダーをコピーして悪性フィールドを持つケースを追加する。

1. `title` に改行+`- Injected:` を含む issue → 生成 prompt が単一の `- Rule:` 行に収まり、`\n- Injected:` が独立行として現れないこと。
2. `fix.snippet` に ` ``` ` (3 連バッククォート)を含む issue → フェンスが 4 連以上になり、snippet 全体が 1 つのフェンス内に収まること(prompt を行分割し、フェンス開始行と終了行が同じ長さで、間に snippet の全行があることを assert)。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test` → 新 2 ケースが **fail**(既存は pass)

### Step 2: `APP_SCRIPT` 内に ES5 エスケーパを実装して配線する

`buildAiPrompt` の直前に追加する(ES5、英語コメント)。

```js
// Analyzed-repo strings flow into a prompt the user pastes into a coding agent —
// same threat model as reporter/sanitize.ts's mdEscape, re-implemented here because
// APP_SCRIPT runs in the browser and cannot import build-time modules.
function mdSafe(text) {
  return String(text)
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/<[^>]+>/g, function (tag) { ... inlineCode 相当 ... })
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '[$1]\\($2\\)');
}
function fenceFor(snippet) {
  var m = String(snippet).match(/`+/g);
  var longest = 0;
  if (m) for (var i = 0; i < m.length; i++) if (m[i].length > longest) longest = m[i].length;
  return Array(Math.max(3, longest + 1) + 1).join('\`');
}
```

配線: `issue.title`・`route`・`issue.location`・`issue.recommendation`・`issue.fix.description` を `mdSafe(...)` 経由に、snippet のフェンスを `fenceFor(issue.fix.snippet)` に(開始・終了両方)。`issue.id`/`issue.severity`/`issue.line` は svelte-vitals 自身が生成する語彙なので包まない。`issue.docsUrl` は `mdSafe` で包む(URL に改行が入る経路を閉じる)。

注意 — APP_SCRIPT は TS のテンプレートリテラル内なので、追加コード中のバッククォートは `\`` にエスケープする(既存コードの `'\`\`\`'` が前例)。

**Verify**: `pnpm build && pnpm --filter @svelte-vitals/vite run test` → Step 1 の 2 ケース含め all pass

### Step 3: 既存表示パスの無変化を確認し、changeset を書く

既存の dashboard 系テスト(`dashboard-script-ai-prompt.test.ts` の既存ケース、`dashboard-script-staleness.test.ts`、core の `html-report.test.ts`)が全て無変更で pass することを確認。`pnpm changeset` で `@svelte-vitals/core` patch(英語)。内容例: "The dashboard's Copy-AI-prompt output now neutralizes newlines, links and backtick runs coming from the analyzed project."

**Verify**: `pnpm build && pnpm test` → all pass

### Step 4: 最終検証

**Verify**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` → 全て exit 0

## Test plan

- Step 1 の 2 ケース(改行注入・フェンス破り)。既存ケースが「正常フィールドの prompt 内容」を既に pin しているので、正常系の劣化(余計なエスケープで読めなくなる等)はそちらが検出する。

## Done criteria

- [ ] 改行入り title がプロンプトの構造(箇条書き行)を破れないことをテストが証明している
- [ ] 3 連バッククォート入り snippet がフェンスを破れないことをテストが証明している
- [ ] 既存の dashboard/AI prompt テストが無変更で pass
- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` 全て exit 0
- [ ] `git status` で in-scope 外の変更ゼロ
- [ ] changeset(core patch、英語)が存在する
- [ ] `plans/README.md` の 058 行を更新済み

## STOP conditions

- "Current state" の `buildAiPrompt` 抜粋と実コードが不一致。
- `dashboard-script-ai-prompt.test.ts` が存在しない、または APP_SCRIPT を eval する構造ではなくなっている(テストの土台が変わっている — 報告)。
- 既存ケースの期待文字列を 3 箇所以上書き換えないと通らない(正常系の出力を変えすぎている — エスケープ対象を絞り直すか報告)。

## Maintenance notes

- `buildAiPrompt` に新フィールドを足すときは必ず `mdSafe`(または snippet 系なら `fenceFor`)を通すこと。レビュー観点は「`lines.push` に生の `issue.*` が現れていないか」。
- `mdSafe` は `sanitize.ts` の `mdEscape` の意味論の手動コピーであり、`mdEscape` 側を変えたらここも追随が要る(両者を紐付ける英語コメントを双方に置くこと — 本計画で `sanitize.ts` は触らないので、app-shell 側のコメントに参照を書く)。
