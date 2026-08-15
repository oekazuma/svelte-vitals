<!--
  architecture/prop-count: 7 destructured props, one over the default max of 6.
-->
<script lang="ts">
  let { title, subtitle, author, date, tags, thumbnail, variant } = $props();
</script>

<article>
  <h2>{title}</h2>
  <p>{subtitle}</p>
  <p>By {author} on {date}</p>
  <p>{tags.join(', ')}</p>
  <img src={thumbnail} alt={title} />
  <span>{variant}</span>
</article>
