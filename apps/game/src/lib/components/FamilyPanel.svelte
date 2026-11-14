<script lang="ts">
  import type { BirthCard, Parent, Sex } from "@karmageddon/contract";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import {
    completedYears,
    formatAgeAtBirth,
    formatBornIn,
    formatCentile,
    formatDate,
    habitatLabel,
    householdSentence,
    sentence,
    siblingRole,
  } from "$lib/format";
  import { occupationLabel } from "$lib/labels/occupations";
  import GameCard from "./GameCard.svelte";

  let { card }: { card: BirthCard } = $props();

  type Role = "father" | "mother" | "brother" | "sister";

  type Member = {
    key: string;
    role: Role;
    roleLabel: string;
    name: string;
    iq: number;
    died: boolean;
    adult: boolean;
    self: boolean;
    female: boolean;
  };

  const members = $derived([
    member("father", "Père", card.family.father.firstName, card.family.father.iq, card.family.father.diedBeforeBirth, true, false),
    member("mother", "Mère", card.family.mother.firstName, card.family.mother.iq, card.family.mother.diedBeforeBirth, true, false),
    ...card.elderSiblings.map((sibling, index) =>
      member(
        sibling.sex === "female" ? "sister" : "brother",
        sibling.sex === "female" ? "Sœur" : "Frère",
        sibling.firstName,
        sibling.iq,
        sibling.diedBeforeBirth,
        false,
        false,
        `${sibling.birthDate}-${index}`,
      ),
    ),
    member(
      card.identity.sex === "female" ? "sister" : "brother",
      "Vous",
      card.identity.firstName,
      card.identity.iq,
      false,
      false,
      true,
      "self",
    ),
  ]);

  const line = $derived(householdSentence(card));
  const wealth = $derived(card.context.parentsWealthPercentile);

  const parents = $derived([
    { role: "father" as const, label: "Père", parent: card.family.father },
    { role: "mother" as const, label: "Mère", parent: card.family.mother },
  ]);

  function member(
    role: Role,
    roleLabel: string,
    firstName: string | null,
    iq: number,
    died: boolean,
    adult: boolean,
    self: boolean,
    key: string = role,
  ): Member {
    const female = role === "mother" || role === "sister";
    return {
      key,
      role,
      roleLabel,
      name: firstName ?? (self ? "Vous" : roleLabel),
      iq,
      died,
      adult,
      self,
      female,
    };
  }

  function described(person: Member): string {
    const who = person.self
      ? person.name === "Vous"
        ? "Vous"
        : `Vous, ${person.name}`
      : person.name === person.roleLabel
        ? person.roleLabel
        : `${person.roleLabel}, ${person.name}`;
    const death = person.died ? `, ${person.female ? "décédée" : "décédé"} avant la naissance` : "";
    return `${who}, QI ${person.iq}${death}`;
  }

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

{#snippet silhouette(female: boolean)}
  <svg viewBox="0 0 64 96" aria-hidden="true">
    <circle cx="32" cy="16" r="12" />
    <path d={female ? "M22 36h20L54 88H10z" : "M14 62h10v26h16V62h10L46 36H18z"} />
  </svg>
{/snippet}

<GameCard data-testid="family-panel">
  <p class="text-xs font-medium tracking-[0.22em] text-[oklch(0.42_0.1_165)] uppercase">La famille</p>

  <ul class="household" aria-label="Composition du foyer" data-testid="household">
    {#each members as person (person.key)}
      <li
        class:adult={person.adult}
        class:mother={person.role === "mother"}
        class:self={person.self}
        class:gone={person.died}
        aria-label={described(person)}
      >
        {@render silhouette(person.female)}
        <span class="name">{person.name}</span>
        <span class="iq">QI {person.iq}</span>
        {#if person.died}
          <span class="iq">{person.female ? "Décédée" : "Décédé"}</span>
        {/if}
      </li>
    {/each}
  </ul>

  <p class="mt-4 text-sm leading-relaxed" data-testid="household-sentence">{line}</p>

  <div class="mt-5" data-testid="household-wealth">
    <p class="text-xs font-medium tracking-[0.22em] text-[oklch(0.42_0.1_165)] uppercase">Patrimoine du foyer</p>
    <p class="mt-2 font-serif text-2xl font-semibold">
      {wealth == null ? "Non renseigné" : formatCentile(wealth)}
    </p>
    <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
      Rang du patrimoine du foyer dans le pays, à la naissance.
    </p>
  </div>

  <Separator class="my-6" />

  <div class="flex flex-wrap items-center gap-2">
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

<style>
  .household {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem 0.35rem;
    margin: 1.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .household li {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 4.75rem;
    max-width: 6.5rem;
    color: var(--foreground);
    text-align: center;
  }

  .household svg {
    display: block;
    width: 1.55rem;
    height: 2.2rem;
    fill: currentColor;
  }

  .household .adult svg {
    width: 1.9rem;
    height: 2.75rem;
  }

  .household .mother {
    margin-right: 0.85rem;
  }

  .household .name,
  .household .iq {
    margin-top: 0.15rem;
    font-size: 0.72rem;
    line-height: 1.15;
  }

  .household .name {
    overflow-wrap: break-word;
  }

  .household .iq {
    margin-top: 0;
    color: var(--muted-foreground);
    font-variant-numeric: tabular-nums;
  }

  .household .self {
    color: oklch(0.42 0.1 165);
  }

  .household .self .name,
  .household .self .iq {
    color: oklch(0.42 0.1 165);
    font-weight: 650;
  }

  .household .gone {
    opacity: 0.45;
  }
</style>
