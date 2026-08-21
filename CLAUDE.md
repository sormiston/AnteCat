# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is pnpm (`packageManager` pinned in package.json — don't use npm/yarn).

- `pnpm start` — start the Metro dev server (Expo Go / dev client)
- `pnpm ios` / `pnpm android` / `pnpm web` — start and open on a specific platform
- `pnpm lint` — runs `expo lint` (ESLint, flat config via `eslint-config-expo/flat`)
- `pnpm reset-project` — moves the starter `app/` code to `app-example/` and creates a blank `app/`; run only when explicitly asked to strip the template

There is no test script configured and no test framework installed yet.

## Architecture

- **Routing**: Expo Router (file-based). Routes live in `src/app/`, not the conventional root-level `app/` — this is set via the `expo-router` plugin/main entry, so don't expect Expo's default docs paths to match without checking `src/app/`.
- Import alias `@/*` → `src/*` and `@/assets/*` → `assets/*` (see `tsconfig.json`). Use these instead of relative `../../` paths.
- **Tabs**: `src/components/app-tabs.tsx` defines the native tab bar using `expo-router/unstable-native-tabs` (`NativeTabs`), not the classic `Tabs` API — it's colors/labels/icons per platform theme, referenced from `src/app/_layout.tsx`.
- **Theming**: `src/constants/theme.ts` is the single source of truth for colors/spacing/fonts (`Colors`, `Spacing`, `Fonts`, `BottomTabInset`, `MaxContentWidth`). `src/hooks/use-theme.ts` and `src/hooks/use-color-scheme.ts` resolve the active scheme (falling back `'unspecified'` → `'light'`). Prefer these over hardcoding colors/spacing.
- **Platform-specific files**: several components have `.web.tsx` counterparts (e.g. `animated-icon.web.tsx`, `app-tabs.web.tsx`, `use-color-scheme.web.ts`) that Metro/webpack pick automatically for web builds — when changing behavior for one platform, check whether a sibling `.web.*` file needs the same change.
- `src/global.css` is imported from `theme.ts` and used for web-only CSS custom properties (fonts referenced via `var(--font-*)`).

## Notes

- A `supabase/` directory and `supabase` CLI devDependency exist but no app code references Supabase yet — treat as unused/in-progress until wired up.
