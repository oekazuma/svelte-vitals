<!-- `time = time.set(...)` reassigns the prop from an immutable value's method; nothing is mutated. -->
<script lang="ts">
  class Time {
    readonly hour: number;
    constructor(hour: number) {
      this.hour = hour;
    }
    set(next: { hour: number }): Time {
      return new Time(next.hour);
    }
  }

  let { time = new Time(9) }: { time?: Time } = $props();
</script>

<p>Hour {time.hour}</p>
<button type="button" onclick={() => (time = time.set({ hour: 15 }))}>Jump to 15:00</button>
