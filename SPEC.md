# SPEC.md

> Product name TBD — this project is currently developed under the working/repo name **KittyKatch**, which is a placeholder, not the intended product name.

This document has two parts. **Part 1 — Vision** is the durable statement of what this platform is and why it exists; it shouldn't need to change often. **Part 2 — Implementation & Roadmap** describes what's actually built today (a proof of concept), and what's planned next — implementation details and near-term scope are expected to move as the platform matures.

---

# Part 1 — Vision

## What is this?

A coordination platform for **syndicates** — small, high-trust groups of people who want to pool their commitments toward a bulk purchase of something, without any one of them fronting the whole thing or chasing the rest down by hand. The platform tracks who's committed to what and for how much, as a shared ledger. 

## Who is it for?

Small, high-trust groups — the kind of group that already knows and trusts each other, not an open marketplace of strangers. A group is a **syndicate**: one **admin**, plus **members**. The platform is deliberately general-purpose rather than built around one anchor scenario (e.g. it's not "a card-breaking app" or "a bulk-foods app") — the same mechanics should work for whatever a given syndicate is pooling toward. Concrete example use cases will be developed later, for demos and documentation, but for now here follows a Claude-generated brainstorm list of use cases:

**Hobby/collectibles** (near cousins of card breaking)
- **Mechanical keyboard group buys** — a known use case of "nothing ships until MOQ reached".
- Comic back-issue box splits, Funko/toy case splits, vinyl record lot splits — same "buy the sealed lot, split the contents" shape as card breaking.

**Bulk food & drink** (fits tiered per-unit pricing well — price per unit drops with volume)
- Coffee roaster bulk-bean orders (price/lb drops in tiers).
- Meat shares — quarter/half cow or hog split among several families, classic pre-app version of exactly this.
- CSA farm-share splitting when one full share is more than one household wants.
- Mixed wine/spirits case discounts.
- Specialty/ethnic grocery bulk imports not sold locally in small quantities.

**Enthusiast supply co-ops**
- Homebrew ingredients (grain, hops) bought by the sack and split by weight.
- Fragrance/cosmetics decanting — a full bottle split into shares, priced per ml, tiered.
- 3D-printing filament bulk spool splits.

**Team/community/civic**
- Youth sports team gear or jersey orders — tiered per-unit pricing where more players per size drops the unit cost, sometimes a threshold for free customization.
- Neighborhood/HOA bulk deliveries — mulch, firewood, gravel, heating oil for winter.
- School/PTA class supply or spirit-wear group orders.
- Community solar or bulk-service group discounts.

## The problem

Today, this coordination happens in group chats. Group chats fail this job in specific ways:

- **No urgency.** Nothing forces a decision; conversations drift.
- **No accountability.** It's easy to say "I'm in" and just as easy to quietly not follow through, with no record either way.
- **Distractions are legion.** The commitment thread is buried between everything else the group talks about.
- **Manual tracking is error-prone.** Someone — usually the admin — is manually tallying who's in, for how much, in their head or in a spreadsheet, off to the side of the chat.
- **No enforcement of caps or thresholds.** Nothing stops a fixed-size bundle from being oversold, or tells the group whether a required minimum number of buyers was actually reached.
- **No visibility into status.** Members can't easily tell whether an order is still open, how close it is to resolving, or whether their own stake is even confirmed.

This platform replaces the group chat as the *mechanism of commitment* — not the group's conversation itself, just the part where "who's in for what" needs to be a structured, time-boxed, and trustworthy record instead of a scroll-back exercise.

## Why this way

Group chats already give people a place to talk about a bulk order — what they don't give them is a forcing function. The core bet is that swapping the *commitment* step (not the conversation) out of chat and into a structured, time-boxed, enforced record is enough to fix the urgency/accountability/visibility problems. The platform's job is coordination, not commerce: it is not, and does not intend to become, a retailer that sells, stocks, ships, or fulfills anything itself.

## Success looks like

**Syndicates stop reverting to group chats.** The signal that matters is retention and habit: once a group tries running an order here, they keep coming back to it instead of falling back to a chat thread for the next one.

---

# Part 2 — Implementation & Roadmap

This part describes the platform as it exists today — a **proof of concept** — and what's planned beyond it. Unlike Part 1, expect this part to receive amendments as new versions are conceived, planned and released.

## Current implementation (PoC)

- **Syndicates** are member groups with exactly one **admin**. There's no public signup or self-serve syndicate creation: a syndicate and its admin are bootstrapped directly against the backend (by whoever operates the platform), and from there the admin invites members by email. (See *Related technical resources* below — this follows an established invite-only auth pattern, not an open registration flow.)
- The admin defines **items** — the things being pooled toward — in an admin-only UI. Item definitions persist and can be reused across multiple orders, so an admin isn't recreating the same item or bundle ofer every time they want to run a new order.
- Two pricing models, decided per item:
  - **Fixed-price bundles**, which require a minimum order quantity to unlock a fixed pack price.
  - **Per-unit tiered pricing**, where the price per unit slides based on cumulative quantity committed, with an optional ceiling on total supply.  Ex. 1 unit for $10, 5 units for $40 ($8 unit price), etc.
- The admin opens an **order window**: a time-boxed collection of one or more items, with a deadline.
- Members are notified when a new order opens — push notification on mobile, email otherwise — so the commitment moment is a distinct, surfaced event rather than something buried in a chat thread.
- Members commit a **stake**: their share of the quantity (and cost) of a given item. Stakes are visible, capped, and enforced — a stake that would oversell a bundle or bust a supply ceiling is rejected outright, not silently allowed and sorted out later.
- An order closes either automatically when its deadline elapses, or manually at the admin's discretion.
- Once closed, the admin has a finished order: a clear record of who committed to what, for how much. The admin can mark it **executed** once the actual off-platform purchase has been made — currently a pure audit flag, with no effect on funds (there are none to move yet — see Roadmap).
- **No payment moves through the app in the PoC.** A stake is a ledger entry only; members settle up externally, by whatever means the group already uses. This is a current scope boundary, not a permanent one — see *Payment handling* in the Roadmap below.

### PoC scope boundaries

- **Not a retailer.** It never sells, stocks, ships, or fulfills the products being pooled for.
- **No payment processing yet.** No money moves through the app; stakes are ledger entries members settle externally. Planned to change — see Roadmap.
- **No cross-order inventory tracking.** Supply caps apply per order-item instance, not as a running total across a product's history — the platform deliberately does not become an inventory system.
- **No open/public signup.** Syndicate membership is invite-only, issued by an admin — there is no self-serve account creation path.

### Platforms

Built with Expo / React Native, targeting Android, iOS, and web. **Web (as a PWA) is the launch priority** — it's the fastest path to something usable — with native mobile following.

### Business model

Out of scope for the PoC. This is currently a free/internal tool for a closed set of syndicates, not a commercial product with a pricing model. May be revisited once payment handling (below) exists.

### Upcoming technical decisions

Flagged here because they shape the product experience even though the decision itself is technical and not yet made.

**Item data flexibility.** The admin-facing item definition needs to feel flexible enough to cover different kinds of things a syndicate might pool toward — roughly the way a platform like Shopify lets very different sellers describe very different products under one general "product" concept. Two directions are on the table; the decision is deferred.

| | **Option 1 — Custom fields per item** | **Option 2 — Fixed shape, flexible content** |
|---|---|---|
| **Description** | Admins can add arbitrary fields to an item definition (e.g. size, flavor, variant, notes) — the item's *shape* itself is configurable per item. | Every item has the same structured fields (name, description, image, pricing config). Flexibility comes from what admins put *in* those fields, not from new fields. |
| **Pros** | Maximally flexible — genuinely fits arbitrary use cases without the schema anticipating them. Feels closest to the Shopify comparison. | Simple, predictable data model. Easy to build list/search/filter UI against a known shape. No schema-migration-shaped problems as usage grows. |
| **Cons** | Harder to build consistent UI on top of (list views, filtering, sorting all get harder against an open-ended shape). More validation/schema complexity on the backend (this is close to the kind of open-ended JSONB modeling `product_price_tier_plans` already does for tiered pricing — see `.claude/context/backend.md`). | Less flexible for edge-case use cases; admins describe unusual items by overloading `description`/`notes` rather than structured fields. |
| **Best fit if...** | Use cases turn out to be genuinely heterogeneous and the "one general item concept" bet needs to hold for a long tail of syndicate types. | Use cases converge on a fairly small number of shapes, and predictable UI/tooling matters more than open-endedness. |

**Decision: not yet made.**

### Open questions (PoC)

- **Stake edits/withdrawals** — can a member edit or withdraw a stake while an order is open, and what happens if that stake was on an item that already resolved early by hitting its cap? Not decided — tracked in detail in `.claude/context/backend.md`.
- *(Additional non-goals, pending — see stub above.)*

## Roadmap — next version

Features planned beyond the PoC. This list will grow.

### 1. Payment handling (escrow)

Today, a stake is a pure ledger figure — a promise, settled entirely off-platform. A future version aims to back that promise with real funds: syndicate members stake actual money into an escrow account, which the admin then has available to draw on when executing the order.  It is an item of interest to discover whether this may be a particularly well-suited use case for web3 technologies such as self-executing ("smart") contracts.

### *(Next roadmap item — TBD)*

## Related technical resources

- `.claude/context/backend.md` — the technical schema/spec companion to this document: Postgres/Supabase schema, triggers, and the open technical questions behind the product behavior described here.
- **Invite-Only Auth Blueprint** (artifact, drafted 2026-08-20, from a separate reference project `supabase-local-sales-dash`) — a reusable pattern for exactly the admin-bootstrapped, invite-only membership model described above: a role-bearing profile table mirrored from `auth.users` via trigger, a `SECURITY DEFINER` role-check function, and a single Edge Function gate around `auth.admin.inviteUserByEmail` that is the only code path allowed to create an account. This is the intended shape for how syndicate invites get implemented, adapted from `rep`/`team_lead` to this platform's `member`/`admin` roles.
