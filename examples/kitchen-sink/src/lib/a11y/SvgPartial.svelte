<!-- Neither a11y/deprecated-element nor a11y/deprecated-attr: this component declares the SVG
     namespace, so its <style type> is the SVG element even with no <svg> ancestor of its own. -->
<svelte:options namespace="svg" />

<g>
  <style type="text/css">
    .mark {
      fill: currentColor;
    }
  </style>
  <circle class="mark" cx="12" cy="12" r="6" />
</g>
