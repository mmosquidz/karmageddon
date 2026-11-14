<script lang="ts">
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { errorMessage } from "$lib/copy/fr";
  import type { BirthRequestError } from "$lib/api/births";
  import GameCard from "./GameCard.svelte";

  let { error, onRetry }: { error: BirthRequestError; onRetry: () => void } = $props();
</script>

<div class="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-10" role="alert">
  <GameCard class="w-full">
    <div class="px-1 py-4 sm:px-3">
      <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">Registre</p>
      <h1 class="mt-2 font-serif text-3xl font-semibold">La naissance n’a pas abouti</h1>
      <Alert class="mt-5" variant="destructive">
        <AlertTitle>À réessayer</AlertTitle>
        <AlertDescription>{errorMessage(error)}</AlertDescription>
      </Alert>
      <Button class="mt-6 h-11 px-6" onclick={onRetry} data-testid="error-retry">Réessayer</Button>
    </div>
  </GameCard>
</div>
