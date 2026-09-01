# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

After any and all code changes, check that steering documents are free of misalignment or contradictions.  Steering documents are:

@SPEC.md.
@AGENTS.md
@.claude/context/backend.md
@README.md

Always check the project steering documents before work.

## Code style

### SQL

Do not be overly verbose when writing comments in SQL migration files.  

#### SQL comment style Example 1

❌ This is too long:
```
-- DEFAULT 0 exists only so callers never need to supply unit_price (and
-- Insert types stay optional here) -- trg_init_order_item_unit_price
-- overwrites it on every insert. The 0 never survives to be checked:
-- Postgres applies defaults, then fires BEFORE row triggers, and only then
-- evaluates CHECK constraints.
```

✅ This is good:

```
-- DEFAULT 0 exists only so callers never need to supply unit_price (and
-- Insert types stay optional here) -- trg_init_order_item_unit_price
-- overwrites it on every insert.
```

#### SQL comment style Example 2

❌ This is too long:
```
-- Trigger: derive unit_price at creation from the product's pricing config, so
-- it is never caller-supplied. BEFORE (not AFTER) specifically so it can assign
-- NEW.unit_price in place and return the row -- no UPDATE statement, so unlike
-- the order_items triggers in the next migration this one starts no cascade and
-- cannot recurse.
--
-- tiered:           the qty_floor = 0 baseline tier -- the same value
--                   sync_tiered_unit_price would derive at quantity = 0, so the
--                   creation path and the maintenance path agree by construction.
-- threshold_bundle: bundle_price / threshold_qty. Integer division, so this
--                   floors (5000/6 = 833) and is deliberately lossy: 833 x 6 is
--                   4998, two cents short of the bundle price. That gap is
--                   expected -- a bundle's unit_price is a per-unit approximation
--                   for display and for pre-threshold stake amounts, never an
--                   authoritative total. Once the order closes, apportion_bundle_stakes
--                   restates every stake on a filled item so they sum to exactly
--                   bundle_price. Do not "fix" the two cents.
```

✅ This is good:
```
-- Trigger: derive unit_price at creation from the product's pricing config, so
-- it is never caller-supplied.
--
-- tiered:           the qty_floor = 0 baseline tier
-- threshold_bundle: bundle_price / threshold_qty. Integer division, so this
--                   deliberately floors to an ideal unit_price.  Any remainder cents must
--                   be apportioned when bundle fills.
```


Currently, this project is developing against a LOCAL supabase stack with no linked remote.  When asked to write SQL migrations, check that this remains the case.  If it does remain the case, then do not prefer to write new migrations to implement schema changes, rather, edit the old ones.

## Commands

Package manager is pnpm (`packageManager` pinned in package.json — don't use npm/yarn).

- `pnpm start` — start the Metro dev server (Expo Go / dev client)
- `pnpm ios` / `pnpm android` / `pnpm web` — start and open on a specific platform
- `pnpm lint` — runs `expo lint` (ESLint, flat config via `eslint-config-expo/flat`)
- `pnpm reset-project` — moves `src/` and `scripts/` to `example/` (or deletes them) and creates a blank `src/app/` with `index.tsx`/`_layout.tsx`; run only when explicitly asked to strip the template
- `pnpm test` — run the Vitest suite once (`vitest run`)
- `pnpm test:watch` — run Vitest in watch mode

Integration tests (`tests/`) hit a local Supabase instance directly — run `supabase start` first, and fill in `.env.test.local` (see `.env.example`) with the local API URL/anon key from `supabase status`. Tests are type-checked separately from the app via `tsconfig.test.json` (Node-scoped, not the Expo/RN-scoped root `tsconfig.json`) — see `pnpm exec tsc -p tsconfig.test.json --noEmit`.

## Architecture

- The `expo reset-project` template strip has been run: `src/` currently holds only the blank scaffold (`src/app/_layout.tsx` with a bare `Stack`, `src/app/index.tsx` with a placeholder screen). The tabs/theming/platform-file structure previously documented here no longer exists — rebuild this section once the app is scaffolded back out.
- **Routing**: Expo Router (file-based). Routes live in `src/app/`, not the conventional root-level `app/` — this is set via the `expo-router` plugin/main entry, so don't expect Expo's default docs paths to match without checking `src/app/`.
- Import alias `@/*` → `src/*` and `@/assets/*` → `assets/*` (see `tsconfig.json`). Use these instead of relative `../../` paths.

## Autogen code
These are procedurally generated files.  Never edit them.

- src/lib/database.types.ts 

## Miscellaneous
Project level CLAUDE settings (.claude/settings.json) deny the ability to read, edit, or execute bash commands concerning .env files.  Whenever you are given a task
involving read/write of .env files, remind the developer of their responsibility to keep the gitignored runtime .env files IN SYNC with .env.**.example.  The .example suffixed env file is a git-committed index / template of env vars this app needs in order to work.
