<!--
  See [Legacy widget](https://example.com/kitchen-sink/src/lib/architecture/Widget/Legacy.svelte)
  for the previous implementation. architecture/doc-link-target: svelte-vitals.config.mjs
  declares https://example.com/kitchen-sink/ as a urlRoot, and no such file exists under src/.
-->
<script lang="ts">
  import Card from '$lib/architecture/Card/Card.svelte';
  // architecture/private-scope-import: Card/private is declared private to Card/ in
  // svelte-vitals.config.mjs — this route sits outside that scope.
  import Secret from '$lib/architecture/Card/private/Secret.svelte';
  import OversizedPanel from '$lib/architecture/OversizedPanel.svelte';
  import WidePropsCard from '$lib/architecture/WidePropsCard.svelte';
  // architecture/route-component-import: +page.svelte is rendered by SvelteKit, not
  // meant to be imported by another component — this one gets no `data`/`params`.
  import SeoDefectsPage from '../seo/+page.svelte';
</script>

<h1>Architecture defects</h1>

<Card>
  <p>Card is a properly-shaped unit (has Card.svelte); its badly-placed siblings are what trip the rules below.</p>
</Card>

<Secret />

<WidePropsCard
  title="Wide-props card"
  subtitle="Seven destructured props"
  author="Kitchen Sink"
  date="2026-08-16"
  tags={['architecture', 'props']}
  thumbnail="/img/thumb.jpg"
  variant="default"
/>

<OversizedPanel title="Oversized panel" />

<details>
  <summary>Route entry imported directly (architecture/route-component-import)</summary>
  <SeoDefectsPage />
</details>
