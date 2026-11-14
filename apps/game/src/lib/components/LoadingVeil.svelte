<script lang="ts">
  import GameCard from "./GameCard.svelte";
</script>

<div
  class="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-10"
  role="status"
  aria-live="polite"
>
  <GameCard class="w-full">
    <div class="flex flex-col items-center px-2 py-8 text-center">
      <div class="seal seal-wait" aria-hidden="true">…</div>
      <h1 class="mt-6 font-serif text-3xl font-semibold">On vous cherche une place</h1>
      <p class="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Le registre feuillette le monde. Un premier réveil peut prendre quelques secondes. Le sort n’aime pas être
        pressé.
      </p>
    </div>
  </GameCard>
</div>

<style>
  .seal {
    display: grid;
    width: 4.5rem;
    height: 4.5rem;
    place-items: center;
    border-radius: 999px;
    background: radial-gradient(circle at 35% 30%, oklch(0.62 0.14 30), oklch(0.4 0.14 28));
    color: oklch(0.97 0.01 85);
    font-family: Fraunces, serif;
    font-size: 1.4rem;
    box-shadow: inset 0 0 0 2px oklch(0.75 0.08 70 / 0.4);
  }

  .seal-wait {
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      transform: scale(0.94);
      opacity: 0.75;
    }
  }
</style>
