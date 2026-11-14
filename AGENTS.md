# AGENTS.md — Karmageddon

Life simulation game on top of **Stochia** (separate Rust repo, local copy `C:\stochia`). Flow: home → **Naître** → birth sheet → **Nouvelle vie**. Data path is always **game → BFF → Stochia**; clients never call Stochia. Ports, env vars and launch steps: see `README.md`.

- `apps/game`: SvelteKit + Vite + Tauri 2, French UI, renders only the BFF contract.
- `apps/bff` ("le filtre"): calls Stochia, validates at runtime, builds the birth sheet.
- `packages/contract`: shared sheet shape; no Svelte, Tauri, server code or secrets.

## Hard invariants

The game's premise is that you only know your life as it is at birth.

- BFF output is built from an **explicit field allowlist**, nested objects included, so new upstream fields never leak.
- **No simulated future reaches the client** (death, future career or inheritance, unborn siblings, later events): not in JSON, SvelteKit hydration data or error bodies. Hiding in the UI is not enough.
- Family data means the situation at birth; check field semantics in Stochia.
- Never fabricate missing data or turn an API error into a fake birth. Never expose raw Stochia responses or full-life fixtures to the client.
- Randomness and simulation rules stay in Stochia; never re-draw or re-implement them here.
- Salaries stay hidden: 2021 international dollars cannot be converted by exchange rate.

## Rules

- Never edit `C:\stochia` silently; if needed, follow its own instructions and report it separately.
- npm workspaces only, strict TypeScript, no new deps or upgrades without need. Change contract, BFF, game and tests together.
- Keep browser and Tauri working; no Tauri or browser APIs during SvelteKit SSR. Never ship `localhost` as `VITE_BFF_URL`; `VITE_*` is public, so no secrets.
- Windows + PowerShell: chain with `;`, not `&&`. Never kill `node`/Rust globally (local Stochia must stay up).
- Public Stochia allows 60 req/min shared by all players: tests use fixtures and a fake upstream; set timeouts, honor `429`/`Retry-After`, no unbounded retries, no shared cache of a random birth.
- UI: French, mobile and desktop, accessible, no double submit, stale responses never overwrite newer ones. Sarcasm is fine, but never about origin, disability or family. No new mechanics (accounts, saves, inventory...) unless asked.

## Verify and report

- Code changes: `npm test`, `npm run check`, `npm run build`. Test that no future or unknown upstream field appears in the serialized response, and cover network errors, timeouts and 429s.
- Update `README.md` when behavior or commands change.
- End with what works, which checks actually ran, and what remains. Never claim an unverified target or deployment.
