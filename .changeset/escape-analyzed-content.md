---
'@svelte-vitals/core': patch
---

Reporter output now neutralizes structural Markdown and terminal escape sequences in strings quoted from the analyzed project (file paths, route ids, and rule messages that embed page content such as `<title>` text or JSON-LD values). The agent and Markdown reporters render an embedded newline, code fence, heading, `[text](url)` link, or bare `<tag>` as inert quoted text instead of live structure — so an analyzed repo can no longer forge report sections or smuggle instruction-looking text into an AI agent's context. The console reporter strips C0 control characters and ANSI/OSC escape sequences from the same analyzed-derived strings, so a hostile route or file name can no longer rewrite the terminal title bar or move the cursor. The GitHub Actions reporter already escaped embedded newlines in workflow-command data; that's unchanged, just verified.

Reports over well-behaved projects are unchanged except for one visible class: a rule message or location containing a literal `<tag>` (e.g. `Missing <title>`) now renders as inline code (`` `<title>` ``) in the Markdown reporter, matching what the agent reporter already did — this also fixes Markdown table cells silently dropping such tags as unrecognized HTML.
