---
'svelte-vitals': patch
'@svelte-vitals/vite': patch
---

Source analysis now understands the `svead` meta package, as it already does `svelte-meta-tags` and `svelte-seo`. `<Head seo_config={…}>` counts for `<title>`, the description, the canonical link, `og:title`, `og:description`, `og:url` and `twitter:card`, and for `og:image` when the config sets `open_graph_image`. A config it cannot read inline (a variable, or an object with a spread) counts for all of them as dynamic. `<SchemaOrg>` counts as a dynamic JSON-LD block. Routes that render svead's `<Head>` no longer report these tags as missing. The model follows svead 0.0.12 and later, where the Open Graph tags and `twitter:card` render whether or not `open_graph_image` is set; the per-prop `<Head title url image>` API from before 0.0.10 is read too, with its Open Graph tags and `twitter:card` counted as dynamic when `image` is passed. Because svead is now read directly, a `Head` entry in `metaComponents` no longer applies to it.
