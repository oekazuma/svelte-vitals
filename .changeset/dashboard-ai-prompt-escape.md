---
'@svelte-vitals/core': patch
---

The dashboard's Copy-AI-prompt output now neutralizes newlines, links, and backtick runs coming from the analyzed project. Finding fields (title, route, location, recommendation, fix description, docs URL) are analyzed-repo strings that get pasted into a coding agent; a newline could previously open a fake new bullet line, and a triple-backtick run in a fix snippet could previously close the code fence early, letting the rest of the field read as free-standing instructions to the agent instead of quoted finding data.
