<script lang="ts">
  import type { BirthCard } from "@karmageddon/contract";
  import { Badge } from "$lib/components/ui/badge";
  import { formatCentile, habitatLabel, householdSentence, sentence } from "$lib/format";
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
    member(
      "father",
      "Père",
      card.family.father.firstName,
      card.family.father.iq,
      card.family.father.diedBeforeBirth,
      true,
      false,
    ),
    member(
      "mother",
      "Mère",
      card.family.mother.firstName,
      card.family.mother.iq,
      card.family.mother.diedBeforeBirth,
      true,
      false,
    ),
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

  function jobOf(work: BirthCard["family"]["father"]["work"]): string {
    if (work == null) {
      return "Profession non renseignée";
    }
    return sentence(occupationLabel(work));
  }
</script>

{#snippet silhouette(female: boolean)}
  <svg viewBox="0 0 64 96" aria-hidden="true">
    <circle cx="32" cy="16" r="12" />
    <path d={female ? "M22 36h20L54 88H10z" : "M14 62h10v26h16V62h10L46 36H18z"} />
  </svg>
{/snippet}

<GameCard data-testid="household-rail">
  <p class="text-xs font-medium tracking-[0.22em] text-[oklch(0.42_0.1_165)] uppercase">Foyer d’origine</p>

  <ul class="household" aria-label="Composition du foyer" data-testid="household">
    {#each members as person (person.key)}
      <li
        class:adult={person.adult}
        class:mother={person.role === "mother"}
        class:self={person.self}
        class:gone={person.died}
        aria-label={described(person)}
        title={described(person)}
      >
        {@render silhouette(person.female)}
        <span class="name">{person.name}</span>
        <span class="iq">QI {person.iq}</span>
      </li>
    {/each}
  </ul>

  <p class="mt-3 text-sm leading-relaxed" data-testid="household-sentence">{line}</p>

  <div class="mt-4" data-testid="household-wealth">
    <p class="text-xs font-medium tracking-[0.22em] text-[oklch(0.42_0.1_165)] uppercase">
      Patrimoine du foyer
    </p>
    <p class="mt-2 font-serif text-2xl font-semibold">
      {wealth == null ? "Non renseigné" : formatCentile(wealth)}
    </p>
    {#if wealth != null}
      <div
        class="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Rang du patrimoine du foyer dans le pays"
        aria-valuemin={1}
        aria-valuemax={100}
        aria-valuenow={wealth}
      >
        <div class="h-full rounded-full bg-primary" style="width: {wealth}%"></div>
      </div>
    {/if}
    <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
      Rang du patrimoine du foyer dans le pays, à la naissance. Le montant ne sort pas du filtre.
    </p>
    <div class="mt-2">
      <Badge variant="outline">{habitatLabel(card.family.habitat)}</Badge>
    </div>
  </div>

  <details class="mt-4 rounded-lg border border-border/60 px-3 py-2">
    <summary class="cursor-pointer text-sm font-medium">Parents</summary>
    <ul class="mt-2 space-y-2 text-sm leading-relaxed">
      <li>
        <span class="font-medium">Père · {card.family.father.firstName ?? "Prénom non renseigné"}</span>
        <span class="block text-muted-foreground">
          {card.family.father.ageAtBirth} ans à la naissance · {jobOf(card.family.father.work)}
          {card.family.father.diedBeforeBirth ? " · décédé avant la naissance" : ""}
        </span>
      </li>
      <li>
        <span class="font-medium">Mère · {card.family.mother.firstName ?? "Prénom non renseigné"}</span>
        <span class="block text-muted-foreground">
          {card.family.mother.ageAtBirth} ans à la naissance · {jobOf(card.family.mother.work)}
          {card.family.mother.diedBeforeBirth ? " · décédée avant la naissance" : ""}
        </span>
      </li>
    </ul>
  </details>

  {#if card.elderSiblings.length > 0}
    <details class="mt-2 rounded-lg border border-border/60 px-3 py-2">
      <summary class="cursor-pointer text-sm font-medium">
        Aînés ({card.elderSiblings.length})
      </summary>
      <ul class="mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground">
        {#each card.elderSiblings as sibling, index (`${sibling.birthDate}-${index}`)}
          <li>
            {sibling.firstName ?? (sibling.sex === "female" ? "Sœur" : "Frère")} · QI {sibling.iq}
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</GameCard>

<style>
  .household {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.6rem 0.3rem;
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }

  .household li {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 3.9rem;
    color: var(--foreground);
    text-align: center;
  }

  .household svg {
    display: block;
    width: 1.35rem;
    height: 1.95rem;
    fill: currentColor;
  }

  .household .adult svg {
    width: 1.6rem;
    height: 2.35rem;
  }

  .household .mother {
    margin-right: 0.5rem;
  }

  .household .name,
  .household .iq {
    margin-top: 0.15rem;
    font-size: 0.68rem;
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
