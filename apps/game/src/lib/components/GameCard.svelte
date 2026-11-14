<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { Card, CardContent } from "$lib/components/ui/card";

  let {
    children,
    class: className = "",
    ...rest
  }: { children: Snippet; class?: string } & HTMLAttributes<HTMLDivElement> = $props();
</script>

<Card class="paper shadow-2xl ring-foreground/10 {className}" {...rest}>
  <CardContent class="relative">
    {@render children()}
  </CardContent>
</Card>
