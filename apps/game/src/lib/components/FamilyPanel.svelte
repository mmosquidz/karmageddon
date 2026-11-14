<script lang="ts">
  import type { BirthCard, Parent, Sex } from "@karmageddon/contract";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import {
    completedYears,
    formatAgeAtBirth,
    formatBornIn,
    formatDate,
    habitatLabel,
    sentence,
    siblingRole,
  } from "$lib/format";
  import { occupationLabel } from "$lib/labels/occupations";
  import GameCard from "./GameCard.svelte";

  let { card }: { card: BirthCard } = $props();

const parents = $derived([
  { role: "mother" as const, label: "Mère", parent: card.family.mother },
  { role: "father" as const, label: "Père", parent: card.family.father },
]);

  function job(parent: Parent): string {
    if (parent.work == null) {
      return "Profession non renseignée";
    }
    return sentence(occupationLabel(parent.work));
  }

  function deathLine(sex: Sex): string {
    return sex === "female" ? "Décédée avant la naissance." : "Décédé avant la naissance.";
  }
</script>

<GameCard>
  <p class="text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase">Famille</p>
  <h2 class="mt-2 font-serif text-3xl font-semibold">Déjà autour de vous</h2>
  <div class="mt-4 flex flex-wrap items-center gap-2">
    <Badge variant="outline">{habitatLabel(card.family.habitat)}</Badge>
    <p class="text-xs text-muted-foreground">Au sens des enquêtes sur l’emploi.</p>
  </div>

  <ul class="mt-6 space-y-5">
    {#each parents as person (person.role)}
      <li>
        <p class="text-xs tracking-wide text-muted-foreground uppercase">{person.label}</p>
        <p class="mt-1 font-serif text-xl">
          {person.parent.firstName ?? "Prénom non renseigné"}
        </p>
        <p class="mt-1 text-sm leading-relaxed">
          {person.parent.ageAtBirth} ans,
          {formatBornIn(person.role, person.parent.birthCountryCode, person.parent.birthCountryCode)}.
          {job(person.parent)}.
        </p>
        {#if person.parent.diedBeforeBirth}
          <p class="mt-1 text-sm text-muted-foreground">{deathLine(person.role === "mother" ? "female" : "male")}</p>
        {/if}
      </li>
    {/each}
  </ul>

  {#if card.elderSiblings.length > 0}
    <Separator class="my-6" />
    <h3 class="font-serif text-xl">Aînés</h3>
    <ul class="mt-4 space-y-4">
      {#each card.elderSiblings as sibling, index (sibling.birthDate + index)}
        <li>
          <p class="font-medium">{sibling.firstName ?? "Prénom non renseigné"}</p>
          <p class="text-sm leading-relaxed text-muted-foreground">
            {siblingRole(sibling.sex)} · né{sibling.sex === "female" ? "e" : ""} le {formatDate(sibling.birthDate)} ·
            {formatAgeAtBirth(completedYears(sibling.birthDate, card.identity.birthDate))} au moment de cette naissance
          </p>
          {#if sibling.diedBeforeBirth}
            <p class="text-sm text-muted-foreground">{deathLine(sibling.sex)}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</GameCard>
