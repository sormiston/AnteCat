# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

After any and all code changes, check that steering documents are free of misalignment or contradictions.  Steering documents are:

@SPEC.md.
@AGENTS.md
@.claude/context/backend.md

Always check project steering documents before work.
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

# Autogen code
These are procedurally generated files.  Never edit them.

- src/lib/database.types.ts 