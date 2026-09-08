# SPEC.md

> Product name TBD — this project is currently developed under the working/repo name **AnteCat**, which is a placeholder, not the intended product name.

---

# Part 1 — Vision

## What is this?

A coordination platform for **syndicates** — small, high-trust groups of people who want to pool their commitments toward a bulk purchase of something, without any one of them fronting the whole thing or chasing the rest down by hand. The platform tracks who's committed to what and for how much, as a shared ledger. Implicit in the perfection of this concept is a hope and a vision: raising the purchasing power of individuals through cooperative action.

## Who is it for?

Initially: small, high-trust groups — the kind of group that already knows and trusts each other well enough to settle up business off the app. A group is a **syndicate**: one **admin**, plus **members**. The platform is deliberately general-purpose rather than built around one particular product, as we believe the same mechanics of cooperative buying should be applicable to any order of products divisible by either quantity (a case of wine bottles) or fungibility (liters of olive oil).

### Use cases ideas include (but are not limited to!):

- **Olive oil:** buy 50 L, divide by liters
- **Cheese:** buy a whole wheel, divide by weight
- **Coffee:** volume-tier pricing
- **Meat:** fundamentally indivisible bulk purchase divided among households
- **Car Rentals / Boat charters / Group tours:** "let's take a road trip. we just need 5 people who won't back out!"
- **Wholesale vintage clothing:** or anything that follows "buy the lot, split the content", ex. rare collectible card deck group buys
- **Construction materials:** everyone wants different quantities
- **Maker / Artisan materials:** chemicals, tools, supplies, 3D-printer filaments
- **Festival tickets:** collective purchasing power without physically dividing a product
- **Restaurant-supply goods:** ordinary consumers collectively accessing wholesale pricing
- **Custom Electronics requiring MOQ:** custom synthesizers, effects pedals, mechanical keyboards, anything where no manufacturing run happens until Minimum Order Quantity is secured
- **Wine:** fixed case divided into individual bottles
- **Electronics components:** enormous quantity discounts
- **Specialty imports:** collectively reach the quantity needed to make importing economical

## The problem

Today, this coordination happens in group chats. Group chats fail this job in specific ways:

- **No urgency.** Nothing forces a decision; conversations drift.
- **No accountability.** It's easy to say "I'm in" and just as easy to quietly not follow through, with no record either way.
- **Distractions are legion.** The commitment thread is buried between everything else the group talks about, and the actual product offer is equally difficult to reference.
- **Manual tracking is error-prone.** Someone — usually the admin — is manually tallying who's in, for how much, in their head or in a spreadsheet, off to the side of the chat.
- **No enforcement of caps or thresholds.** Nothing stops a fixed-size bundle from being oversold, or tells the group whether a required minimum number of buyers was actually reached.
- **No visibility into status.** Members can't easily tell whether an order is still open, how close it is to resolving, or whether their own stake is even confirmed.

This platform replaces the group chat as the _mechanism of commitment_ — not the group's conversation itself, just the part where "who's in for what" needs to be a structured, time-boxed, and trustworthy record instead of a scroll-back exercise.

## Why this way

Group chats already give people a place to talk about a bulk order — what they don't give them is a forcing function. The core bet is that swapping the _commitment_ step (not the conversation) out of chat and into a structured, time-boxed, enforced record is enough to fix the urgency/accountability/visibility problems. The platform's job is coordination, not commerce: it is not, and does not intend to become, a retailer that sells, stocks, ships, or fulfills anything itself.

## Success looks like

**Groups of buyers stop reverting to group chats.** The signal that matters is retention and habit: once a group tries running an order here, they keep coming back to it instead of falling back to a chat thread for the next one.

## Domain Description - the solution

- **Syndicates** are member groups with exactly one **admin**. There's no public signup or self-serve syndicate creation: a syndicate and its **admin** are bootstrapped directly against the backend (by whoever operates the platform), and from there the **admin** invites members by email. (See _Related technical resources_ below — this follows an established invite-only auth pattern, not an open registration flow.)
- Each **syndicate** has **products** which are either procured off-app by the **admin** and thereafter defined by them in-app, or otherwise integrated into the app across all or select **syndicates** via real-world partnership agreements.
- Two pricing models, decided per item:
  - **Minimum quantity bundles or packs**, which require a minimum order quantity to unlock a fixed pack price. Ex. 6 tickets for $50 ($10 individually sold)
  - **Tiered by sliding scale**, where the price per unit slides based on cumulative quantity ordered. Ex. 1 unit for $10, 5 units for $40 ($8 unit price), 10 units for $60 ($6 unit price) etc.
- The **admin** opens an **order window**: a time-boxed collection of one or more **products**, with a **deadline**.
- **Members** are notified when a new **order window** opens — push notification on mobile, email otherwise — so the commitment moment is a distinct, surfaced and scheduleable event.
- Members commit a **stake** on each **product** of interest: their share (and associated cost) of a given item.
  - in the case of **Minimum quantity bundles**, a member's **stake** may take 1 or more units in the bundle, and will know their cost by the floor of `bundlePrice / unitsInBundle * unitsClaimedByMember`. Fractional currency remainders abound in such cases, where someone needs to pay an extra cent or two... but don't worry - that's all equitably handled by the app!
  - in the case of **Tiered by sliding scale** products, a member's **stake** can claim as many units as they like, and they will know their cost by `unitsClaimedByMember * unitPriceAtCurrentTier`. They can breathe easy knowing that as _other_ members place their own **stakes**, _everybody's_ unit price can _only decrease_. That means savings!
- An **order** closes automatically when its **deadline** elapses.
<!---- Consider either grace period or admin-only post-close adjustments?  to rally efforts towards satisfying min qty bundles  -->
- Once closed, the admin has a finished order: a clear record of who committed to what, for how much. The admin can mark it **executed** once the actual purchase has been made

<!---
### PoC scope boundaries

- **Not a retailer.** It never sells, stocks, ships, or fulfills the products being pooled for.
- **No payment processing yet.** No money moves through the app; stakes are ledger entries members settle externally. Planned to change — see Roadmap.
- **No cross-order inventory tracking.** Supply caps apply per order-item instance, not as a running total across a product's history — the platform deliberately does not become an inventory system.
- **No open/public signup.** Syndicate membership is invite-only, issued by an admin — there is no self-serve account creation path.
- **No minimum order quantity on tiered products.** A tiered product is orderable at any quantity — its price ladder always starts at zero, so the first unit already has a price. Vendor minimums ("50 units or no deal") aren't modelled: an item that never reaches a viable size simply closes at whatever quantity it reached. A threshold bundle's `threshold_qty` is a *pack size*, not a minimum, and doesn't cover this case.

### Platforms

Built with Expo / React Native, targeting Android, iOS, and web. **Web (as a PWA) is the launch priority** — it's the fastest path to something usable — with native mobile following.

### Business model

Out of scope for the PoC. This is currently a free/internal tool for a closed set of syndicates, not a commercial product with a pricing model. May be revisited once payment handling (below) exists.

### Upcoming technical decisions

Flagged here because they shape the product experience even though the decision itself is technical and not yet made.

**Item data flexibility.** The admin-facing item definition needs to feel flexible enough to cover different kinds of things a syndicate might pool toward — roughly the way a platform like Shopify lets very different sellers describe very different products under one general "product" concept. Two directions are on the table; the decision is deferred.

|                    | **Option 1 — Custom fields per item**                                                                                                                                                                                                                                                                                         | **Option 2 — Fixed shape, flexible content**                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description**    | Admins can add arbitrary fields to an item definition (e.g. size, flavor, variant, notes) — the item's _shape_ itself is configurable per item.                                                                                                                                                                               | Every item has the same structured fields (name, description, image, pricing config). Flexibility comes from what admins put _in_ those fields, not from new fields. |
| **Pros**           | Maximally flexible — genuinely fits arbitrary use cases without the schema anticipating them. Feels closest to the Shopify comparison.                                                                                                                                                                                        | Simple, predictable data model. Easy to build list/search/filter UI against a known shape. No schema-migration-shaped problems as usage grows.                       |
| **Cons**           | Harder to build consistent UI on top of (list views, filtering, sorting all get harder against an open-ended shape). More validation/schema complexity on the backend.                                                                                                                                                       | Less flexible for edge-case use cases; admins describe unusual items by overloading `description`/`notes` rather than structured fields.                             |
| **Best fit if...** | Use cases turn out to be genuinely heterogeneous and the "one general item concept" bet needs to hold for a long tail of syndicate types.                                                                                                                                                                                     | Use cases converge on a fairly small number of shapes, and predictable UI/tooling matters more than open-endedness.                                                  |

**Decision: not yet made.**

### Open questions (PoC)

- **Stake edits/withdrawals** — not yet implemented at any layer. A member should presumably be able to set or withdraw their own stake on an open order without staff intervention, subject to the same capacity/membership checks as a fresh stake, but neither a DB-layer mechanism nor a frontend exists yet. Also open: what a member should see/be told when the item they're staked on has already resolved (succeeded or maxed out) while the order stays open.
- _(Additional non-goals, pending — see stub above.)_

## Roadmap — next version

Features planned beyond the PoC. This list will grow.

### 1. Payment handling (escrow)

Today, a stake is a pure ledger figure — a promise, settled entirely off-platform. A future version aims to back that promise with real funds: syndicate members stake actual money into an escrow account, which the admin then has available to draw on when executing the order. It is an item of interest to discover whether this may be a particularly well-suited use case for web3 technologies such as self-executing ("smart") contracts.

-->

## Related technical resources

- [Technical documentation: backend] — the technical schema/spec companion to this document: Postgres/Supabase schema, triggers, and the open technical questions behind the product behavior described here.
- **Invite-Only Auth Blueprint** (artifact, drafted 2026-08-20, from a separate reference project `supabase-local-sales-dash`) — a reusable pattern for exactly the admin-bootstrapped, invite-only membership model described above: a role-bearing profile table mirrored from `auth.users` via trigger, a `SECURITY DEFINER` role-check function, and a single Edge Function gate around `auth.admin.inviteUserByEmail` that is the only code path allowed to create an account. This is the intended shape for how syndicate invites get implemented, adapted from `rep`/`team_lead` to this platform's `member`/`admin` roles.
