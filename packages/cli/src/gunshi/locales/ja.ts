/**
 * ja resources for `--help` (design doc: `docs/superpowers/specs/2026-08-11-cli-ja-help-design.md`).
 * Two kinds, per surface:
 *
 * - `JA_ARG_DESCRIPTIONS`: one map per surface that actually feeds a `generate()` call for
 *   `--help` — not one per every exported `*_ARGS` const. `docs list --help`/`docs show --help`
 *   render from `DOCS_ROOT_ARGS`, same as bare `docs --help` (docs.ts's own `buildDocsHelpText`
 *   doc comment), and `ci`/`ci install --help`/`ci upgrade --help` all render from the full
 *   `CI_ARGS` (ci.ts's own doc comment) — so `DOCS_LIST_ARGS`/`DOCS_SHOW_ARGS`/`CI_UPGRADE_ARGS`
 *   are never passed to `generate()` and have nothing here to translate. Keyed by the SAME raw
 *   `ArgSchema` object key `--help` itself reads (see `locale.ts`'s `localizedOptionsSection` doc
 *   comment) — `noColor`/`noAnimation`/`noSuppressions`, never their kebab-cased `--no-*` form.
 *   `packages/cli/test/gunshi-i18n-completeness.test.ts` fails the build if a key here doesn't
 *   exactly match its surface's live declaration (missing OR extra).
 * - Prose builders (`rootHelpJa` etc.): ja counterparts of each surface's hand-written
 *   header/usage/footer text, taking the already-localized OPTIONS block as a parameter — mirrors
 *   the English template in the same file one-for-one, translated. Commands, flags, paths, and
 *   URLs stay as typed (they are not natural-language text); enum values inside a description
 *   (`pass`/`warn`/`fail`, `console`/`json`/...) stay English too — they are literal tokens a user
 *   types, not prose.
 *
 * Never used for error/warning/reporter text — those stay English everywhere (design doc's hard
 * boundary), so nothing here duplicates `DOCS_HELP`/`CI_HELP` or any `io.errorLog` wording.
 */

export const JA_ARG_DESCRIPTIONS = {
  root: {
    'meta-components': 'head メタデータを出力するコンポーネント名（カンマ区切り）',
    'treat-dynamic-as': 'pass | warn | fail（デフォルト: pass）',
    route: '指定した glob に一致するルートのみ解析',
    diff: 'ref と比較して変更されたファイルの検出結果のみ報告（デフォルト HEAD。例: --diff main）',
    staged: 'コミット用にステージされたファイルの検出結果のみ報告（pre-commit ゲート）',
    baseline: 'ref の時点では存在しなかった検出結果のみ報告（例: origin/main と比較）',
    'update-suppressions':
      '現在のすべての検出結果を受け入れる svelte-vitals-suppressions.json を書き出す（既存プロジェクトへのゲート導入）',
    noSuppressions: 'この実行に限り svelte-vitals-suppressions.json を無視',
    'by-route': 'コンソール出力にルートごとのスコア内訳を表示',
    reporter:
      'console | json | agent | sarif | github | html | md（自動選択: AI エージェント環境では agent、GitHub Actions では github）',
    'out-file': "--reporter html の出力先パス（デフォルト: svelte-vitals-report.html。'-' で標準出力）",
    'fail-on': '指定した重大度以上の検出結果があれば失敗（終了コード 1）: critical | warning | info',
    'min-health': '組み合わせた Health スコアがこの値を下回れば失敗（終了コード 1、0〜100）',
    rules: '有効にするルール ID（カンマ区切り、他はすべて無効）',
    ignore: '無効にするルール ID（カンマ区切り）',
    category: '解析対象カテゴリ（カンマ区切り）: seo | performance | correctness | security | architecture',
    weights: 'カテゴリごとの Health 重み上書き。例: seo=2,performance=1（指定のないカテゴリはデフォルト値 1）',
    score: '組み合わせた Health スコアのみを出力（--min-health と併用してゲートに利用可能）',
    noColor: 'コンソール出力の ANSI カラーを無効化',
    noAnimation: 'インタラクティブ端末での Health スコア発表アニメーションとマスコットを無効化',
    verbose: 'すべての検出結果を上限・グループ化なしで表示（デフォルトはルールごとにグループ化して上限あり）',
    help: 'このヘルプを表示',
    version: 'バージョンを表示'
  },
  docs: {
    json: '機械可読な出力（list のみ）',
    help: 'このヘルプを表示'
  },
  explain: {
    list: '1件を説明する代わりに全ルールを一覧表示',
    json: '機械可読な出力（--list でもルール ID 指定でも利用可）',
    help: 'このヘルプを表示'
  },
  install: {
    client:
      'カンマ区切り: vite-plugin,vite-hooks,claude-skill,cursor-rules,claude-skill-improve,config-file,ci-workflow\n' +
      '（対話式ピッカーをスキップする。ピッカーはこれらをカテゴリごとにグループ化する —\n' +
      'Vite integration、Agent Skills & rules、CI、Config file）\n' +
      'vite-plugin はビルドモードのプラグインを vite.config.{ts,js,mjs} に登録する。vite-hooks は\n' +
      'svelteVitalsHandle フックを src/hooks.server.{ts,js} に組み込み、閲覧に応じてライブダッシュボード\n' +
      'のルート別精度を上げる。--force はこの2つには適用されない — 既存の登録は常にそのまま残る。\n' +
      'claude-skill はエージェントスキルを書き出す（Claude Code、Codex、Cursor 向けに —\n' +
      '.claude/skills/、.agents/skills/、.cursor/skills/ 配下の svelte-vitals/ に）。\n' +
      'cursor-rules は Cursor rules ファイル（.cursor/rules/svelte-vitals.mdc）を書き出す。\n' +
      'どちらも現在のルールセットから生成され、--force で再生成できる。\n' +
      'claude-skill-improve は、毎回実行するプレイブックの代わりにプロジェクト全体を監査して\n' +
      '実装計画を書き出す、読み取り専用の2つ目のエージェントスキルを書き出す（同じ3か所の\n' +
      'improve-svelte/ 以下）。こちらも --force に対応する。\n' +
      'config-file は、すべてのオプションをコメントアウトした svelte-vitals.config.{mjs,ts} の雛形を\n' +
      '生成する。現在の Node が対応していて、プロジェクトが TypeScript 志向に見え（tsconfig.json か\n' +
      'vite.config.ts が存在する）、かつ svelte-vitals が依存関係として宣言されていれば（defineConfig の\n' +
      'import が読み込み時に解決できるか）自動的に .ts（defineConfig 付き）を選び、それ以外は安全な\n' +
      '.mjs をデフォルトにする。既に存在するファイルを --force で再生成できる（拡張子は --force でも\n' +
      '変わらない）。\n' +
      'ci-workflow は .github/workflows/svelte-vitals.yml を生成する。これは `svelte-vitals ci install`\n' +
      'が単体で書き出すのと同じファイルで、他のすべてと同じ実行でセットアップしたい場合に選ぶ。\n' +
      '--force で再生成できる。既存ワークフローのピン留めされたアクションバージョンだけを更新したい\n' +
      '場合は、引き続き `svelte-vitals ci upgrade` を使う。',
    app:
      'モノレポ: vite-plugin/vite-hooks/config-file の書き込み先となる SvelteKit アプリのディレクトリ\n' +
      '（例: --app apps/web）。省略した場合、カレントディレクトリ自体が SvelteKit アプリでなければ、\n' +
      '検出したアプリが1件ならそれを自動的に使用し（通知あり）、複数件なら TTY では選択プロンプトを、\n' +
      '非対話実行では終了コード 2 で --app を求める。他のターゲット（スキル、ci-workflow）は常に\n' +
      'カレントディレクトリに書き込む — モノレポではリポジトリルートがそれらの正しい置き場所のため。',
    yes: '確認プロンプトをスキップ',
    'dry-run': '変更計画を表示し、何も書き込まずに終了',
    force: '既存の svelte-vitals エントリを上書き',
    refresh:
      'ディスク上に既にあるエージェントスキル/ルールファイル（claude-skill / cursor-rules /\n' +
      'claude-skill-improve）を現在のルールセットで再生成する。ディスク上に既にあるファイルだけを\n' +
      '再生成し、新規に作成することはない。--client とは併用できない。',
    help: 'このヘルプを表示'
  },
  ci: {
    force: '既存のワークフローファイルを上書き（install のみ）',
    'dry-run': '計画を表示し、何も書き込まずに終了',
    help: 'このヘルプを表示'
  }
} as const satisfies Record<string, Record<string, string>>;

export function rootHelpJa(optionsSection: string): string {
  return `svelte-vitals — 決定論的な SvelteKit コードヘルスチェッカー（SEO・パフォーマンス・正確性・セキュリティ・アーキテクチャ・アクセシビリティ）

使用方法:
  svelte-vitals [path] [options]
  svelte-vitals docs list        同梱ガイドを一覧表示（docs show <name> で1件表示）
  svelte-vitals explain --list   全ルールを一覧表示（explain <rule-id> で1件説明）
  svelte-vitals install          Vite 連携・エージェントスキル/ルール・設定ファイル・CI をセットアップ
  svelte-vitals ci install       GitHub Actions の PR ゲートを追加（アノテーション + サマリーコメント）
  svelte-vitals ci upgrade       既存ワークフローのピン留めされた @svelte-vitals/action を更新
  svelte-vitals complete <shell> シェル補完スクリプトを出力（bash, zsh, fish, powershell）

${optionsSection}

設定ファイル:
  解析対象ディレクトリの svelte-vitals.config.{mjs,js,ts}。フラグは常に設定ファイルより優先されます。

終了コード:
  0  失敗する検出結果なし
  1  クリティカルな検出結果が存在する（または --fail-on の閾値に到達）
  2  実行エラー（SvelteKit プロジェクトでない / 内部エラー）

AI エージェントの方へ:
  - まず \`svelte-vitals docs list\`、次に \`docs show <name>\` — ガイドはこの CLI に同梱されており、
    実行中のバージョンと必ず一致し、ネットワークも不要です。Web を検索する前にこちらを読んでください。
  - \`--reporter agent\` は失敗した検出結果ごとに場所・具体的な修正方法・受け入れ基準を返します。
    エージェント環境を検出すると自動的に選択されます。\`--reporter json\` は同じ内容の構造化形式です。
  - \`--diff\` は直前に変更した内容にレポートを絞り込み、\`--staged\` は pre-commit ゲート用です。
  - \`svelte-vitals explain <rule-id>\` は、ルールを無効化すると決める前に、そのルールが存在する
    理由と設定可能なオプションを教えてくれます。
  - 実行を通すためだけに \`--update-suppressions\` を使わないでください: 現在のすべての検出結果を
    コミット済みファイルに受け入れ、それら全部の CI ゲートを外してしまいます。検出結果を修正するか、
    \`--diff\` で実行範囲を絞ってください。バックログの受け入れは人間だけが判断すべきことです。
  - 終了コード 2 は決して成功ではありません — 解析が実行されなかったことを意味します。stderr を
    確認してください。
  - 解析は stdout が TTY でない場合は一切プロンプトを出しません: 本来なら確認する場面では、渡すべき
    フラグ名を示して終了コード 2 で終了します。\`install\` は例外で、非対話実行では確認をスキップして
    書き込みを行うため、計画だけを見たい場合は先に \`--dry-run\` を渡してください。`;
}

export function docsHelpJa(optionsSection: string): string {
  return `svelte-vitals docs — ターミナルを離れずに同梱ガイドを読む

使用方法:
  svelte-vitals docs list [--json]     各トピックを1行の説明付きで一覧表示
  svelte-vitals docs show <name>       トピックを表示

${optionsSection}

トピックはこの CLI に同梱されているため、常に実行中のバージョンと一致し、ネットワークも不要です。
完全なドキュメントサイトは https://oekazuma.github.io/svelte-vitals にあります。

\`docs\` はサブコマンドなので、同名のディレクトリより優先されます。\`docs\` という名前のディレクトリを
解析したい場合は \`svelte-vitals ./docs\` と書いてください。`;
}

export function explainHelpJa(optionsSection: string): string {
  return `svelte-vitals explain — ルールの根拠・修正方法・設定可能なオプションを表示する

使用方法:
  svelte-vitals explain --list          全ルール ID をカテゴリごとに一覧表示
  svelte-vitals explain <rule-id>       ルールを1件説明

${optionsSection}

ルール ID は category/kebab-case 形式で、完全一致で照合されます。例: \`svelte-vitals explain seo/ssr-disabled\`。`;
}

export function installHelpJa(optionsSection: string): string {
  return `svelte-vitals install — svelte-vitals の Vite 連携・エージェントスキル/ルール・設定ファイル・CI をセットアップする

使用方法:
  svelte-vitals install [options]

${optionsSection}`;
}

export function ciHelpJa(optionsSection: string, workflowPath: string): string {
  return `svelte-vitals ci — CI 連携をスキャフォールドする

使用方法:
  svelte-vitals ci install [options]
  svelte-vitals ci upgrade [--dry-run]

GitHub Actions ワークフロー（${workflowPath}）を追加し、プルリクエストで \`@svelte-vitals/action\`
GitHub Action を呼び出します: インラインアノテーション、ジョブサマリー、検出結果を記載した sticky な
PR コメントです。

\`ci upgrade\` は既存ワークフロー内のピン留めされた \`@svelte-vitals/action\` の参照だけを、この CLI に
同梱されたピンへ書き換えます。それ以外の行（actions/checkout など他のピンを含む）はそのままです。
最新のピンを取り込むには \`npx svelte-vitals@latest ci upgrade\` を実行してください。

${optionsSection}`;
}
