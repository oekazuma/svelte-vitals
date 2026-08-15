<h1>Gallery — a11y landmark defects</h1>

<!-- a11y/duplicate-landmark: a second <main>, alongside the layout's <main id="a11y-shell">,
     gives this route two main landmarks. -->
<main>
  <p>This page's own main, next to the layout's.</p>
</main>

<!-- a11y/top-level-landmark: composed through the layout's {@render children()}, so this
     <aside> renders nested inside the layout's <main> rather than at the top level. -->
<aside role="complementary">
  <p>Sidebar content nested inside a landmark.</p>
</aside>
