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

`src/` holds `src/app/` (the route skeleton below), `src/providers/auth/` (`AuthProvider.tsx`), `src/lib/` (`supabase.ts`, `queryClient.ts`, `appState.ts`, `format.ts`, `queryErrors.ts`, Supabase-generated `database.types.ts`), `src/domain/` (pure rules), `src/features/` (`orders/`, `syndicates/` — query and mutation hooks plus the row-to-view mapping), and `src/components/` (`shared/`, `order-list/`).

The `features/*` split is by subject, not by screen: `features/orders` owns the one order query both order screens read, and `features/syndicates` owns membership. A screen composes hooks from `features/` and components from `components/`, and never calls `supabase.from(...)` itself.

## Styling

**NativeWind** (Tailwind CSS utility classes on React Native components), superseding SPEC.md's earlier plain-`StyleSheet`-plus-`theme.ts` plan. A `react-native-css`/Tailwind-v4 combination was spiked first and rejected in favor of this — NativeWind ships `className` support on RN primitives directly, with no per-component wrapper layer needed.

Installed and wired, on NativeWind 4 (stable) against Tailwind CSS v3. `View`/`Text`/`Pressable` take a `className` prop directly — no `src/tw/` wrapper module, unlike the rejected `react-native-css` approach. The pieces:

- `babel.config.js`: `babel-preset-expo` with `{ jsxImportSource: "nativewind" }`, plus the `nativewind/babel` preset.
- `metro.config.js`: the default Expo Metro config wrapped in `withNativeWind(config, { input: './src/css/global.css' })`.
- `app.json`: `expo.web.bundler` set to `"metro"`.
- `tailwind.config.js`: `content` globs covering `src/`, `presets: [require('nativewind/preset')]`.
- `src/css/global.css`: the three `@tailwind` directives, imported at the top of `src/app/_layout.tsx`.
- `nativewind-env.d.ts`: `/// <reference types="nativewind/types" />`, for `className` prop typing.

### Design language

Tokens live in `tailwind.config.js`'s `theme.extend.colors`, used as `bg-table`, `text-ink`, `border-rule` and so on, rather than as raw hex anywhere in a component.

The palette is a card table with a ledger beside it, grounded in the app's own assets (`assets/images/cat-chips-logo.png`, and the `#EF8120` splash background already in `app.json`): `table` #1E3A33 baize for the header band, `ground` #E9E9E4 behind the cards, `paper` #FBFAF8 for the cards, `rule` #D5D6CE for every border, `ink`/`ink-soft` for text, `dusk` for anything receded, `ante` #EF8120, and `brass` #D9A227.

Two rules hold the whole thing together:

- **`ante` orange means "you", everywhere and nowhere else** — the viewer's own chips, their own figures, a card's left edge when they hold a stake, and the button that commits a change. Nothing decorative is ever orange, so the colour alone answers "am I in this one".
- **`brass` means the final day before a deadline**, and appears nowhere else in the app.

**Capacity is drawn as what it is, not as one generic bar.** A `threshold_bundle` is an indivisible pack split between a countable number of members, so `CapacityMeter` draws one mark per unit and a glance says how many are still going spare. A `tiered` item's ceiling is a supply limit that can run to thousands, so it gets a proportional bar — and only above 5% fill, below which a bar is a hairline that reads as a broken element rather than as "barely started". An uncapped tiered item has no ceiling and gets neither; its `TierLadder` is the real meter. This is `SPEC.md`'s "capacity means two different things" made visual, and it is why the two pricing models get structurally different cards.

**Figures go through `components/shared/Numeral.tsx`**, which sets a monospace face and `fontVariant: ['tabular-nums']` so money and a ticking countdown don't reflow column to column. It sets the family in JS via `Platform.select` rather than as a Tailwind `fontFamily` token: NativeWind's `platformSelect` writes itself unresolved into the web stylesheet (`font-family:platformSelect(ios/Menlo,…)`), so the face silently never applies on web.

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

**Syndicate and role resolution has one home:** `(app)/_layout.tsx` calls `useMemberships(user.id)`, and every screen below reads the same `['memberships', userId]` key, so a syndicate picker later is a screen added there rather than a second way to answer "which syndicate, and what am I in it".

## Auth and session

- `supabase.auth.signInWithPassword` against seeded fixture users (`supabase/seed.sql`). No registration/invite flow in the client for demo-alpha.
- A single Supabase client instance in `src/lib/supabase.ts`, reading `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }`, with a platform-conditional storage adapter (async-storage on native; on web `storage` is left undefined so supabase-js picks up `localStorage`, and falls back to memory during the static web prerender where there is no `window`). This replaced the connectivity spike's unauthenticated throwaway client rather than extending it.
- The module throws at import time when either env var is missing. That is deliberate developer feedback, but it means a **production** web export (`expo export --platform web`) fails during static prerender unless the vars are in the environment — `.env.development` only loads in development. Supply them inline or in `.env.production` if that export is ever needed. The dev server (`pnpm web`) is unaffected.
- Session state lives in a root `AuthProvider` context (`src/providers/auth/AuthProvider.tsx`: `onAuthStateChange` + initial `getSession()`), exposing `{ session, user, status }` where `status` is `'loading' | 'signedIn' | 'signedOut'`. The root layout renders nothing until `status !== 'loading'`, hiding the splash (`expo-splash-screen`) only once the persisted session has been restored, so a guard never redirects off a status it is about to change.

## Data fetching and mutations

TanStack Query handles all list/detail/mutate/refetch shapes. The `QueryClient` is a module-level singleton in `src/lib/queryClient.ts` rather than constructed in the root layout, where Fast Refresh would drop the whole cache on every save. `src/lib/appState.ts` wires Query's `focusManager` to React Native's `AppState`, since Query's default focus tracking assumes a browser `visibilitychange` event; the same effect starts and stops supabase-js's token auto-refresh timer, which needs that signal for the opposite reason. Both are native-only — web already has working defaults for each.

**One query key, one request.** `features/orders/api.ts` exposes a single `['order', orderId]` query, rooted at `orders` with items, products, pricing config and stakes nested under it, so one Realtime invalidation refreshes everything both order screens draw. `SPEC.md`'s Realtime section writes that select rooted at `order_items`; it is rooted at `orders` here because the list screen also needs `status`, `deadline_at` and `opened_at`, and the alternative was the second query key that section exists to forbid. Stakes are nested for the same reason: the detail screen needs every member's, and fetching only the viewer's would have to be widened later.

**The order id is pinned, not resolved.** `DEMO_ORDER_ID` in `features/orders/api.ts` is the entire shortcut — this milestone ships no order picker and one seeded order, so everything that needs an id reads it from that one constant, and a picker changes that file rather than every screen.

**Errors are classified, not just caught.** `lib/queryErrors.ts` turns a `PostgrestError` into a `DataError` carrying one of `network | notAuthorized | notFound | unknown`, which is what lets `ErrorState` offer a retry only where retrying can change the outcome. `42501` (a missing grant) and `PGRST301` (a bad JWT) are `notAuthorized`; `PGRST116` is `notFound`.

**Row-to-view mapping lives in `features/orders/view.ts`**, not in components: it flattens one PostgREST row, sorts the embedded tiers (PostgREST guarantees no order on embedded rows), and runs the `domain/` functions once, so a component reads values rather than computing them.

A stake commit is an upsert (`ON CONFLICT (order_item_id, user_id) DO UPDATE`); a withdrawal is a plain `DELETE`. Both are already permitted by `trg_check_stake_order_is_open` while an order is open — the client isn't gaining a new capability, just being the first UI to use an existing one.

## Realtime

A Supabase Realtime subscription on `orders` (`UPDATE`) and `order_items` (`INSERT`, `UPDATE`), filtered by `order_id`, mounts once at `order/_layout.tsx` and invalidates the single `['order', orderId]` key — not a separate live-state store. Mounting at the layout level (rather than per-screen) means an update lands correctly regardless of whether the viewer is on the list or on an item's detail.

**Never `order_item_stakes`.** Those are the only two tables in the `supabase_realtime` publication (see `docs/technical/backend.md`), because a stake change already rolls up into `order_items.quantity` through `trg_sync_order_item_quantity` — so the item row reports it, and subscribing to stakes directly would only duplicate the same wake-up. The hook itself lands with the item detail screen.

## Domain logic layer

`src/domain/`: pure functions, no React, no Supabase types, unit-tested directly from `tests/domain/`. Convention — business rules that can be expressed without a component go here, not inline in a screen or a presentational component.

| Module | Holds |
|---|---|
| `pricing.ts` | `tierPriceForQuantity`, `nextTierBreak`, `bundleUnitIdealPrice`, `formatEuroCents`. Returns `null` where the SQL raises (a quantity with no covering tier): a render path is the wrong place to throw. |
| `capacity.ts` | `capacityRemaining`, `capacityFraction`. `null` means uncapped, and neither ever goes negative — an admin may lower `max_quantity` under what is already committed. |
| `deadlines.ts` | `timeRemaining`, `isPastDeadline`, `windowElapsedFraction`, `timeRemainingParts`. `now` is an argument, so tests drive a fixed clock instead of faking timers. |
| `roles.ts` | `roleFor`, `isAdminOfSyndicate`, `isMemberOfSyndicate`, over a `Membership[]`. Role is derived by comparing the membership's `user_id` to the syndicate's `admin_user_id`; it is resolved per syndicate even though a member belongs to one today. |
| `resolution.ts` | `resolveOrderItem`, mirroring the `order_item_resolution` view. |

`resolution.ts` is a deliberate exception to "no client-side mirror of server logic": reading the view would be a second query key for one badge, which `SPEC.md`'s Realtime section rules out. The view stays the authority — if one changes, both change, and the test file is written as that contract.

`tests/db-client-integration/helpers.ts` imports the two price functions from `domain/pricing.ts` rather than keeping its own copies, so an integration test asserting a price asserts against the same function the screen renders.

Still deliberately absent: any client-side reimplementation of `apportion_bundle_stakes`. Bundle-remainder splitting is cross-row, happens once at close, and has exactly one correct home — see `docs/technical/backend.md`.

## Component inventory conventions

- Presentational components live in `src/components/`, split into `shared/` (used by more than one screen: `CapacityMeter`, `ResolutionBadge`, `OrderStatusBadge`, `TierLadder`, `Numeral`, `Tag`, and `states.tsx`'s `EmptyState`/`ErrorState`/`LoadingSkeleton`) and a folder per screen (`order-list/`). A component moves into `shared/` when a second screen composes it, not in anticipation of one.
- A component with no stake-editing responsibility (e.g. a list-row summary) doesn't carry stake controls even if a sibling component on the same screen does — one screen, one place that writes a stake.
- No dedicated role-guard component — a role check like "is this user the admin" is a plain conditional against `domain/roles.ts`, inline where it's used. Not worth an abstraction for one inline conditional.
- Shared states (`EmptyState`, `ErrorState`, `LoadingSkeleton`) are cross-screen, not duplicated per screen. `LoadingSkeleton` is deliberately still: a shimmer would be the only unprompted motion in the app.
- Copy is written from the member's side of the table, in the vocabulary the action uses — the status badge says "Taking stakes" rather than "open", and every card's status line is the same two sentences in the same order (where the item stands, then what follows from it) whichever pricing model produced it. Once an order closes that second sentence switches from a prospect to an outcome, rather than inviting a move nobody can make.
- Irreversible admin actions arm on the first press and commit on the second, with a visible way out. `Alert.alert` is a no-op on `react-native-web`, and this milestone runs on iOS, Android and web at once, so a confirmation has to be built from portable primitives.
- Network-error and not-authorized states are visually distinct where both are reachable — relevant on web, where routes are directly typable/bookmarkable and can be hit without the normal navigation path.

## Platform constraints

`@expo/ui` and `expo-glass-effect` bind native SwiftUI/Jetpack Compose components and don't render on `react-native-web`. Since demo-alpha runs on iOS, Android, and web simultaneously (three users, three devices), the shared component inventory is built on portable `View`/`Text`/`Pressable` rather than either package. Revisit both later, opt-in, for native-only chrome behind `Platform.OS !== 'web'` with a portable fallback.

## Open questions

- **Route guards are a UX convenience, not a security boundary.** `(auth)/_layout.tsx` redirects signed-in users to `/order` and `(app)/_layout.tsx` redirects signed-out users to `/login`, but RLS does not exist, so anyone holding the anon key can read and write past them. Accepted for demo-alpha's single seeded syndicate; it needs a real answer before a second syndicate exists.
- **The order id is pinned to a constant.** `DEMO_ORDER_ID` stands in for order resolution; it needs a real answer (a picker, or "the syndicate's current order") before a second order exists. Isolated to one constant so that answer lands in one file.
- **The first request after sign-in reliably 401s on the local stack**, with PostgREST's `PGRST303 "JWT issued at future"` — sub-second skew between GoTrue issuing the token and PostgREST validating its `iat`, which has no leeway. TanStack Query's `retry: 1` absorbs it and the screen loads on the second attempt, so this costs a slightly longer skeleton and nothing else. Not app code's to fix; worth recognising rather than debugging again.
