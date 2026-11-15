# AGENTS.md — Karmageddon

Life simulation game on top of **Stochia** (separate Rust repo, local copy `C:\stochia`). Flow: home → **Naître** → birth sheet → **Vivre cette vie** (one card a year, until the game's last age) or **Nouvelle vie**. Data path is always **game → BFF → Stochia**; clients never call Stochia.

Three documents, each fact in one of them only (link, never copy):

- `README.md`: ports, env vars, launch steps, commands, BFF routes, what the client receives, technical limits.
- `docs/game-design.md`: the game design, written as the target game (death, karma across lives, income, dwelling, climate hazards, life state, card format, script language, card types, tuning targets). Not all of it runs: the "Construit" columns and the note under each section title say what is built and which phase builds the rest. The appendix describes the deck in the repo.
- `docs/plan.md`: the action plan, in five phases, with the work per layer, the invariants each phase amends in this file, and what "done" means. A direction, not a request.

Layout:

- `apps/game`: SvelteKit + Vite + Tauri 2, French UI, renders only the BFF contract.
- `apps/bff` ("le filtre"): calls Stochia, validates at runtime, builds the birth sheet, and plays lives in memory (`src/lives.ts`).
- `packages/contract`: shared sheet shape; no Svelte, Tauri, server code or secrets.
- `packages/engine`: game engine (life state, card script language, seeded draws). Pure TypeScript, no I/O; runs in the BFF only, never imported by `apps/game`.
- Cards are JSON files in `apps/bff/cards` (`types.json`, `cartes/<slug>.json`), versioned with the code. `apps/bff/src/cards` loads them into an in-memory store. No database.

## Hard invariants

The game's premise is that you only know your life as it is at birth.

- BFF output is built from an **explicit field allowlist**, nested objects included, so new upstream fields never leak.
- **No simulated future reaches the client** (death, future career or inheritance, unborn siblings, later events): not in JSON, SvelteKit hydration data or error bodies. Hiding in the UI is not enough.
- Family data means the situation at birth; check field semantics in Stochia.
- Never fabricate missing data or turn an API error into a fake birth. Never expose raw Stochia responses or full-life fixtures to the client.
- Demographic randomness and simulation rules stay in Stochia; never re-draw or re-implement them here. Game randomness (which card, which outcome) lives in `packages/engine`, runs only in the BFF, and always takes an injected seeded generator: no `Math.random`.
- The game state starts from the filtered birth sheet (`initialState(BirthCard)`), never from a Stochia life.
- Card scripts, conditions, weights, impacts and undrawn outcomes never reach the client. Card scripts are data in the card language: never `eval` them or run them as JavaScript.
- A card is validated and compiled before it can be drawn; a damaged one is set aside and logged, never repaired. Card files are read by the BFF only: never bundle them into `apps/game`.
- Salaries stay hidden: 2021 international dollars cannot be converted by exchange rate.

## Rules

- Never edit `C:\stochia` silently; if needed, follow its own instructions and report it separately.
- npm workspaces only, strict TypeScript, no new deps or upgrades without need. Change contract, BFF, game and tests together.
- Keep browser and Tauri working; no Tauri or browser APIs during SvelteKit SSR. Never ship `localhost` as `VITE_BFF_URL`; `VITE_*` is public, so no secrets.
- Windows + PowerShell: chain with `;`, not `&&`. Never kill `node`/Rust globally (local Stochia must stay up).
- Public Stochia allows 60 req/min shared by all players: tests use fixtures and a fake upstream; set timeouts, honor `429`/`Retry-After`, no unbounded retries, no shared cache of a random birth.
- UI: French, mobile and desktop, accessible, no double submit, stale responses never overwrite newer ones. Sarcasm is fine, but never about origin, disability or family; card text follows the same rule (card checklist: `docs/game-design.md`, section 9.5). No new mechanics (accounts, saves, inventory...) unless asked: build a phase of `docs/plan.md` only when the owner asks for it, and amend the invariants above with that code, as listed under "Documents" in that phase.

## Verify and report

- Code changes: `npm test`, `npm run check`, `npm run build`. Test that no future or unknown upstream field appears in the serialized response, and cover network errors, timeouts and 429s.
- Card or engine changes: also `npm run cards:validate`, and `npm run cards:simulate` to look at a whole life (a tuning tool, never a game rule; it does not call Stochia). A change to the script language, the state names or the generator needs tests in `packages/engine`.
- Update `README.md` when commands, configuration, routes or the client contract change. Update `docs/game-design.md` when a state name, a parameter, a yearly rule, the card language, a card type or the deck changes. When a phase is built, mark what it made true as built there ("Construit" columns, section notes).
- End with what works, which checks actually ran, and what remains. Never claim an unverified target or deployment.
