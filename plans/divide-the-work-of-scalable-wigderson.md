# Dividing demo-alpha into five PLAN files

## Context

`docs/milestones/demo-alpha/SPEC.md` describes the whole demo but has no PLAN covering
any of it. This splits that SPEC into four dependency-ordered PLAN files, numbered `2.`
through `5.` to follow the existing `1.prove-device-connectivity-demo.PLAN.md`.

Executing this plan means **writing those five PLAN files** into
`docs/milestones/demo-alpha/`, not implementing them. Each gets its own session, and the
detail belongs in each file rather than here.

Decided while scoping: stake writes stay a single upsert, with
`check_stake_capacity`'s own-row exclusion changed to `user_id` so the upsert path
computes correctly. Migrations are edited in place rather than added, per CLAUDE.md's
local-only rule.

## The five plans

### 2. `2.grant-authenticated-access.PLAN.md`

Backend only, no app code.

- Grants for `authenticated` and the Realtime publication, added to
  `supabase/migrations/20260901162710_grant_service_role_privileges.sql`.
  `orders` and `order_items` need `SELECT, UPDATE` — the trigger row locks run as the
  calling role.
- The `user_id` exclusion change in
  `20260822221600_create_order_item_stakes_and_triggers.sql`.
- Something to label a stake's owner on screen — nothing currently exposes member
  identity past `user_id`. A narrow view over `syndicate_members ⋈ auth.users` is the
  small version.
- Upsert coverage in `ledger-integrity.test.ts`, plus a new anon-key
  `authenticated-access.test.ts` following `helpers.ts`'s fixture-from-live-DB shape.

Verify: `supabase db reset`, `pnpm test` green.

### 3. `3.app-foundation.PLAN.md`

Everything needed before a screen can render real data.

- Install TanStack Query, async-storage, NativeWind + Tailwind; create the
  `babel.config.js` / `metro.config.js` / `tailwind.config.js` / `global.css` set.
- `src/lib/supabase.ts` singleton, `AuthProvider`, splash gate, QueryClientProvider,
  `focusManager` on `AppState`.
- The route skeleton from SPEC.md:39-55, with `order/` screens as placeholders.
- Root `.env.app.local.example`.

Verify: `pnpm web`, log in as a seeded user, land on an empty `/order`, session survives
reload.

### 4. `4.order-list-screen.PLAN.md`

- `src/domain/` — pricing, capacity, deadlines, roles, resolution. Pure, unit-tested from
  `tests/domain/`, which needs no config change. `helpers.ts` already has working price
  math to move here.
- `src/features/orders/api.ts` — one query under `['order', orderId]`, plus admin close
  and execute mutations.
- `order/index.tsx` and its components, including the shared empty/error/loading states.

Verify: both seeded items render correctly; admin sees close/execute and a member
doesn't; closing re-apportions the bundle to exactly 5000.

### 5. `5.item-detail-and-stakes.PLAN.md`

- `order/[orderItemId].tsx` — product info, price display, stake list, `StakeStepper`.
  The only place stakes get written.
- Stake upsert and delete mutations.
- `useOrderRealtime.ts` per SPEC.md:108-121, mounted once in `order/_layout.tsx`, plus
  `supabase.realtime.setAuth()` in `AuthProvider`.

Verify: two browser profiles as different members see each other's stakes land without a
refresh; a closed order goes read-only.

## Dependencies

`2 → 3 → 4 → 5`, strictly serial. Plan 2 can start today.

## Notes

- **Env reminder:** plan 3 creates `.env.app.local.example`. I can't touch `.env*` files,
  so keeping the real `.env.app.local` in sync with that committed `.example` counterpart
  is yours.
