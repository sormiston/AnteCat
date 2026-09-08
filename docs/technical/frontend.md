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
| `@expo/ui` | ~57.0.12 | Native SwiftUI/Compose bindings — no web render, see Platform constraints below |
| `expo-glass-effect` | ~57.0.1 | Same native-only caveat |
| `expo-image`, `expo-font`, `expo-splash-screen`, `expo-system-ui`, `expo-status-bar`, `expo-symbols`, `expo-constants`, `expo-device`, `expo-linking`, `expo-web-browser` | various | Expo SDK modules, no architectural weight of their own |
| `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, `react-native-screens`, `react-native-safe-area-context` | various | Router/gesture substrate, mostly transitive requirements of `expo-router` |
| `date-fns` | ^4.4.0 | Date math  |

Dev-only: `vitest` (unit tests), `eslint` + `eslint-config-expo`, `supabase` CLI, `typescript`.

`src/` today holds only `src/app/` (the bare `expo reset-project` scaffold: `_layout.tsx`, `index.tsx`) and `src/lib/` (Supabase-generated `database.types.ts`). None of `src/domain/`, `src/components/`, `src/features/`, or `src/theme.ts` exist yet — they're SPEC.md's target shape for demo-alpha, not built.

## Decided but not yet installed

SPEC.md commits to these; none are in `package.json` yet, so treat any reference to them elsewhere as forward-looking, not current behavior:

- **`@tanstack/react-query`** — chosen for list/detail/mutate/refetch and cache invalidation once a stake commit needs to refresh `order_items.quantity` and resolution status across screens. Raw `supabase.from(...)` calls are to stay out of components, behind `src/features/orders/api.ts`.
- **`@react-native-async-storage/async-storage`** — the native-side session storage adapter for the Supabase client singleton (`localStorage` covers web).

## Styling

**NativeWind** (Tailwind CSS utility classes on React Native components), superseding SPEC.md's earlier plain-`StyleSheet`-plus-`theme.ts` plan. A `react-native-css`/Tailwind-v4 combination was spiked first and rejected in favor of this — NativeWind ships `className` support on RN primitives directly, with no per-component wrapper layer needed.

Not installed yet. Setup, per current NativeWind docs (stable, Tailwind CSS v3):

- `npm install nativewind react-native-reanimated react-native-safe-area-context` (the latter two are already installed) plus `npm install --dev tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11 babel-preset-expo`.
- `babel.config.js`: `babel-preset-expo` with `{ jsxImportSource: "nativewind" }`, plus the `nativewind/babel` preset.
- `metro.config.js`: wrap the default Expo Metro config with `withNativeWind(config, { input: './global.css' })`.
- `app.json`: `expo.web.bundler` set to `"metro"`.
- `tailwind.config.js`: `content` globs covering `src/`, `presets: [require('nativewind/preset')]`.
- `global.css`: the three `@tailwind base/components/utilities` directives, imported once at the app's entry point (`src/app/_layout.tsx`).
- Optional but worth doing: `nativewind-env.d.ts` with `/// <reference types="nativewind/types" />` for `className` prop typing (avoid naming it `nativewind.d.ts`).

Once set up, `View`/`Text`/`Pressable` etc. take a `className` prop directly — no `src/tw/` wrapper module, unlike the rejected `react-native-css` approach.

## Routing

Expo Router, file-based, rooted at `src/app/` (not the framework's default `app/` — set via the `expo-router` plugin/main entry). Import alias `@/*` → `src/*`, `@/assets/*` → `assets/*` (`tsconfig.json`).

demo-alpha's target route map (not yet built):

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

Auth guarding at the route-layout level (redirect on signed-in/signed-out) is explicitly a UX convenience, not a security boundary — RLS doesn't exist yet, so this is an accepted, temporary trust call for demo-alpha's single seeded syndicate.

## Auth and session

- `supabase.auth.signInWithPassword` against seeded fixture users (`supabase/seed.sql`). No registration/invite flow in the client for demo-alpha.
- A single Supabase client instance in `src/lib/supabase.ts`, reading `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }`, with a platform-conditional storage adapter (async-storage on native, `localStorage` on web). This does not exist yet — the connectivity spike (`docs/milestones/demo-alpha/prove-device-connectivity-demo.PLAN.md`) built an unauthenticated throwaway client that this replaces rather than extends.
- Session state lives in a root `AuthProvider` context (`onAuthStateChange` + initial `getSession()`), exposing `{ session, user, status }`. First navigation waits on `status !== 'loading'`, using the already-installed `expo-splash-screen` to avoid a route flash.

## Data fetching and mutations

TanStack Query (not yet installed — see above) is the decided approach for all list/detail/mutate/refetch shapes. A stake commit is an upsert (`ON CONFLICT (order_item_id, user_id) DO UPDATE`); a withdrawal is a plain `DELETE`. Both are already permitted by `trg_check_stake_order_is_open` while an order is open — the client isn't gaining a new capability, just being the first UI to use an existing one.

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

- **TanStack Query and async-storage**: decided, not yet installed. First PLAN that touches data fetching or auth needs to add them.
