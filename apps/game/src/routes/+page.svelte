<script lang="ts">
  import { onDestroy } from "svelte";
  import { fly } from "svelte/transition";
  import type { BirthCard } from "@karmageddon/contract";
  import { BirthRequestError, requestBirth } from "$lib/api/births";
  import BirthCertificate from "$lib/components/BirthCard.svelte";
  import ErrorNotice from "$lib/components/ErrorNotice.svelte";
  import FamilyPanel from "$lib/components/FamilyPanel.svelte";
  import HomeScreen from "$lib/components/HomeScreen.svelte";
  import LoadingVeil from "$lib/components/LoadingVeil.svelte";
  import { Button } from "$lib/components/ui/button";

  type Phase = "idle" | "loading" | "revealed" | "error";

  let phase = $state<Phase>("idle");
  let card = $state<BirthCard | null>(null);
  let failure = $state<BirthRequestError | null>(null);
  let reduceMotion = $state(false);
  let busy = false;
  let controller: AbortController | null = null;

  $effect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = media.matches;
    const onChange = () => {
      reduceMotion = media.matches;
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  });

  async function born() {
    if (busy) {
      return;
    }
    busy = true;
    phase = "loading";
    failure = null;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    try {
      const next = await requestBirth(current.signal);
      if (current.signal.aborted) {
        return;
      }
      card = next;
      phase = "revealed";
    } catch (error) {
      if (current.signal.aborted) {
        return;
      }
      failure = error instanceof BirthRequestError ? error : new BirthRequestError("network");
      phase = "error";
    } finally {
      if (controller === current) {
        busy = false;
      }
    }
  }

  function again() {
    controller?.abort();
    controller = null;
    busy = false;
    card = null;
    failure = null;
    phase = "idle";
  }

  onDestroy(() => controller?.abort());
</script>

<svelte:head>
  <title>Karmageddon</title>
</svelte:head>

<main>
  {#if phase === "idle"}
    <HomeScreen pending={false} onBorn={born} />
  {:else if phase === "loading"}
    <LoadingVeil />
  {:else if phase === "error" && failure}
    <ErrorNotice error={failure} onRetry={born} />
  {:else if phase === "revealed" && card}
    <div
      class="mx-auto w-full max-w-5xl px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-12"
      in:fly={{ y: reduceMotion ? 0 : 18, duration: reduceMotion ? 0 : 420 }}
    >
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <BirthCertificate {card} />
        <FamilyPanel {card} />
      </div>
      <div class="mt-6 flex justify-center">
        <Button
          variant="outline"
          class="h-11 border-white/25 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
          onclick={again}
          data-testid="new-life"
        >
          Nouvelle vie
        </Button>
      </div>
    </div>
  {/if}
</main>
