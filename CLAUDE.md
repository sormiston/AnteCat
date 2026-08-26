# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.



After any and all code changes, check that steering documents are free of misalignment or contradictions.  Steering documents are:

@SPEC.md.
@.claude/context/backend.md

Always check project steering documents before work.

## Commands

Package manager is pnpm (`packageManager` pinned in package.json — don't use npm/yarn).

- `pnpm start` — start the Metro dev server (Expo Go / dev client)
- `pnpm ios` / `pnpm android` / `pnpm web` — start and open on a specific platform
- `pnpm lint` — runs `expo lint` (ESLint, flat config via `eslint-config-expo/flat`)
- `pnpm reset-project` — moves `src/` and `scripts/` to `example/` (or deletes them) and creates a blank `src/app/` with `index.tsx`/`_layout.tsx`; run only when explicitly asked to strip the template

There is no test script configured and no test framework installed yet.

## Architecture

- The `expo reset-project` template strip has been run: `src/` currently holds only the blank scaffold (`src/app/_layout.tsx` with a bare `Stack`, `src/app/index.tsx` with a placeholder screen). The tabs/theming/platform-file structure previously documented here no longer exists — rebuild this section once the app is scaffolded back out.
- **Routing**: Expo Router (file-based). Routes live in `src/app/`, not the conventional root-level `app/` — this is set via the `expo-router` plugin/main entry, so don't expect Expo's default docs paths to match without checking `src/app/`.
- Import alias `@/*` → `src/*` and `@/assets/*` → `assets/*` (see `tsconfig.json`). Use these instead of relative `../../` paths.

