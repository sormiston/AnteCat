## ROADMAP

### BACKLOG
- [AUTH]: Nowhere in this schema is there a users table you control. Every person is just a row in Supabase's built-in auth.users, and Supabase locks that table down by default — this app's normal client-side queries (as authenticated/anon) aren't allowed to read it.
That's fine as long as all you ever do is store a user_id and compare UUIDs. But the moment a screen needs to show something human — "who's in this syndicate," "who staked how much on this item" — you need a name or email to put next to that UUID, and there's currently no allowed path to get one. The open question is simply: how do we let the app show member names/emails without giving it direct read access to auth.users?
- [REFACTOR][READABILITY]: rename all tables with t_ prefix
- [DB-INTEGRITY]: disallow reassignment of children, for example, no end-user should be able to reassign an `order_item_stake` to a different `order_item`
- [DB-INTEGRITY] for tiered products
- [SECURITY]: RLS is disabled on all 8 public tables (`order_item_stakes`, `order_items`, `orders`, `product_bundle_thresholds`, `product_price_tier_plans`, `products`, `syndicate_members`, `syndicates`) — flagged by the Supabase advisor during trigger verification. Every row is currently readable/writable by `anon`/`authenticated` through the Data API. Needs real policies designed per table (not a blanket enable, which would just lock everything out) before this goes anywhere near real users.