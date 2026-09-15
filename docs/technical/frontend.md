# Project context: frontend architecture (Expo / React Native)

This is the frontend counterpart to `docs/technical/backend.md`: a durable record of frontend architectural decisions, meant to survive across milestones. `docs/milestones/demo-alpha/SPEC.md` is the current milestone-scoped source for *why* each decision was made; this document is where those decisions get inventoried so a later milestone doesn't have to re-read every SPEC to find them. Where the two disagree, treat it as drift to resolve, not as this document overriding the SPEC.

## Current stack (as installed, `package.json`)

| Package | Version | Role |
|---|---|---|
| `expo` | ~57.0.15 | SDK |
| `expo-router` | ~57.0.15 | File-based routing, `src/app/` |
| `react` / `react-dom` | 19.2.3 | |
| `react-native` | 0.86.2 | |
| `react-native-web` | ~0.21.0 | Web target |
| `@supabase/supabase-js` | ^2.112.4 | Backend client |
| `@react-native-async-storage/async-storage` | 2.2.0 | Session storage adapter for the Supabase client on native |
| `@tanstack/react-query` | ^5.102.8 | List/detail/mutate/refetch and cache invalidation |
| `nativewind` | ^4.2.6 | Tailwind utility classes via `className` on RN primitives |
| `@expo/ui` | ~57.0.12 | Native SwiftUI/Compose bindings — no web render, see Platform constraints below |
| `expo-glass-effect` | ~57.0.1 | Same native-only caveat |
| `expo-image`, `expo-font`, `expo-splash-screen`, `expo-system-ui`, `expo-status-bar`, `expo-symbols`, `expo-constants`, `expo-device`, `expo-linking`, `expo-web-browser` | various | Expo SDK modules, no architectural weight of their own |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `react-native-safe-area-context` | various | Router/gesture substrate, mostly transitive requirements of `expo-router` |
| `date-fns` | ^4.4.0 | Date math  |

Dev-only: `vitest` (unit tests), `eslint` + `eslint-config-expo`, `supabase` CLI, `typescript`, `tailwindcss@^3.4.17` + `prettier-plugin-tailwindcss` + `babel-preset-expo` (NativeWind's build-time half).

`src/` today holds `src/app/` (the full route skeleton below), `src/providers/auth/` (`AuthProvider.tsx`), and `src/lib/` (`supabase.ts`, `queryClient.ts`, `appState.ts`, Supabase-generated `database.types.ts`). `src/domain/`, `src/components/`, and `src/features/orders/` don't exist yet — they arrive with the order list and item detail screens.

## Styling

**NativeWind** (Tailwind CSS utility classes on React Native components), superseding SPEC.md's earlier plain-`StyleSheet`-plus-`theme.ts` plan. A `react-native-css`/Tailwind-v4 combination was spiked first and rejected in favor of this — NativeWind ships `className` support on RN primitives directly, with no per-component wrapper layer needed.

Installed and wired, on NativeWind 4 (stable) against Tailwind CSS v3. `View`/`Text`/`Pressable` take a `className` prop directly — no `src/tw/` wrapper module, unlike the rejected `react-native-css` approach. The pieces:

- `babel.config.js`: `babel-preset-expo` with `{ jsxImportSource: "nativewind" }`, plus the `nativewind/babel` preset.
- `metro.config.js`: the default Expo Metro config wrapped in `withNativeWind(config, { input: './src/css/global.css' })`.
- `app.json`: `expo.web.bundler` set to `"metro"`.
- `tailwind.config.js`: `content` globs covering `src/`, `presets: [require('nativewind/preset')]`.
- `src/css/global.css`: the three `@tailwind` directives, imported at the top of `src/app/_layout.tsx`.
- `nativewind-env.d.ts`: `/// <reference types="nativewind/types" />`, for `className` prop typing.

**One pnpm-specific gotcha, already handled.** The Babel transform rewrites JSX in app files to import `react-native-css-interop/jsx-runtime`, so Metro resolves that package from the project root — but it's a transitive dependency of `nativewind`, which pnpm's default strict layout keeps nested and unreachable. Metro then fails with `Unable to resolve module react-native-css-interop/jsx-runtime`. `pnpm-workspace.yaml` carries a `publicHoistPattern` entry for that one package to put it at the root of `node_modules`. Changing that setting makes pnpm purge and rebuild `node_modules`, which needs `CI=true pnpm install` when there's no TTY.

## Routing

Expo Router, file-based, rooted at `src/app/` (not the framework's default `app/` — set via the `expo-router` plugin/main entry). Import alias `@/*` → `src/*`, `@/assets/*` → `assets/*` (`tsconfig.json`).

demo-alpha's route map, built as a skeleton — the two `order/` screens are placeholders until the list and detail work lands:

```
src/app/
  _layout.tsx                    # AuthProvider + splash-gate + <Slot/>
  +not-found.tsx
  (auth)/
    _layout.tsx                  # signed-in -> redirect to order
    login.tsx
  (app)/
    _layout.tsx                  # signed-out -> redirect login; resolves syndicate + role
    index.tsx                    # redirect -> /order
    order/
      _layout.tsx                # mounts Realtime subscription once
      index.tsx                  # order item list
      [orderItemId].tsx          # order item detail
```

**`order/_layout.tsx` renders `<Stack />`, not the `<Slot />` SPEC.md's Realtime section names.** A `Slot` would collapse the list and the detail into one screen of the parent `(app)` stack, so tapping an item would swap the content in place with no push animation and no back button — and both user journeys depend on opening an item's detail and getting back out. The Realtime hook mounts equally well in either, so the choice costs nothing it was meant to buy.

Groups add no path segment, so `(app)/index.tsx` is the app's `/` route and there is no `src/app/index.tsx`.

Auth guarding at the route-layout level (redirect on signed-in/signed-out) is explicitly a UX convenience, not a security boundary — RLS doesn't exist yet, so this is an accepted, temporary trust call for demo-alpha's single seeded syndicate.

## Auth and session

- `supabase.auth.signInWithPassword` against seeded fixture users (`supabase/seed.sql`). No registration/invite flow in the client for demo-alpha.
- A single Supabase client instance in `src/lib/supabase.ts`, reading `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }`, with a platform-conditional storage adapter (async-storage on native; on web `storage` is left undefined so supabase-js picks up `localStorage`, and falls back to memory during the static web prerender where there is no `window`). This replaced the connectivity spike's unauthenticated throwaway client rather than extending it.
- The module throws at import time when either env var is missing. That is deliberate developer feedback, but it means a **production** web export (`expo export --platform web`) fails during static prerender unless the vars are in the environment — `.env.development` only loads in development. Supply them inline or in `.env.production` if that export is ever needed. The dev server (`pnpm web`) is unaffected.
- Session state lives in a root `AuthProvider` context (`src/providers/auth/AuthProvider.tsx`: `onAuthStateChange` + initial `getSession()`), exposing `{ session, user, status }` where `status` is `'loading' | 'signedIn' | 'signedOut'`. The root layout renders nothing until `status !== 'loading'`, hiding the splash (`expo-splash-screen`) only once the persisted session has been restored, so a guard never redirects off a status it is about to change.

## Data fetching and mutations

TanStack Query handles all list/detail/mutate/refetch shapes. The `QueryClient` is a module-level singleton in `src/lib/queryClient.ts` rather than constructed in the root layout, where Fast Refresh would drop the whole cache on every save. `src/lib/appState.ts` wires Query's `focusManager` to React Native's `AppState`, since Query's default focus tracking assumes a browser `visibilitychange` event; the same effect starts and stops supabase-js's token auto-refresh timer, which needs that signal for the opposite reason. Both are native-only — web already has working defaults for each.

A stake commit is an upsert (`ON CONFLICT (order_item_id, user_id) DO UPDATE`); a withdrawal is a plain `DELETE`. Both are already permitted by `trg_check_stake_order_is_open` while an order is open — the client isn't gaining a new capability, just being the first UI to use an existing one.

## Realtime

A Supabase Realtime subscription on `order_items` and `order_item_stakes`, scoped to the one open order, mounts once at `order/_layout.tsx` and invalidates the relevant TanStack Query keys — not a separate live-state store. Mounting at the layout level (rather than per-screen) means an update lands correctly regardless of whether the viewer is on the list or on an item's detail.

## Domain logic layer

`src/domain/` (planned, not yet created): pure functions, no React, unit-tested directly. Convention going forward — business rules that can be expressed without a component go here, not inline in a screen or a presentational component.

demo-alpha's planned modules: `pricing.ts` (tier/bundle price math), `capacity.ts` (remaining capacity, meaning differs by `pricingType`), `deadlines.ts` (countdown/expiry, fuzzable with fake timers), `roles.ts` (admin/member role resolution).

Deliberately absent: any client-side reimplementation of `apportion_bundle_stakes` (bundle-remainder splitting) or `order_item_resolution` (resolution status). Both are server-derived and would only introduce a second place those rules could drift from the SQL source of truth — see `docs/technical/backend.md` for the server-side logic itself.

## Component inventory conventions

- Presentational components live in `src/components/`, split by which screen composes them; a component with no stake-editing responsibility (e.g. a list-row summary) doesn't carry stake controls even if a sibling component on the same screen does — one screen, one place that writes a stake.
- No dedicated role-guard component — a role check like "is this user the admin" is a plain conditional against `domain/roles.ts`, inline where it's used. Not worth an abstraction for one inline conditional.
- Shared states (`EmptyState`, `ErrorState`, `LoadingSkeleton`) are cross-screen, not duplicated per screen.
- Network-error and not-authorized states are visually distinct where both are reachable — relevant on web, where routes are directly typable/bookmarkable and can be hit without the normal navigation path.

## Platform constraints

`@expo/ui` and `expo-glass-effect` bind native SwiftUI/Jetpack Compose components and don't render on `react-native-web`. Since demo-alpha runs on iOS, Android, and web simultaneously (three users, three devices), the shared component inventory is built on portable `View`/`Text`/`Pressable` rather than either package. Revisit both later, opt-in, for native-only chrome behind `Platform.OS !== 'web'` with a portable fallback.

## Open questions

- **Route guards are a UX convenience, not a security boundary.** `(auth)/_layout.tsx` redirects signed-in users to `/order` and `(app)/_layout.tsx` redirects signed-out users to `/login`, but RLS does not exist, so anyone holding the anon key can read and write past them. Accepted for demo-alpha's single seeded syndicate; it needs a real answer before a second syndicate exists.
- **Syndicate and role resolution has no home yet.** `(app)/_layout.tsx` is where SPEC.md puts it, and the file exists, but it currently only guards on auth status. The resolution lands with `domain/roles.ts`.
