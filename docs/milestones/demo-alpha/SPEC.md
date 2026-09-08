## SPEC demo-alpha
This is a SPEC file.  It is to be implemented over the course of one or more PLAN files.

## Goal
Demonstrate an open order and the UX/UI of members making stakes on order items until order automatically closes by deadline or admin action.  Demo will involve 3 users on 3 devices.  Demo data will be supplied by a pre-seeded database (supabase/seed.sql, running on a local stack)** — one syndicate, one order with some order items, some existing stakes.

IMPORTANT!  Items considered "out of scope" will inherently be IN SCOPE in the FUTURE.  Ensure that all planning follows architectural plannings that "set the stage well" for the easy inclusion of these features.  Including these future features, when they are implemented (not in this context, but a future one!) should be done with minimum of code churn.

## Out-of-scope
- Order creation ❌ - demo order already created in seed.sql
- Product creation ❌ - comes from seed.sql
- Order item creation ❌ - comes from seed.sql
- Registration / invite flow ❌ - login only, against seeded users
- Syndicate picker ❌ - exactly one seeded syndicate exists
- Catalog / product management UI ❌ - no in-app item authoring
- Member roster / invite UI ❌ - nothing to invite
- Standalone profile screen ❌ - sign-out is a header affordance on the order screen

## User Journeys

### Admin
- Logs in with a seeded admin account and lands directly on the one seeded order's item list (no order picker, no order list).
- Sees each order item summarized on its own card (resolution status, capacity, current price) and taps into one to open its detail.
- On an item's detail screen, sees the product info and every member's stake on it, including their own, and commits, adjusts, or withdraws their own stake there. Admin status doesn't restrict participation.
- Closes the order early, from the list screen, as an explicit admin-gated action. This exercises the bundle-remainder apportionment trigger.  Order stakes become read-only.
- Marks a closed order executed once the off-platform purchase is done.
- Watches other members' stakes and resolution changes arrive live on both the list and detail screens, without refreshing.

### User
- Logs in with a seeded member account and lands directly on the one seeded order's item list.
- Sees each order item summarized on its own card (resolution status, remaining capacity, current price) and taps into one to open its detail.
- On the detail screen, sees the product info and commits a stake, watching the cost update live as they adjust the quantity.
- Adjusts or withdraws their own stake there while the order stays open.
- Watches the deadline count down on the list screen and sees other members' stakes and resolution changes land live on both screens, including the order closing, whether that happens early by admin action or on its own at the deadline.
- Once the order closes, sees their own stake amounts as read-only.

## Screen / Route Map

```
src/app/
  _layout.tsx                    # AuthProvider + splash-gate + <Slot/>
  +not-found.tsx

  (auth)/
    _layout.tsx                  # signed-in -> redirect to order
    login.tsx                    # only screen in this group: email/password against a seeded user

  (app)/
    _layout.tsx                  # signed-out -> redirect login; resolves the one seeded syndicate + the caller's role in it
    index.tsx                    # redirect -> /order (no order picker, no order list: exactly one exists)
    order/
      _layout.tsx                # mounts the order's Realtime subscription once, shared by both screens below
      index.tsx                  # order item list: OrderStatusBadge, DeadlineCountdown, admin close/execute, a list of OrderItemCard summaries
      [orderItemId].tsx          # order item detail: product info, price/capacity/resolution detail, every member's stake on this item, stake commit/adjust/withdraw
```

Three real screens, plus three non-visual layout/gate files. `order/index.tsx` composes `OrderStatusBadge`, `DeadlineCountdown`, and a list of `OrderItemCard` (a tappable summary: `ResolutionBadge`, `CapacityMeter`, current price, and the viewer's own stake if they have one). `order/[orderItemId].tsx` composes `ProductInfo`, the full price display, `CapacityMeter`, `ResolutionBadge`, `StakeStepper`, and the per-item stake list, plus loading/empty/error states shared by both screens.

No syndicate-picker screen exists yet, but `(app)/_layout.tsx` still resolves "the one seeded syndicate and the caller's role in it" through the same helpers a picker would eventually call (see Architectural Decisions). That's the shape of "set the stage well": the resolution logic has one home now, so a picker is a later addition to that one file, not a rewrite of everything that reads role or syndicate id.

## Component Inventory

### Domain logic (`src/domain/`, no React, unit-testable)

| Module | Function | Notes 
|---|---|---|
| `domain/pricing.ts` | `tierPriceForQuantity(tiers, cumulativeQty)` | Boundary cases (exactly at a breakpoint, below the lowest) are the highest-value tests. |
| `domain/pricing.ts` | `bundleUnitIdealPrice(bundlePriceCents, thresholdQty)` | Display-only. |
| `domain/capacity.ts` | `capacityRemaining(pricingType, currentQty, thresholdQty \| maxQuantity)` | Returns `number \| null` (`null` = uncapped tiered). "Capacity" means two different things depending on `pricingType`: for a `threshold_bundle` item, it's progress toward `threshold_qty` (the bundle fills and succeeds); for a `tiered` item, it's remaining room under `max_quantity`, which is nullable and, when null, means no cap at all. |
| `domain/deadlines.ts` | `timeRemaining`, `isPastDeadline` | Pure, fuzzable with fake timers; feeds `DeadlineCountdown`. |
| `domain/roles.ts` | `isAdminOfSyndicate(memberships, syndicateId)`, `roleFor(...)` | The one place role-per-syndicate logic lives, even with a single syndicate. |

No client-side bundle-remainder splitter exists in this layer. `apportion_bundle_stakes` already owns that computation server-side (see Architectural Decisions), so duplicating it here would just be a second place for the rule to drift.

### Presentational (`src/components/`)

**On the list screen (`order/index.tsx`):** `OrderStatusBadge`, `DeadlineCountdown`, and `OrderItemCard`, a link-wrapped summary row (`ResolutionBadge`, `CapacityMeter`, current price, and the viewer's own stake quantity/cost if they have one) that navigates to `/order/[orderItemId]` on tap. `OrderItemCard` carries no stake-editing controls itself; it's a summary, not the place stakes get written.

**On the detail screen (`order/[orderItemId].tsx`):** `ProductInfo` (name and description now, structured so an image or other product field can be added later without moving anything below it), `TieredPriceTable` or the bundle price display, `ResolutionBadge`, `CapacityMeter`, a stake list showing every member's stake on this item, and `StakeStepper` (quantity +/- with live price from `domain/pricing.ts`, disables the increment at capacity, and decrementing to zero withdraws the stake). This is the only place stake commit, adjust, and withdraw controls exist.

**Shared:** `EmptyState`, `ErrorState`, `LoadingSkeleton`.

Both screens distinguish a network error from a not-authorized one in their error state. That distinction matters on web, where both the list and detail URLs are directly typable and bookmarkable.

No dedicated role-guard component exists. The admin close/execute action is a plain conditional on `domain/roles.ts`'s `isAdminOfSyndicate`, rendered inline on `order/index.tsx`. One inline action doesn't need its own abstraction.

**Styling:** NativeWind — Tailwind utility classes via `className` directly on `View`/`Text`/`Pressable`, no per-component wrapper layer. Not yet installed; see `docs/technical/frontend.md` for the setup steps.

**`@expo/ui` and `expo-glass-effect`:** both bind native SwiftUI/Jetpack Compose components and don't render on `react-native-web`. Since this demo has to run identically on iOS, Android, and web (three users, three devices, per the Goal above), the shared component inventory is built on portable `View`/`Text`/`Pressable` instead. Revisit these later, opt-in, for isolated native chrome behind `Platform.OS !== 'web'` with a portable fallback.


## Realtime subscription
Realtime implementation instructions

Add to a new migration file:

Add grants for authenticated:
- GRANT USAGE ON SCHEMA public TO authenticated;
- GRANT SELECT ON products, product_bundle_thresholds, product_price_tiers, syndicates, syndicate_members, orders, order_items TO authenticated;
- GRANT SELECT, INSERT, UPDATE, DELETE ON order_item_stakes TO authenticated;
- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

Add publication membership:
ALTER PUBLICATION supabase_realtime ADD TABLE orders, order_items;

Do not enable RLS as part of this work.

src/features/orders/useOrderRealtime.ts

Create a hook taking orderId: number. In a useEffect keyed on [orderId, queryClient]:

- Open one channel named order:${orderId}.
- Register exactly three postgres_changes listeners, all with the same callback:
  - { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'order_id=eq.${orderId}' }
  - { event: 'INSERT', schema: 'public', table: 'order_items', filter: 'order_id=eq.${orderId}' }
  - { event: 'UPDATE', schema: 'public', table: 'order_items', filter: 'order_id=eq.${orderId}' }
- Do not use event: '*'.
- Do not subscribe to order_item_stakes.
- Callback: a scheduleRefetch wrapper that clears and resets a 150ms timer, then calls queryClient.invalidateQueries({ queryKey: ['order', orderId] }). Never pass invalidateQueries directly as the listener callback. Ignore the payload argument.
- In .subscribe((status) => ...), call scheduleRefetch() when status === 'SUBSCRIBED'.
- Cleanup: clear the timer and call supabase.removeChannel(channel).

src/app/(app)/order/_layout.tsx

Call useOrderRealtime(orderId) once, render <Slot />. Do not mount the subscription in any screen.

App-level wiring

- Wire TanStack Query's focusManager to React Native AppState in the root layout.
- Call supabase.realtime.setAuth() after sign-in and on token refresh in AuthProvider.

src/features/orders/api.ts

One query under key ['order', orderId]. Single request:

supabase.from('order_items').select(`
  order_item_id, order_id, quantity, unit_price, max_quantity,
  products ( product_id, name, description, pricing_type,
             product_bundle_thresholds ( threshold_qty, bundle_price ),
             product_price_tiers ( qty_floor, unit_price ) )
`).eq('order_id', orderId)

Do not fetch order_item_resolution from the client. Do not add a second query key for

src/domain/resolution.ts

Pure function, no React. Inputs: quantity, maxQuantity, pricingType, thresholdQty. Re | 'maxed_out'.

- pricing_type === 'threshold_bundle' && quantity === thresholdQty → 'succeeded'. Use
- pricing_type === 'tiered' && maxQuantity != null && quantity >= maxQuantity → 'maxed_out'.
- Otherwise 'open', including threshold_bundle with a null/absent product_bundle_thre

Unit-test it directly. Leave the order_item_resolution view and its service_role grantion suite.

Documentation to amend in the same change

- docs/milestones/demo-alpha/SPEC.md: Realtime bullet in Architectural Decisions (ordd by order_id; no order_item_stakes); backend-prerequisite bullet (add the ALTERPUBLICATION line).
- docs/technical/frontend.md: Realtime section (same change); Domain logic layer, remfrom "Deliberately absent" and add resolution.ts to the planned modules.

## Architectural Decisions

- **Login** is password-based (`supabase.auth.signInWithPassword`) against the seeded fixture users in `supabase/seed.sql`. No registration or invite flow exists for Phase 1.
- **The Supabase client** (`src/lib/supabase.ts`) is a singleton reading `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, with `auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }` and a platform-conditional storage adapter (`@react-native-async-storage/async-storage` on native, `localStorage` on web; the package isn't installed yet). This replaces the throwaway, unauthenticated client built for the device-connectivity spike (see Plans) rather than extending it, since that client has no auth or session handling at all.
- **Session state** lives in a root `AuthProvider` context that subscribes to `onAuthStateChange` plus an initial `getSession()` call, and exposes `{ session, user, status }`. First navigation waits on `status !== 'loading'`, using the already-installed `expo-splash-screen` so the wrong route never flashes.
- **Data fetching** uses TanStack Query. The screen is dominated by list/detail/mutate/refetch shapes with real invalidation needs. Committing a stake has to refresh `order_items.quantity` and resolution status across the screen, and hand-rolling that is more surface area than adopting one library. Raw `supabase.from(...)` calls stay out of components, behind a thin `src/features/orders/api.ts` exporting query and mutation hooks.
- **Realtime is in scope for Phase 1.** A Supabase Realtime subscription on `order_items` and `order_item_stakes`, scoped to the one open order, mounts once in `order/_layout.tsx` and invalidates the relevant TanStack Query keys on change rather than driving a separate live-state store. Mounting it at the layout level, rather than in each screen, means a change lands correctly whether the viewer is sitting on the list or on one item's detail. This is what makes the three devices in the actual demo show each other's stakes and resolution changes without anyone pulling to refresh.
- **A stake commit is an upsert, and a withdrawal is a delete.** `order_item_stakes` carries `UNIQUE (order_item_id, user_id)`, so committing writes `ON CONFLICT (order_item_id, user_id) DO UPDATE`. Neither operation needs new database permission to work: `trg_check_stake_order_is_open` already allows `UPDATE OF stake_qty` and plain `DELETE` while the order is open. Phase 1 is the first UI to use that existing allowance, not a new capability being added underneath it.
- **Auth guarding in the route layout is a UX convenience, not the security boundary.** `(auth)/_layout.tsx` redirects to `(app)` when signed in; `(app)/_layout.tsx` redirects to `/login` when signed out. Row-level security does not exist yet (see the backend prerequisite below); this is an accepted, temporary trust call for one seeded, trusted syndicate, not an oversight.
- **Backend prerequisite, not yet applied, and it blocks Phase 1 entirely:** the `authenticated` Postgres role currently has no grants on any table (only `service_role` does, in `supabase/migrations/20260901162710_grant_service_role_privileges.sql`), so a logged-in demo user's client can't read or write a single row today. A PLAN implementing this SPEC needs to grant `authenticated`: `SELECT` on `syndicates`, `syndicate_members`, `products`, `product_bundle_thresholds`, `product_price_tiers`, and `order_item_resolution`; `SELECT, UPDATE` on `orders` and `order_items` (the `UPDATE` grant is needed even though clients never write `order_items` directly, because `sync_order_item_quantity` and `sync_tiered_unit_price` run `SECURITY INVOKER`, so their own `UPDATE order_items` executes as whichever role wrote the triggering stake or status change); and `SELECT, INSERT, UPDATE, DELETE` on `order_item_stakes` (the `DELETE` is for withdrawal, decided above). A flat grant with no RLS is the accepted posture for this phase. It matches the single-syndicate trust model described in Open Questions below, not a placeholder for real tenant isolation.
- **Membership checks stay unenforced at the database layer.** Neither `syndicates.admin_user_id` nor `order_item_stakes.user_id` is checked against `syndicate_members` yet, a gap already tracked in `docs/technical/backend.md`. Accepted as-is for this phase: the demo assumes exactly one syndicate, so every seeded user is inherently a member of it, and the gap has no effect on Phase 1's actual data.
- **Bundle rounding and stake-amount trust are already handled server-side**, which corrects a stale concern from an earlier draft of this plan. `apportion_bundle_stakes` implements Hamilton (largest-remainder) apportionment at order close; it isn't a placeholder. `trg_sync_stake_amount_on_stake_qty` already overwrites any client-submitted `stake_amount` with the server-derived value on every write. Neither needs a client-side reimplementation for correctness.
- **Resolution status has no client-side mirror.** A stake commit's pending state covers the acting user's own screen until the mutation settles; Realtime covers everyone else. A local copy of the `order_item_resolution` view's logic would only shave a round trip off one badge update, at the ongoing cost of a second place that rule can drift from the SQL view. Not worth it.

## Open Questions

- **Products and catalog scoping.** `products` has no `syndicate_id`, so it's a global table, but the product vision describes admin-defined per-syndicate items with optional cross-syndicate sharing through partnerships. That tension is real and unresolved. It doesn't block Phase 1, since products are only ever read through the seeded order items and nothing creates or edits them here, but it needs an answer before any catalog-authoring UI gets built.
- **Membership enforcement.** See the Architectural Decisions entry above. Accepted as moot for Phase 1's single-syndicate data, but still an open, tracked gap in `docs/technical/backend.md` that needs a real fix (trigger or RLS policy) before this schema serves more than one syndicate.

## Verifications

<!-- TODO when user requests -->

## Plans

 @docs/milestones/demo-alpha/1.prove-device-connectivity-demo.TICKET.md
 @docs/milestones/demo-alpha/2.grant-authenticated-access.TICKET.md
 @docs/milestones/demo-alpha/3.app-foundation.TICKET.md
 @docs/milestones/demo-alpha/4.order-list-screen.TICKET.md
 @docs/milestones/demo-alpha/5.item-detail-and-stakes.TICKET.md

