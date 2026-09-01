# AnteCat

## Get started

<!-- 1. Install dependencies

   ```bash
   pnpm install
   ```

2. Start the app

   ```bash
   pnpm start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction). -->

## Scripts

Package manager is pnpm (`packageManager` pinned in package.json — don't use npm/yarn).

- `pnpm start` — start the Metro dev server (Expo Go / dev client)
- `pnpm ios` / `pnpm android` / `pnpm web` — start and open on a specific platform
- `pnpm lint` — runs `expo lint` (ESLint, flat config via `eslint-config-expo/flat`)
- `pnpm reset-project` — moves `src/` and `scripts/` to `example/` (or deletes them) and creates a blank `src/app/` with `index.tsx`/`_layout.tsx`; run only when explicitly asked to strip the template
- `pnpm test` — run the Vitest suite once (`vitest run`)
- `pnpm test:watch` — run Vitest in watch mode

Integration tests (`tests/`) hit a local Supabase instance directly — run `supabase start` first, and fill in `.env.test.local` (see `.env.example`) with the local API URL/anon key from `supabase status`. Tests are type-checked separately from the app via `tsconfig.test.json` (Node-scoped, not the Expo/RN-scoped root `tsconfig.json`) — see `pnpm exec tsc -p tsconfig.test.json --noEmit`.

## Architecture

### Backend

**Triggers**
| Trigger | Table / timing | Enforces |
|---|---|---|
| `trg_order_status_transition` | `orders`, `BEFORE UPDATE OF status` | `status` only moves `open` → `closed` → `executed`, never skips or reverses. |
| `trg_init_order_item_unit_price` | `order_items`, `BEFORE INSERT` | Derives `unit_price` at creation from the product's pricing config, overwriting anything the caller supplied (the column carries `DEFAULT 0` so callers can omit it). `tiered` → the `qty_floor = 0` baseline tier, the same value `trg_sync_tiered_unit_price` derives at `quantity = 0`, so creation and maintenance agree by construction. `threshold_bundle` → `bundle_price / threshold_qty`, integer division and so deliberately lossy (a per-unit approximation; apportionment restates stakes to sum to exactly `bundle_price` when the order closes). Missing pricing config raises. `BEFORE` rather than `AFTER` so it assigns `NEW.unit_price` in place — no `UPDATE`, so unlike the `order_items` triggers below it starts no cascade and cannot recurse. |
| `trg_check_stake_capacity` | `order_item_stakes`, `BEFORE INSERT OR UPDATE` | A stake can't push `order_items.quantity` past its ceiling — `threshold_qty` (via `product_bundle_thresholds`) for `threshold_bundle` products, `max_quantity` for `tiered` products. Overflow is **rejected outright, never clamped**. Locks the parent `order_items` row (`SELECT ... FOR UPDATE`) before reading the current sum, so two concurrent stakes on the same item can't both read a pre-insert sum and together overflow the ceiling (a write-skew race otherwise possible under MVCC/READ COMMITTED). Excludes the caller's own prior stake from that sum by `user_id` rather than `stake_id`, so an `UPDATE OF stake_qty` on an existing stake is checked against just everyone else's committed quantity. |
| `trg_check_stake_order_is_open` | `order_item_stakes`, `BEFORE INSERT OR UPDATE OF stake_qty, user_id, order_item_id OR DELETE` | Rejects any stake write once the parent order has left `open` (`order_item_stakes` → `order_items` → `orders`), except a `DELETE` executed as `service_role`, which is always allowed (admin/test cleanup only — clients never hold this role). This is what makes `trg_apportion_on_close` final. The `OF` list deliberately omits `stake_amount`: `apportion_bundle_stakes` writes that column *after* the order is already `closed` and would otherwise trip this guard — so a direct `stake_amount` write still slips through post-close, which is the hole the `stake_amount` policy `TODO` covers. Takes `FOR SHARE` on the `orders` row rather than reading it plain: under `READ COMMITTED` an uncommitted close is invisible, so without the lock an item could fill *after* `apportion_bundle_stakes` had already skipped it as unfilled — and since `orders.status` only moves forward, nothing would ever settle it. `SHARE` rather than `UPDATE` so concurrent stakes on one order still don't serialize against each other. Branches on `TG_OP` to read `OLD` on `DELETE`, where `NEW` is unassigned. |
| `trg_sync_order_item_quantity` | `order_item_stakes`, `AFTER INSERT OR UPDATE OF stake_qty OR DELETE` | Keeps `order_items.quantity` equal to `SUM(order_item_stakes.stake_qty)` for its `order_item_id`. Runs after the `BEFORE` triggers above have already rejected any overflow, so this write-back can never violate `order_items`' own `quantity <= max_quantity` check. `stake_qty` is the only column that can invalidate the sum, since `order_item_id` is immutable (decided; enforcement deferred to issue #3). Scoping to that one column also stops `trg_sync_stake_amounts_on_unit_price`'s bulk `stake_amount` rewrite from re-entering it once per repriced row. |
| `trg_sync_stake_amount_on_stake_qty` | `order_item_stakes`, `BEFORE INSERT OR UPDATE OF stake_qty` | Derives `stake_amount` as `stake_qty × the item's current unit_price`, overwriting anything the caller supplied (the column carries `DEFAULT 0` so callers can omit it). One row, no cross-row dependency — bundle remainder cents are settled separately by `trg_apportion_on_close`, so a bundle that fills and then un-fills during the open window can never strand them. `BEFORE` rather than `AFTER` so it assigns `NEW.stake_amount` in place: no self-`UPDATE`, so it cannot recurse, and it does not depend on firing after `trg_sync_order_item_quantity`. A `tiered` insert that crosses a tier boundary reads the pre-crossing `unit_price` here and is corrected moments later by `trg_sync_stake_amounts_on_unit_price`'s bulk rewrite. |
| `trg_sync_tiered_unit_price` | `order_items`, `AFTER UPDATE OF quantity` | For `tiered` items, looks up the `product_price_tiers` row with the highest `qty_floor <= quantity` and writes it to `unit_price` if it differs. Hangs off `order_items.quantity` (not `order_item_stakes` directly) so it uniformly covers every path that can move quantity — stake INSERT, UPDATE, and DELETE — since all three funnel through `trg_sync_order_item_quantity`'s `UPDATE order_items SET quantity = ...`. If no tier covers the new quantity (including `quantity = 0` on a product with no `qty_floor = 0` row), the write is **rejected outright** via exception, same as `trg_check_stake_capacity`'s overflow rejection. |
| `trg_sync_stake_amounts_on_unit_price` | `order_items`, `AFTER UPDATE OF unit_price` | Fired by `trg_sync_tiered_unit_price` whenever a tiered item's `unit_price` actually changes. Bulk-rewrites every stake on that item to `stake_qty × new unit_price`, so the ledger always reflects current tier pricing rather than the price at each stake's own creation time. Guarded to `tiered` items only, so it can never touch `threshold_bundle` apportionment. |
| `trg_apportion_on_close` | `orders`, `AFTER UPDATE OF status` | On `open` → `closed` only, calls `apportion_bundle_stakes(order_id)`: for every `threshold_bundle` item on that order whose `quantity` has reached `threshold_qty`, rewrites each stake to `floor(bundle_price × stake_qty / threshold_qty)` and hands the leftover cents one apiece to the **smallest** fractional remainders, ties by ascending `stake_id`, so the item's stakes sum to exactly `bundle_price`. Unfilled items are skipped — nothing resolved, nothing to settle. Guarded to that one transition so the later `closed` → `executed` move cannot re-run it. Defined in the stakes migration, not the orders one, because the function it calls reads `order_item_stakes`. |

**Views**
| View | Derives |
|---|---|
| `order_item_resolution` | Per-`order_item_id` `resolution_status` (`open` / `succeeded` / `maxed_out`), not stored. A `threshold_bundle` item succeeds the instant `quantity >= threshold_qty`; a `tiered` item with `max_quantity` set resolves to `maxed_out` the instant `quantity` hits it — both independent of the parent order's status. Everything else — an unfilled `threshold_bundle`, or a `tiered` item with no `max_quantity` set or below it — stays `open`, regardless of `orders.status`. |


## ERD (mermaid, current state)

```mermaid

erDiagram
  USERS ||--o{ SYNDICATE_MEMBERS : belongs_to
  SYNDICATES ||--o{ SYNDICATE_MEMBERS : has
  USERS ||--o{ SYNDICATES : administers
  SYNDICATES ||--o{ ORDERS : places
  PRODUCTS ||--o| PRODUCT_BUNDLE_THRESHOLDS : has
  PRODUCTS ||--o{ PRODUCT_PRICE_TIERS : has
  ORDERS ||--o{ ORDER_ITEMS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : ordered_as
  ORDER_ITEMS ||--o{ ORDER_ITEM_STAKES : split_into
  USERS ||--o{ ORDER_ITEM_STAKES : stakes

  USERS {
    uuid id PK
    string email
  }
  SYNDICATES {
    int syndicate_id PK
    string name
    uuid admin_user_id FK
  }
  SYNDICATE_MEMBERS {
    int syndicate_id FK
    uuid user_id FK
    timestamp joined_at
  }
  PRODUCTS {
    int product_id PK
    string name
    product_pricing_type pricing_type
  }
  PRODUCT_BUNDLE_THRESHOLDS {
    int product_id FK
    int threshold_qty
    int bundle_price
  }
  PRODUCT_PRICE_TIERS {
    int product_id FK
    int qty_floor
    int unit_price
  }
  ORDERS {
    int order_id PK
    int syndicate_id FK
    order_status status
    timestamp opened_at
    timestamp deadline_at
    timestamp closed_at
    timestamp executed_at
  }
  ORDER_ITEMS {
    int order_item_id PK
    int order_id FK
    int product_id FK
    int quantity
    int unit_price
    int max_quantity
  }
  ORDER_ITEM_STAKES {
    int stake_id PK
    int order_item_id FK
    uuid user_id FK
    int stake_qty
    int stake_amount
  }
```

### Frontend

- The `expo reset-project` template strip has been run: `src/` currently holds only the blank scaffold (`src/app/_layout.tsx` with a bare `Stack`, `src/app/index.tsx` with a placeholder screen). The tabs/theming/platform-file structure previously documented here no longer exists — rebuild this section once the app is scaffolded back out.
- **Routing**: Expo Router (file-based). Routes live in `src/app/`, not the conventional root-level `app/` — this is set via the `expo-router` plugin/main entry, so don't expect Expo's default docs paths to match without checking `src/app/`.
- Import alias `@/*` → `src/*` and `@/assets/*` → `assets/*` (see `tsconfig.json`). Use these instead of relative `../../` paths.

### Autogen code

These are procedurally generated files. Never edit them.

- src/lib/database.types.ts

### Libraries

- date-fns: preferred as more readable and ergonomic than native Javascript Date objects
