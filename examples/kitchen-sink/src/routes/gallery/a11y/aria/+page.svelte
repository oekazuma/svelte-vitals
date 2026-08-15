<h1>Gallery — a11y ARIA and element defects</h1>

<!-- a11y/invalid-role: not a WAI-ARIA role. -->
<div role="bogus">Bogus role</div>

<!-- a11y/invalid-role: a real role, but abstract — reserved for the spec, never used directly. -->
<div role="widget">Abstract role</div>

<!-- a11y/unknown-aria-attribute: "aria-lable" typo for "aria-label". -->
<div aria-lable="Mislabeled">Typo'd aria attribute</div>

<!-- a11y/required-aria-props: role="checkbox" needs aria-checked to announce its state. -->
<div role="checkbox">Check me</div>

<!-- a11y/invalid-aria-value: aria-hidden is boolean-typed; "yes" isn't true/false. -->
<div aria-hidden="yes">Wrong boolean value</div>

<!-- a11y/interactive-nesting: <button> nested inside the interactive <a href>. -->
<a href="/x"><button>Nested button</button></a>

<!-- a11y/accessible-name: no text, aria-label, or title. -->
<button></button>

<!-- a11y/label-has-control: no for attribute and no wrapped control. -->
<label>Just some text</label>

<!-- a11y/use-list: bullet character in plain text, outside any <ul>/<ol>. -->
<p>• First bullet item outside a real list</p>

<!-- a11y/placeholder-label-option: required select whose first option isn't a placeholder. -->
<select required>
  <option value="a">A</option>
  <option value="b">B</option>
</select>

<!-- a11y/require-datetime: plain text content isn't machine-readable, and there's no datetime. -->
<time>next week</time>
