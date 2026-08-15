<script lang="ts">
  import JsonLd from '$lib/clean/jsonld/FormPage.svelte';

  let name = $state('');
  let plan = $state('');
  let subscribe = $state(false);

  // Spread attributes: statically unknowable, so a11y/label-has-control and
  // a11y/require-datetime must skip these elements rather than flag them.
  const subscribeLabelAttrs = { for: 'clean-form-subscribe' };
  const memberSinceAttrs = { datetime: '2026-03-03' };
</script>

<svelte:head>
  <title>Clean canary: form — svelte-vitals kitchen sink</title>
  <meta
    name="description"
    content="A contact form pairing every label with its control and a required select with a placeholder option, kept finding-free."
  />
  <link rel="canonical" href="https://example.com/clean/form" />
  <meta property="og:title" content="Clean canary: form — svelte-vitals kitchen sink" />
  <meta
    property="og:description"
    content="A contact form pairing every label with its control and a required select with a placeholder option, kept finding-free."
  />
  <meta property="og:image" content="https://example.com/og.png" />
  <meta property="og:url" content="https://example.com/clean/form" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<JsonLd />

<h1>Contact form</h1>
<p>Every control is paired with a label, and the required select opens on a placeholder option.</p>

<form>
  <div>
    <label for="clean-form-name">Full name</label>
    <input id="clean-form-name" type="text" bind:value={name} aria-required="true" />
  </div>

  <div>
    <label for="clean-form-plan">Plan</label>
    <select id="clean-form-plan" required bind:value={plan} aria-describedby="clean-form-plan-hint">
      <option value="">Choose a plan</option>
      <option value="starter">Starter</option>
      <option value="pro">Pro</option>
    </select>
    <p id="clean-form-plan-hint">Billed monthly, cancel any time.</p>
  </div>

  <div>
    <input id="clean-form-subscribe" type="checkbox" bind:checked={subscribe} />
    <label {...subscribeLabelAttrs}>Email me about updates</label>
  </div>

  <p>Renews on <time datetime="2026-08-16">Aug 16</time>.</p>
  <p>Member since <time {...memberSinceAttrs}>March 3</time>.</p>

  <button type="submit">Submit</button>
</form>
