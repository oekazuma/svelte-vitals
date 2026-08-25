<h1>Gallery — a11y ARIA and element defects</h1>

<!-- a11y/invalid-role: not a WAI-ARIA role. -->
<div role="bogus">Bogus role</div>

<!-- a11y/invalid-role: a real role, but abstract — reserved for the spec, never used directly. -->
<div role="widget">Abstract role</div>

<!-- a11y/unknown-aria-attribute: "aria-lable" typo for "aria-label". -->
<div aria-lable="Mislabeled">Typo'd aria attribute</div>

<!-- a11y/disallowed-aria-props: a bare <div> is `generic`, which does not take a name — the label
     the author believes is exposed is not. The Svelte compiler is silent on this one. -->
<div aria-label="Breadcrumb">Home / Gallery</div>

<!-- a11y/disallowed-aria-props: role="button" does not own aria-checked (the compiler also warns). -->
<div role="button" tabindex="0" aria-checked="true">Toggle</div>

<!-- a11y/deprecated-aria: aria-haspopup was deprecated on checkbox in ARIA 1.2 (the compiler reports
     it as unsupported); aria-grabbed is deprecated everywhere (the compiler is silent). -->
<div role="checkbox" tabindex="0" aria-checked="false" aria-haspopup="true">Deprecated on role</div>
<div aria-grabbed="true">Draggable, the old way</div>

<!-- Neither rule: <a aria-label> — `a` is `link` with an href and `generic` without, and only one of
     those prohibits naming, so no implicit judgment is made. -->
<a href="/clean" aria-label="Clean routes">Clean</a>

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

<!-- a11y/use-list: two bullet lines in plain text, outside any <ul>/<ol> — a list that is not marked
     up as one. A single bullet line would not fire: one item is a dash, not a list. -->
<p>• First bullet item outside a real list<br />• Second bullet item, same paragraph</p>

<!-- a11y/placeholder-label-option: required select whose first option isn't a placeholder. -->
<select required>
  <option value="a">A</option>
  <option value="b">B</option>
</select>

<!-- a11y/require-datetime: plain text content isn't machine-readable, and there's no datetime. -->
<time>next week</time>

<!-- a11y/permitted-contents (warning): <ul> admits only <li> and script-supporting elements —
     a <div> child breaks the list structure assistive tech announces. The <li> beside it is fine. -->
<ul>
  <div>Not a list item</div>
  <li>A real list item</li>
</ul>

<!-- a11y/permitted-contents (info): <button> takes phrasing content only; a <div> child is
     spec-invalid but renders fine — the severity split's benign class. A <span> would be clean. -->
<button><div>Block inside a button</div></button>

<!-- a11y/positive-tabindex: tabindex above 0 puts this ahead of every naturally-ordered element,
     hijacking the tab order for the whole page. The tabindex="0" divs above stay silent. -->
<div tabindex="1">Jumps the tab queue</div>

<!-- a11y/no-accesskey: the shortcut key varies by browser and OS, is undiscoverable, and collides
     with assistive-technology bindings (the compiler also warns). -->
<button accesskey="s">Save draft</button>

<!-- a11y/no-autofocus: steals focus at page load. The <dialog>-scoped one below stays silent —
     dialog focusing steps run on show, not on load (the compiler also warns on the first). -->
<input autofocus placeholder="Search the gallery" />
<dialog><input autofocus placeholder="Your name" /></dialog>
