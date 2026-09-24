<!-- Legacy mode: a member write on an `export let` prop is an invalidating assignment, and
     `tags.push(x)` followed by a reassignment is the documented way to update an array prop. -->
<script lang="ts">
  export let card: { title: string; opened: number };
  export let tags: string[];

  function open() {
    card.opened += 1;
  }

  interface Flags {
    pinned?: boolean;
  }

  export let flags: Flags = { pinned: true };

  function unpin() {
    delete flags.pinned;
    flags = { ...flags };
  }

  function addTag() {
    tags.push(`tag-${tags.length + 1}`);
    tags = [...tags];
  }
</script>

<article>
  <h2>{card.title}</h2>
  <p>Opened {card.opened} times, {tags.length} tags.</p>
  <button type="button" on:click={open}>Open</button>
  <button type="button" on:click={addTag}>Add tag</button>
  <button type="button" on:click={unpin}>Unpin{flags.pinned ? '' : 'ned'}</button>
</article>
