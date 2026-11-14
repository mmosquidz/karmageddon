<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type { BirthCard, LifeCard, LifeChoice, LifeStatus, Outcome, Sex } from "@karmageddon/contract";
  import { LifeRequestError, requestTurn, sendChoice, sendReroll, type LifeErrorCode } from "$lib/api/lives";
  import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { lifeErrorMessage } from "$lib/copy/fr";
  import { formatAge, formatWealth, GAUGES, situation, statusChanges } from "$lib/life";
  import { formatCentile, householdSentence } from "$lib/format";
  import DrawReveal from "./DrawReveal.svelte";
  import GameCard from "./GameCard.svelte";
  import HouseholdRail from "./HouseholdRail.svelte";

  let {
    lifeId,
    firstName,
    sex,
    birth,
    onNewLife,
  }: { lifeId: string; firstName: string | null; sex: Sex; birth: BirthCard; onNewLife: () => void } = $props();

  type View =
    | { kind: "loading" }
    | { kind: "card"; card: LifeCard; sending: string | null }
    | {
        kind: "outcome";
        card: LifeCard;
        choice: LifeChoice;
        /** The life before this choice, so a reroll is compared with that and not with the discarded roll. */
        before: LifeStatus;
        text: string;
        changes: string[];
        draw?: Outcome["draw"];
        reroll?: Outcome["reroll"];
        revealed: boolean;
        sending: boolean;
        serial: number;
      }
    | { kind: "end" }
    | { kind: "error"; code: LifeErrorCode };

  let view = $state<View>({ kind: "loading" });
  let serial = 0;
  let status = $state<LifeStatus | null>(null);
  let heading = $state<HTMLElement | null>(null);
  /** One request at a time: a second click while one runs does nothing. */
  let busy = false;
  let controller: AbortController | null = null;

  const foyerLine = $derived(householdSentence(birth));
  const foyerRank = $derived(birth.context.parentsWealthPercentile);

  /** Runs one request. Its answer is dropped if the screen went away meanwhile. */
  async function run(request: (signal: AbortSignal) => Promise<View>) {
    if (busy) {
      return;
    }
    busy = true;
    controller?.abort();
    const current = new AbortController();
    controller = current;
    try {
      const next = await request(current.signal);
      if (current.signal.aborted) {
        return;
      }
      view = next;
      await tick();
      heading?.focus();
    } catch (error) {
      if (current.signal.aborted) {
        return;
      }
      view = { kind: "error", code: error instanceof LifeRequestError ? error.code : "network" };
    } finally {
      if (controller === current) {
        busy = false;
      }
    }
  }

  /** Also the way out of an error: asked again, the BFF shows the card still waiting, if any. */
  function nextYear() {
    void run(async (signal) => {
      view = { kind: "loading" };
      const turn = await requestTurn(lifeId, { signal });
      status = turn.status;
      return turn.kind === "card" ? { kind: "card", card: turn.card, sending: null } : { kind: "end" };
    });
  }

  function reduceMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function showOutcome(card: LifeCard, choice: LifeChoice, before: LifeStatus, outcome: Outcome): View {
    serial += 1;
    const drawn = outcome.draw !== undefined;
    return {
      kind: "outcome",
      card,
      choice,
      before,
      text: outcome.text,
      changes: statusChanges(before, outcome.status, sex),
      draw: outcome.draw,
      reroll: outcome.reroll,
      revealed: !drawn || reduceMotion(),
      sending: false,
      serial,
    };
  }

  function reveal() {
    if (view.kind !== "outcome" || view.revealed) {
      return;
    }
    view = { ...view, revealed: true };
    void tick().then(() => heading?.focus());
  }

  function choose(choice: LifeChoice) {
    if (view.kind !== "card" || status === null) {
      return;
    }
    const card = view.card;
    const before = status;
    void run(async (signal) => {
      view = { kind: "card", card, sending: choice.id };
      const outcome = await sendChoice(lifeId, choice.id, { signal });
      status = outcome.status;
      return showOutcome(card, choice, before, outcome);
    });
  }

  function reroll() {
    if (view.kind !== "outcome" || view.reroll === undefined || !view.revealed) {
      return;
    }
    const current = view;
    void run(async (signal) => {
      view = { ...current, sending: true };
      const outcome = await sendReroll(lifeId, { signal });
      status = outcome.status;
      return showOutcome(current.card, current.choice, current.before, outcome);
    });
  }

  onMount(nextYear);
  onDestroy(() => controller?.abort());
</script>

<div class="mx-auto w-full max-w-6xl px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:py-12">
  <!-- Mobile : le foyer reste visible sans faire défiler — un résumé ancré vers le détail. -->
  <div class="mb-4 lg:hidden" data-testid="household-summary">
    <GameCard class="border-dashed">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">Foyer d’origine</p>
          <p class="mt-1 truncate text-sm">{foyerLine} {foyerRank == null ? "" : `· ${formatCentile(foyerRank)}`}</p>
        </div>
        <a href="#foyer" class="shrink-0 text-sm font-medium text-primary underline underline-offset-4">
          Voir le foyer
        </a>
      </div>
    </GameCard>
  </div>

  <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,19rem)]">
    <aside aria-label="Votre situation" class="order-1 min-w-0">
      <div class="lg:sticky lg:top-6">
        <GameCard data-testid="life-status">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 class="font-serif text-3xl font-semibold text-balance">{firstName ?? "Vous"}</h1>
            <p class="font-serif text-2xl" aria-live="polite">{status ? formatAge(status.age) : "…"}</p>
          </div>
          {#if status}
            <dl class="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-1 xl:grid-cols-2">
              {#each GAUGES as gauge (gauge.key)}
                {@const value = Math.round(status[gauge.key])}
                <div>
                  <div class="flex justify-between text-sm">
                    <dt id="gauge-{gauge.key}">{gauge.label}</dt>
                    <dd class="font-medium tabular-nums">{value}</dd>
                  </div>
                  <div
                    class="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                    role="meter"
                    aria-labelledby="gauge-{gauge.key}"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={value}
                  >
                    <div
                      class="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none {value < 25
                        ? 'bg-destructive'
                        : 'bg-primary'}"
                      style="width: {value}%"
                    ></div>
                  </div>
                </div>
              {/each}
            </dl>
            <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span class="text-muted-foreground">Patrimoine</span>
              <span class="mr-2 font-medium tabular-nums">{formatWealth(status.wealth)}</span>
              {#each situation(status, sex) as part (part)}
                <Badge variant="outline">{part}</Badge>
              {/each}
            </div>
          {/if}
        </GameCard>
      </div>
    </aside>

    <div class="order-2 min-w-0">
      <GameCard data-testid="life-card">
        <div class="min-h-56 px-1 py-2 sm:px-3">
          {#if view.kind === "loading"}
            <p class="py-16 text-center text-muted-foreground" role="status">Une année passe…</p>
          {:else if view.kind === "card"}
            <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">{view.card.type.label}</p>
            <h2 class="mt-2 font-serif text-2xl leading-snug font-semibold text-balance outline-none" tabindex="-1" bind:this={heading}>
              {view.card.title}
            </h2>
            <div class="mt-6 grid gap-3">
              {#each view.card.choices as choice (choice.id)}
                <Button
                  class="h-auto min-h-11 justify-start px-4 py-2.5 text-left text-base whitespace-normal"
                  variant={view.sending === choice.id ? "default" : "outline"}
                  disabled={view.sending !== null}
                  aria-busy={view.sending === choice.id}
                  onclick={() => choose(choice)}
                  data-testid="choice"
                >
                  {choice.label}
                </Button>
              {/each}
            </div>
          {:else if view.kind === "outcome"}
            <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">{view.card.type.label}</p>
            <p class="mt-2 text-sm text-muted-foreground">{view.card.title}</p>
            <p class="mt-1 text-sm font-medium">{view.choice.label}</p>
            {#if view.draw}
              <div class="mt-6">
                {#key view.serial}
                  <DrawReveal draw={view.draw} animate={!view.revealed} onDone={reveal} />
                {/key}
              </div>
            {/if}
            <h2
              class="outline-none {view.revealed
                ? 'mt-4 font-serif text-2xl leading-snug text-balance'
                : 'sr-only'}"
              tabindex="-1"
              bind:this={heading}
              data-testid="outcome"
            >
              {view.revealed ? view.text : "Le dé roule"}
            </h2>
            {#if view.revealed && view.changes.length > 0}
              <ul class="mt-4 flex flex-wrap gap-2" aria-label="Ce qui a changé">
                {#each view.changes as change (change)}
                  <li><Badge variant="secondary">{change}</Badge></li>
                {/each}
              </ul>
            {/if}
            <div class="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button class="h-11 px-6" disabled={!view.revealed || view.sending} onclick={nextYear} data-testid="next-year">
                Année suivante
              </Button>
              {#if view.reroll}
                <Button
                  variant="outline"
                  class="h-11 px-6"
                  disabled={!view.revealed || view.sending}
                  aria-busy={view.sending}
                  onclick={reroll}
                  data-testid="reroll"
                >
                  Retirer · {view.reroll.cost} karma
                </Button>
              {/if}
            </div>
          {:else if view.kind === "end"}
            <h2 class="font-serif text-2xl font-semibold outline-none" tabindex="-1" bind:this={heading}>
              La partie s’arrête ici
            </h2>
            <p class="mt-3 leading-relaxed text-muted-foreground">
              {status ? `À ${formatAge(status.age)}, ` : ""}le jeu pose les cartes. La suite, il ne sait pas encore la raconter.
            </p>
            <Button class="mt-6 h-11 px-6" onclick={onNewLife}>Nouvelle vie</Button>
          {:else if view.kind === "error"}
            <div role="alert">
              <Alert variant="destructive">
                <AlertTitle>Un accroc</AlertTitle>
                <AlertDescription>{lifeErrorMessage(view.code)}</AlertDescription>
              </Alert>
              {#if view.code === "lost"}
                <Button class="mt-6 h-11 px-6" onclick={onNewLife}>Renaître</Button>
              {:else}
                <Button class="mt-6 h-11 px-6" onclick={nextYear} data-testid="life-retry">
                  {view.code === "card" ? "Année suivante" : "Réessayer"}
                </Button>
              {/if}
            </div>
          {/if}
        </div>
      </GameCard>

      {#if view.kind !== "end" && !(view.kind === "error" && view.code === "lost")}
        <div class="mt-6 flex justify-center">
          <Button
            variant="outline"
            class="h-11 border-white/25 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
            onclick={onNewLife}
            data-testid="new-life"
          >
            Nouvelle vie
          </Button>
        </div>
      {/if}
    </div>

    <aside aria-label="Foyer d’origine" id="foyer" class="order-3 min-w-0 scroll-mt-24">
      <div class="lg:sticky lg:top-6">
        <HouseholdRail card={birth} />
      </div>
    </aside>
  </div>
</div>
