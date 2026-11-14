<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import GameCard from "./GameCard.svelte";

  let { pending, onBorn }: { pending: boolean; onBorn: () => void } = $props();
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
  <GameCard class="w-full">
    <div class="flex flex-col items-center px-1 py-4 text-center sm:px-4 sm:py-6">
      <p class="text-xs font-medium tracking-[0.28em] text-muted-foreground uppercase">Simulation de vie</p>
      <h1 class="mt-3 font-serif text-5xl font-semibold tracking-tight text-balance">Karmageddon</h1>
      <p class="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">
        Le monde a déjà tiré votre nom, votre pays et votre famille. Il ne reste qu’à naître.
      </p>
      <Button
        class="mt-8 h-12 px-10 text-base"
        size="lg"
        disabled={pending}
        onclick={onBorn}
        data-testid="born-button"
      >
        Naître
      </Button>
      <p class="mt-6 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Les tirages restent du côté du moteur. Ici, pas de compte, pas de sauvegarde : une vie à la fois.
      </p>
    </div>
  </GameCard>
</div>
