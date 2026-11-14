<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { Draw } from "@karmageddon/contract";
  import { formatSigned } from "$lib/life";

  let { draw, animate, onDone }: { draw: Draw; animate: boolean; onDone: () => void } = $props();

  let face = $state(1);
  let settled = $state(false);
  let announced = $state(false);
  let opened = false;

  // Before the first paint, a reduced-motion roll shows its face. Later prop changes do not restart it.
  $effect.pre(() => {
    if (opened) {
      return;
    }
    opened = true;
    if (!animate) {
      face = draw.roll;
      settled = true;
      announced = true;
    }
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  let later: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function stop() {
    if (timer !== undefined) {
      clearInterval(timer);
    }
    if (later !== undefined) {
      clearTimeout(later);
    }
  }

  function finish() {
    if (closed) {
      return;
    }
    closed = true;
    onDone();
  }

  onMount(() => {
    if (!animate) {
      return;
    }
    let tick = 0;
    timer = setInterval(() => {
      tick += 1;
      if (tick >= 10) {
        stop();
        face = draw.roll;
        settled = true;
        announced = true;
        later = setTimeout(finish, 450);
        return;
      }
      face = ((draw.roll - 1 + tick * 7) % draw.faces) + 1;
    }, 70);
  });

  onDestroy(() => {
    closed = true;
    stop();
  });

  const reading = $derived(
    announced
      ? `Dé ${draw.roll}. ${draw.modifiers.map((modifier) => `${modifier.label} ${formatSigned(modifier.value)}`).join(", ")}. Total ${draw.total}, seuil ${draw.target}.`
      : "Le dé roule.",
  );
</script>

<div class="flex flex-col items-center" aria-busy={!settled} data-testid="die">
  <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">Dé</p>
  <div
    class="mt-2 grid size-24 place-items-center rounded-2xl border-2 border-foreground/15 bg-background font-serif text-5xl font-semibold tabular-nums shadow-sm"
    aria-hidden="true"
    data-testid="die-face"
  >
    {face}
  </div>
  <p class="sr-only" aria-live="polite">{reading}</p>
  {#if settled}
    <ul class="mt-4 flex max-w-full flex-wrap justify-center gap-2">
      {#each draw.modifiers as modifier, index (index)}
        <li class="rounded-full border px-2.5 py-1 text-sm tabular-nums">
          {modifier.label}
          <span class="font-medium">{formatSigned(modifier.value)}</span>
        </li>
      {/each}
    </ul>
    <p class="mt-3 text-sm tabular-nums" data-testid="die-total">
      Total <span class="font-semibold {draw.total >= draw.target ? 'text-primary' : ''}">{draw.total}</span>
      <span class="text-muted-foreground"> · seuil {draw.target}</span>
    </p>
  {/if}
</div>
