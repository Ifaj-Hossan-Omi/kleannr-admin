# Backend Requests — from the Admin Panel

Cross-repo asks discovered while wiring the KleanNr **admin panel** against the live API
(`https://api.kleannr.com/api/v1`). The admin repo shares **no code** with the backend, so these
are contract/behaviour requests for the ASP.NET API team. Each is verified against prod.

> Status key: 🔵 proposed · 🟡 acknowledged · 🟢 shipped

---

## BR-1 🔵 Hard-delete (purge) for catalog items

**Area:** Catalog management — `/admin/wash-types`, `/admin/cloth-categories`

### Current behaviour (verified 2026-06-01)
`DELETE /admin/wash-types/{id}` and `DELETE /admin/cloth-categories/{id}` are **soft deletes**:
they return `204` but only set `isActive = false`. The row stays in the admin list
(`GET /admin/wash-types` still returns it), and `?permanent=true` is ignored. There is no way to
remove a catalog item permanently through the API.

This is **correct and desirable for items that have history** — orders reference the wash type /
cloth category (and the price at order time), and base prices are keyed by (washType × clothCategory),
so hard-deleting them would orphan historical orders, receipts, and reports.

### Problem
Because *every* "delete" is just a deactivate, and the admin list returns all rows (active +
inactive) with only an `isActive` flag (no `isDeleted`), the admin list **accumulates** items that
can never be removed. A mistyped wash type created and immediately "deleted" is stuck forever as an
inactive row. There is no purge path even for genuinely **unreferenced** items.

### Request
A true delete that is **allowed only when the item is not referenced by any order**:

```
DELETE /admin/wash-types/{id}?purge=true
DELETE /admin/cloth-categories/{id}?purge=true
```
(or a dedicated route, e.g. `POST /admin/wash-types/{id}/purge` — your call.)

Behaviour:
- **No order references it** → hard-delete the row and cascade-remove its derived config (base
  prices + area price overrides +, for categories, search-synonym links). Return `204`.
- **An order references it** → `409` with a machine-readable code (`wash_type_in_use` /
  `cloth_category_in_use`) + human `detail`. (Base-price references alone should **not** block —
  those are derived config the panel can recreate; only *order* references protect history.)

Plain `DELETE` (no `purge`) keeps its current soft-delete behaviour.

### Acceptance criteria
- Purging an unreferenced wash type/category removes it from `GET /admin/wash-types|cloth-categories`.
- Purging an item referenced by ≥1 order returns `409 {code}` and leaves the item intact.
- No orphaned base-price / price-override rows remain after a successful purge.

### Frontend follow-up (admin repo)
Once shipped, the panel restores a row-level **Delete** that calls `?purge=true`, catches the
`*_in_use` 409 (add the codes to `CODE_MESSAGES` in `src/lib/errors.ts`), and offers "Deactivate
instead". Until then, the **Active toggle** is the only lifecycle control.

**Priority:** low — cosmetic/hygiene; deactivate already covers the functional need.

---

## BR-2 🔵 Return the polygon ring on the service-area GET

**Area:** Service area management — `/admin/service-areas`

### Current behaviour (verified 2026-06-01)
`GET /admin/service-areas` omits `polygonRing`, and `GET /admin/service-areas/{id}` → **404**. So once
an area is created, its boundary can't be read back — the admin panel can draw + POST a new area but
**can't preview or re-edit an existing area's boundary** on the map (view mode shows metadata only).

### Request
Either include `polygonRing` (the stored closed `[lng, lat]` ring) in the list items, **or** add
`GET /admin/service-areas/{id}` returning the full area including the ring. Then the admin map can
render saved boundaries and support editing them (re-draw → `PATCH`).

### Acceptance criteria
- Some GET exposes each area's `polygonRing`.
- The admin Service Areas map can display and edit saved boundaries.

**Priority:** medium — without it, area boundaries are write-once (drawable, never viewable).

---

## BR-3 🔵 Return discount restriction fields on GET (and honor true partial PATCH)

**Area:** Discount management — `/admin/discounts`

### Current behaviour (verified 2026-06-01)
`GET /admin/discounts` returns a summary that **omits** `minSubtotal`, `firstOrderOnly`,
`usageLimitPerUser`, `areaIds`, and `userIds`. And `PATCH /admin/discounts/{id}` validates the
**whole** object — a partial body like `{ "name": "..." }` → `400` ("ActiveFrom must be less than
'01/01/0001 00:00:00'"), and omitted fields reset to their defaults rather than staying unchanged.

### Problem
The admin can't cleanly edit a discount: the restriction fields can't be pre-filled (not returned),
and a PATCH that omits them silently resets them. The panel works around this by sending the **full**
body on edit and warning the admin to re-enter restrictions — clunky and error-prone.

### Request
- Include the restriction fields in the discount GET (list, and/or a `GET /admin/discounts/{id}`).
- Make PATCH a true partial update (omitted fields unchanged), or document it as a full replace.

### Acceptance criteria
- A GET exposes a discount's full field set.
- Editing one field (e.g. the percentage) leaves the others intact.

**Priority:** medium — edit is lossy today without re-entering every restriction.

---

## BR-4 🔵 Admin orders — customer name + an order-detail endpoint

**Area:** Orders — `/admin/orders`

### Current behaviour (verified 2026-06-01)
`GET /admin/orders` returns IDs only (`customerId`, `riderId`, `vendorId`, `serviceAreaId`) — **no
customer name/phone** — and there is **no admin order-detail endpoint** (no line items, no status
history/timeline). `status` filters by **int** (0–7); `?status=active` → 400.

### Problem
The admin can't identify the customer on an order, nor see what was ordered or the status history.
The panel shows order #, area/rider/vendor (via client-side lookups), payment, total, and the
override actions — but the drawer can't show items or a timeline.

### Request
- Include `customerName` (+ masked phone), and ideally rider/vendor/area **names**, in the list items.
- Add `GET /admin/orders/{id}` returning line items, the status-event history, and customer/contact.

### Acceptance criteria
- The orders list shows a human-readable customer.
- A detail endpoint returns items + status timeline for the drawer.

**Priority:** medium — needed for real order triage; the screen is otherwise wired + empty-verified.

---

## Cleanup task 🔵 Purge admin-panel test artifacts

While verifying the catalog wiring end-to-end against prod, the diagnostics created a few items
that are now **soft-deleted (inactive)** and — per BR-1 — cannot be removed via the API. They are
invisible to customers but clutter the admin catalog list. **None are referenced by any real
order** (only the verification script ever touched them), so they are safe to hard-delete.

**Wash types**
| id | name |
|---|---|
| `ab1d3330-422a-4589-8e5f-4c712b739e63` | ZZ Active |
| `061f0fd2-db95-48c2-8412-88b5b79ee321` | ZZ Diagnostics Wash |
| `8ca322a9-e828-4382-86a6-a6c2a57b550d` | ZZ Inactive |
| `42873c55-0d59-48ce-b224-dc4711ea0575` | ZZ WashE2E |

**Cloth categories**
| id | name |
|---|---|
| `3fa33b8b-2941-4c3d-8421-0f649e04be8e` | ZZ ClothE2E |

There is also one **base price** linking `ZZ WashE2E` × `ZZ ClothE2E` (price 42) that should go too.

### Option A — once BR-1 ships
Five `DELETE …?purge=true` calls (four wash types + one category); the base price cascades.

### Option B — one-off SQL now (adapt table/column names to the real schema)
```sql
-- remove derived prices first to avoid FK violations
DELETE FROM base_prices
WHERE wash_type_id IN (
  'ab1d3330-422a-4589-8e5f-4c712b739e63',
  '061f0fd2-db95-48c2-8412-88b5b79ee321',
  '8ca322a9-e828-4382-86a6-a6c2a57b550d',
  '42873c55-0d59-48ce-b224-dc4711ea0575'
) OR cloth_category_id = '3fa33b8b-2941-4c3d-8421-0f649e04be8e';

DELETE FROM wash_types WHERE id IN (
  'ab1d3330-422a-4589-8e5f-4c712b739e63',
  '061f0fd2-db95-48c2-8412-88b5b79ee321',
  '8ca322a9-e828-4382-86a6-a6c2a57b550d',
  '42873c55-0d59-48ce-b224-dc4711ea0575'
);

DELETE FROM cloth_categories WHERE id = '3fa33b8b-2941-4c3d-8421-0f649e04be8e';
```

---

*Real seed data created in the same session (Regular Wash, Dry Clean, Premium Wash, Iron Only +
10 categories + 37 prices) is intentional — keep it.*
