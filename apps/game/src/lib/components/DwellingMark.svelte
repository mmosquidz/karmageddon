<script lang="ts">
  import type { Dwelling } from "@karmageddon/contract";
  import { DWELLING_GLYPHS, dwellingLabel } from "$lib/dwelling";

  let { dwelling }: { dwelling: Dwelling } = $props();

  const label = $derived(dwellingLabel(dwelling));
</script>

<div class="flex items-center gap-2.5" data-testid="dwelling">
  <svg class="mark" viewBox="0 0 32 32" aria-hidden="true">
    <path fill-rule="evenodd" d={DWELLING_GLYPHS[dwelling]} />
  </svg>
  <div class="min-w-0">
    <p class="text-sm leading-snug font-medium">{label}</p>
    <p class="text-xs leading-snug text-muted-foreground">Foyer à la naissance</p>
  </div>
</div>

<style>
  .mark {
    width: 2.35rem;
    height: 2.35rem;
    flex: none;
    fill: oklch(0.42 0.1 165);
  }
</style>
