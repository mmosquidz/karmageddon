<script lang="ts">
  import type { BirthCard } from "@karmageddon/contract";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import { flavorLine } from "$lib/copy/fr";
  import {
    COUNTRY_INCOMES,
    SETTLEMENTS,
    formatCoordinates,
    formatDate,
    formatFertility,
    countryName,
    formatLifeExpectancy,
    formatPlace,
    initialOf,
    sexWord,
  } from "$lib/format";
  import Flag from "./Flag.svelte";
  import GameCard from "./GameCard.svelte";
  import WorldMap from "./WorldMap.svelte";

  let { card }: { card: BirthCard } = $props();

  const line = $derived(flavorLine(card.record.seed));
</script>

<GameCard data-testid="birth-card">
  <div class="flex items-start justify-between gap-4">
    <div>
      <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">Acte de naissance</p>
      <h2 class="mt-2 font-serif text-4xl leading-tight font-semibold text-balance sm:text-5xl">
        {card.identity.firstName ?? "Prénom non renseigné"}
      </h2>
      <p class="mt-3 text-lg font-medium tabular-nums">QI {card.identity.iq}</p>
      <p class="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Échelle de Wechsler, moyenne 100, la même pour tous les pays.
      </p>
    </div>
    <div class="seal font-serif" aria-hidden="true">{initialOf(card.identity.firstName)}</div>
  </div>

  <p class="mt-4 font-serif text-lg italic text-muted-foreground">« {line} »</p>

  <p class="mt-6 text-lg leading-relaxed">
    {sexWord(card.identity.sex)} le {formatDate(card.identity.birthDate)}
  </p>
  <p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-serif text-2xl leading-snug text-balance">
    {#if card.place.city}
      <span>{card.place.city},</span>
    {/if}
    <span class="inline-flex items-center gap-2">
      <Flag code={card.place.countryCode} />
      {countryName(card.place.countryCode, card.place.countryNameFallback)}
    </span>
  </p>
  <div class="mt-3 flex flex-wrap items-center gap-2">
    <Badge variant="outline">{SETTLEMENTS[card.place.settlement]}</Badge>
    <span class="font-mono text-xs text-muted-foreground">
      {formatCoordinates(card.place.latitude, card.place.longitude)}
    </span>
  </div>

  <figure class="mt-4">
    <WorldMap
      latitude={card.place.latitude}
      longitude={card.place.longitude}
      label={formatPlace(card)}
    />
  </figure>

  <Separator class="my-6" />

  <h3 class="font-serif text-xl">Au départ</h3>
  <dl class="mt-4 grid gap-4 sm:grid-cols-2">
    <div>
      <dt class="text-xs tracking-wide text-muted-foreground uppercase">Espérance de vie à la naissance</dt>
      <dd class="mt-1 text-lg font-medium">{formatLifeExpectancy(card.context.lifeExpectancyAtBirth)}</dd>
      <dd class="mt-1 text-xs leading-relaxed text-muted-foreground">
        Moyenne du pays, pour ce sexe et cette année. Pas un destin personnel.
      </dd>
    </div>
    <div>
      <dt class="text-xs tracking-wide text-muted-foreground uppercase">Fécondité du pays</dt>
      <dd class="mt-1 text-lg font-medium">{formatFertility(card.context.totalFertility)}</dd>
      <dd class="mt-1 text-xs leading-relaxed text-muted-foreground">Enfants par femme, l’année de la naissance.</dd>
    </div>
    {#if card.context.countryIncome != null}
      <div>
        <dt class="text-xs tracking-wide text-muted-foreground uppercase">Richesse du pays</dt>
        <dd class="mt-1 text-lg font-medium">{COUNTRY_INCOMES[card.context.countryIncome]}</dd>
        <dd class="mt-1 text-xs leading-relaxed text-muted-foreground">
          PIB par habitant du pays, à la naissance ou à la dernière année connue.
        </dd>
      </div>
    {/if}
  </dl>
</GameCard>

<style>
  .seal {
    display: grid;
    width: 4.25rem;
    height: 4.25rem;
    flex: none;
    place-items: center;
    border-radius: 999px;
    background: radial-gradient(circle at 35% 30%, oklch(0.62 0.14 30), oklch(0.4 0.14 28));
    color: oklch(0.97 0.01 85);
    font-size: 1.7rem;
    box-shadow:
      inset 0 0 0 2px oklch(0.78 0.08 75 / 0.45),
      0 8px 16px oklch(0.4 0.08 40 / 0.18);
  }
</style>
