# Kleannr API — Frontend Integration Guide

> **Audience:** Customer mobile app (Flutter), Rider mobile app (Flutter), Admin web (any SPA framework).
> **Source of truth:** [SPEC.md](SPEC.md) (Appendix B has the locked client rules). This file is the developer-friendly walkthrough — same contract, more examples, more handholding.
> **Updated alongside:** any client-observable change in the API must update both SPEC.md and this file in the same commit.

---

## Table of Contents

- [Part 0 — Common (read this first)](#part-0--common-read-this-first)
  - [0.1 Base URL + versioning](#01-base-url--versioning)
  - [0.2 Authentication header](#02-authentication-header)
  - [0.3 Standard error response](#03-standard-error-response)
  - [0.4 Pagination](#04-pagination)
  - [0.5 Time + money + IDs](#05-time--money--ids)
  - [0.6 Idempotency keys](#06-idempotency-keys)
  - [0.7 Retry rules](#07-retry-rules)
- [Part 1 — Customer App (Flutter)](#part-1--customer-app-flutter)
- [Part 2 — Rider App (Flutter)](#part-2--rider-app-flutter)
- [Part 3 — Admin Panel (Web)](#part-3--admin-panel-web)

---

## Part 0 — Common (read this first)

Everything below applies to **all three clients**. Each app-specific section assumes you've internalized this part.

### 0.1 Base URL + versioning

```
Production:  https://api.kleannr.com/api/v1
Local dev:   http://localhost:18275/api/v1
```

The `/api/v1` prefix is **mandatory** — calls without it 404. Pin v1 in your HTTP client; v2 is years away.

> **🟢 Production is LIVE now.** `https://api.kleannr.com` is deployed (DigitalOcean + Cloudflare TLS, served from Cloudflare's Dhaka edge). You can build against it today. Currently enabled there: auth, catalog, **search**, cart, orders, addresses + **Google Maps geocoding**, profile pictures (**Cloudflare R2**), and **FCM push** infrastructure.
>
> **OTP in production is REAL SMS now (SSL Wireless) — live since 2026-06-02.** `code: "000000"` **no longer works** against `https://api.kleannr.com`; request an OTP and enter the real 6-digit code delivered by SMS (test with a real Bangladeshi number you control). The `000000` shortcut now survives **only in local dev** when the backend runs with `Auth:UseFixedLoadTestOtp=true` (see the dev-mode note in §1) — keep any hard-coded `000000` behind your own dev/staging build flag so it never ships in a release.

### 0.2 Authentication header

Every authenticated request:

```
Authorization: Bearer <accessToken>
```

- Access tokens are JWTs, valid for **15 minutes**.
- Refresh tokens valid for **30 days**, rotated on every refresh.
- On a `401` response from any endpoint **with** `Authorization` set: try `POST /auth/refresh` exactly once; if that also fails, clear local tokens and route the user to the sign-in screen.
- On a `401` with **no** `Authorization`: it's a missing-auth bug. Don't refresh.
- On a `403`: the user is logged in but lacks permission. Show "not allowed"; don't retry.

**Where to store tokens:**

| Platform | Access token | Refresh token |
|---|---|---|
| Flutter (Customer + Rider apps) | `flutter_secure_storage` (KeyStore / Keychain backed) | Same — `flutter_secure_storage` |
| Web (Admin panel) | In-memory only (JS variable / Zustand / Redux) | `HttpOnly` `Secure` `SameSite=Lax` cookie set by the server |

**Never** log tokens. Never put them in URLs. Never paste them in Slack / GitHub issues.

### 0.3 Standard error response

All errors are **RFC 7807 ProblemDetails**:

```json
{
  "status": 409,
  "title": "conflict",
  "detail": "rider_has_active_jobs",
  "code": "rider_has_active_jobs"
}
```

Mapping every client should implement:

| HTTP | `title` | What | Client does |
|---|---|---|---|
| 400 | `validation_failed` | Body / query failed validation | Surface field-level errors from `detail` |
| 401 | `unauthorized` | Token missing / invalid | Refresh once, else sign out |
| 403 | `forbidden` | Wrong role or unauthorized resource | Show toast; don't retry |
| 404 | `not_found` | Doesn't exist OR caller can't see it | Same UX as "not found" (IDOR-safe) |
| 409 | `conflict` | State machine / unique constraint | Show contextual message based on `code` |
| 429 | `rate_limited` | Too many requests | Back off (exponential), max 3 retries |
| 503 | `maps_unavailable` / `object_storage_unavailable` | External provider down or unconfigured | Fall back / hide the feature |
| 5xx | `internal_error` | Server bug | Retry once after 1s, then surface a generic error |

**The `detail` field is machine-readable.** Switch on it for UX text; don't show it raw. Known `code` values:

```
active_order, rider_has_active_jobs, cancel_not_allowed_in_current_status,
invalid_status_transition, override_not_allowed_in_terminal_status,
job_already_assigned, order_changed_concurrently, phone_already_in_use,
phone_in_use, out_of_service_area, no_vendor_in_area, cart_empty,
discount_rejected:<reason>, online_payment_not_supported_in_v1, last_admin,
service_area_not_found, vendor_not_in_order_area, vendor_inactive,
picture_url_invalid, picture_url_must_be_https, picture_url_not_from_allowed_storage,
object_storage_not_configured, fcm_not_configured, maps_not_configured,
invalid_otp, otp_attempts_exceeded, rate_limited, customer_only, rider_only,
admin_only, rider_not_found, vendor_not_found, order_not_found,
notification_not_found, user_not_found
```

### 0.4 Pagination

Every list endpoint takes `?page=<1-indexed>&pageSize=<1..50 or 1..100>`. Defaults: `page=1`, `pageSize=20`. Response wrapper:

```json
{
  "items": [ /* ... */ ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 42
}
```

### 0.5 Time + money + IDs

- **Times** — UTC ISO-8601 with `Z`: `"2026-05-14T07:30:00Z"`. Convert to local time for display only. Dhaka is `UTC+6`.
- **Money** — decimal with 2 places (`"260.00"`), paired with a `currency` field (always `"BDT"` in v1).
- **IDs** — lowercase hyphenated UUID: `"046ce7a9-7d5f-45dc-967b-d187ba1f8330"`.
- **Phone** — E.164 with `+` country prefix: `"+8801711111111"`.
- **Status enums** — integers in JSON. See [§5.4 of SPEC](SPEC.md#54-enums). For OrderStatus: `0=OrderPlaced, 1=RiderAssigned, 2=RiderArriving, 3=ItemsPickedUp, 4=HandOverToVendor, 5=ReturningForDelivery, 6=Delivered, 7=Cancelled`.

### 0.6 Idempotency keys

Only `POST /orders` accepts an `Idempotency-Key` header. Client generates a UUID **before** the call, persists it locally, sends the same key if the call is retried:

```dart
// Flutter pseudocode
final idempotencyKey = const Uuid().v4();
await prefs.setString('pending_order_key', idempotencyKey);
final response = await dio.post(
  '/api/v1/orders',
  data: { /* ... */ },
  options: Options(headers: { 'Idempotency-Key': idempotencyKey }),
);
// On success: clear the key. On retry: send the same key.
```

Same `(customerId, idempotencyKey)` pair always returns the original order — no duplicates.

### 0.7 Retry rules

| Endpoint type | Retry on 5xx / network error? | Retry on 4xx? |
|---|---|---|
| GET / PUT / DELETE | Yes — exponential backoff: 1s, 2s, 4s, then give up | Never |
| POST with `Idempotency-Key` | Yes — same key | Never |
| POST without `Idempotency-Key` | **No** — show "couldn't reach server" | Never |

---

## Part 1 — Customer App (Flutter)

The Customer app is the largest surface — it covers signup, browsing the catalog, cart, addresses, order placement, tracking, notifications, profile management, and self-delete.

### 1.1 Authentication — OTP signup / login

> **Dev mode — fixed OTP `000000`.** When the backend runs with `Auth:UseFixedLoadTestOtp=true`
> (local/dev only — never production), **every OTP is `000000`** and no real SMS is sent, so you can
> build + test the auth flow against any phone number without an SMS provider. Hard-code `000000` in
> your dev build behind your environment flag. In production the flag is `false` and a real 6-digit
> code is delivered by SMS (SSL Wireless) — so don't ship the hard-coded value. The per-phone OTP
> rate limit is also off in this mode, so rapid testing won't get throttled.

#### `POST /auth/otp/request` — send the SMS code

```
Headers: Content-Type: application/json
```

Request:
```json
{ "phone": "+8801711111111" }
```

Response — always 200, regardless of whether the phone exists (anti-enumeration):
```json
{}
```

#### `POST /auth/otp/verify` — verify code, get tokens

Request:
```json
{
  "phone": "+8801711111111",
  "code": "123456",
  "name": "Alice",
  "deviceId": "stable-device-uuid"
}
```

Response — 200:
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "rt_abc...",
  "expiresIn": 900,
  "user": {
    "id": "046ce7a9-7d5f-45dc-967b-d187ba1f8330",
    "name": "Alice",
    "role": 0
  }
}
```

Error — 401 `invalid_otp` (wrong code), 401 `otp_attempts_exceeded` (5+ wrong tries). (Authentication failures are 401, not 403 — your 401 interceptor handles them.)

**Locked rules:**
- `deviceId` is a stable per-install UUID. Generate once on first launch and persist.
- `name` only matters on first signup. Ignored for existing users.
- If the user was previously soft-deleted, the server auto-restores their account — no special handling.
- `role: 0` = Customer. `role: 1` = Rider. **If your customer app sees `role: 1`** in the response, log the user out — they're on the wrong app.

#### `POST /auth/refresh` — rotate tokens

Request:
```json
{ "refreshToken": "rt_abc...", "deviceId": "stable-device-uuid" }
```

Response — 200, same shape as `/auth/otp/verify` minus the user block. Call this when any endpoint returns 401 with a valid (but expired) access token. The old refresh token is invalidated.

#### `POST /auth/logout` — revoke refresh token

Request:
```json
{ "refreshToken": "rt_abc..." }
```

Response — 204 No Content.

**Always call this on user-initiated logout.** Also call `DELETE /me/fcm-tokens/{deviceId}` first (see §1.7) to stop receiving pushes.

### 1.2 Service area gating

Customer enters their location → check if you serve there before showing the catalog.

#### `POST /service-area/check`

Request:
```json
{ "lat": 23.7461, "lng": 90.3742 }
```

Response — 200:
```json
{
  "inService": true,
  "areaId": "046ce7a9-7d5f-45dc-967b-d187ba1f8330",
  "areaName": "Dhanmondi",
  "flatDeliveryFee": 60.00,
  "currency": "BDT"
}
```

If `inService: false`, show "We don't serve this area yet" and surface a waitlist signup if you have one.

### 1.3 Catalog browsing

#### `GET /wash-types`

No body. Response — 200:
```json
[
  { "id": "...", "name": "Regular Wash", "description": "...", "isActive": true, "sortOrder": 1 },
  { "id": "...", "name": "Dry Wash",     "description": "...", "isActive": true, "sortOrder": 2 }
]
```

#### `GET /cloth-categories?gender=0`

Query: `gender` is `0=Men, 1=Women, 2=Unisex, 3=Household`. Response — 200:
```json
[
  { "id": "...", "gender": 0, "name": "Shirt", "iconUrl": "https://...", "isActive": true, "sortOrder": 1 }
]
```

#### `GET /pricing?areaId={id}` — area-aware pricing

Response — 200:
```json
{
  "areaId": "...",
  "currency": "BDT",
  "items": [
    { "washTypeId": "...", "clothCategoryId": "...", "price": 40.00, "isOverride": false }
  ]
}
```

`isOverride: true` means this area has a custom price; `false` means the base price applies.

#### `GET /search?q={text}&areaId={id?}&gender={0-3?}` — catalog search

Customer types a product word; you get **one card per matching cloth category**. Because "T-shirt"
exists separately per gender, a search for `tshirt` returns Men's / Women's / Unisex cards as
separate results — group or label them by `gender` in the UI. Each card carries its wash options
with area-aware prices, so you can render the whole card without another call.

Request: `GET /api/v1/search?q=tshirt&areaId=<id>` (public, no auth).

Response — 200:
```json
{
  "query": "tshirt",
  "areaId": "...",
  "currency": "BDT",
  "results": [
    {
      "clothCategoryId": "...",
      "clothCategoryName": "T-shirt",
      "gender": 0,
      "iconUrl": "https://...",
      "matchReason": "synonym",
      "washOptions": [
        { "washTypeId": "...", "washTypeName": "Regular Wash", "price": 40.00, "isOverride": false },
        { "washTypeId": "...", "washTypeName": "Dry Wash",     "price": 60.00, "isOverride": true  }
      ]
    }
  ]
}
```

Client notes:
- **`gender` is an int** (`0=Men, 1=Women, 2=Unisex, 3=Household`) — same convention as everywhere else; map it to a label.
- **Search-as-you-type:** pass `areaId` so prices are correct for the customer's zone; debounce ~250 ms. A `q` shorter than 2 chars returns `200` with an empty `results` array — don't treat that as an error.
- **Forgiving matching is server-side:** `tshirt`, `t-shirt`, `genji` (synonym), and `tshrt` (typo) all resolve — you don't normalize on the client. `matchReason` (`name`/`synonym`/`fuzzy`) is informational; you can show a subtle "did you mean" hint for `fuzzy`.
- A category with no priced wash option is omitted server-side, so every card always has at least one `washOptions` entry.
- `areaId` that's unknown/inactive → `404` (same as `/pricing`); omit `areaId` to get base prices.

### 1.4 Addresses

#### `GET /addresses` (own)

Response — 200:
```json
[
  {
    "id": "...",
    "label": "Home",
    "lat": 23.7461,
    "lng": 90.3742,
    "formattedAddress": "Road 5, Dhanmondi, Dhaka 1209",
    "details": "Apt 3B",
    "serviceAreaId": "...",
    "isDefault": true
  }
]
```

#### `POST /addresses`

Request:
```json
{
  "label": "Home",
  "lat": 23.7461,
  "lng": 90.3742,
  "formattedAddress": "Road 5, Dhanmondi, Dhaka 1209",
  "details": "Apt 3B",
  "isDefault": true
}
```

Response — 201:
```json
{ "id": "...", "serviceAreaId": "...-or-null" }
```

**Locked behavior:**
- First address auto-becomes the default.
- Setting `isDefault: true` on a new address unmarks the previous default.
- Server auto-resolves `service_area_id` via PostGIS based on `lat`/`lng`. If the address is outside any area, `serviceAreaId` is `null` but the row is still created — useful for "save for later" UX.

#### `PATCH /addresses/{id}`, `DELETE /addresses/{id}` — same shapes as POST.

#### `POST /addresses/geocode` — server-side Google Geocoding proxy

Request:
```json
{ "query": "Road 5 Dhanmondi" }
```

Response — 200 (or `null` body if no result):
```json
{
  "lat": 23.7461,
  "lng": 90.3742,
  "formattedAddress": "Road 5, Dhanmondi, Dhaka 1209",
  "components": {
    "street": "Road 5",
    "city": "Dhaka",
    "postcode": "1209",
    "country": "Bangladesh"
  }
}
```

503 if Maps API key not configured. **Fallback:** drop the user into a map-pin-drop UI and POST `/addresses` directly with the picked lat/lng.

### 1.5 Cart

The cart is **1:1 with the user** — there's no `cartId` in URLs.

#### `GET /cart?areaId={id?}`

`areaId` is optional. If passed, the response includes `unitPrice` + `subtotal` calculated against that area's prices.

Response — 200:
```json
{
  "items": [
    {
      "id": "...",
      "washTypeId": "...",
      "washTypeName": "Regular Wash",
      "clothCategoryId": "...",
      "clothCategoryName": "Shirt",
      "quantity": 3,
      "unitPrice": 40.00,
      "currency": "BDT"
    }
  ],
  "subtotal": 120.00,
  "currency": "BDT"
}
```

`unitPrice`/`subtotal`/`currency` are `null`s when no `areaId` is supplied.

#### `POST /cart/items`

Request:
```json
{
  "washTypeId": "...",
  "clothCategoryId": "...",
  "quantity": 3
}
```

Response — 201:
```json
{ "id": "...", "quantity": 3 }
```

**Locked behavior:** if a cart item with the same `(washTypeId, clothCategoryId)` already exists, the server **merges** the quantity (adds to existing) instead of creating a duplicate.

#### `PATCH /cart/items/{itemId}`

Request:
```json
{ "quantity": 5 }
```

Response — 204.

#### `DELETE /cart/items/{itemId}` — 204. `DELETE /cart` — clears all items, 204.

### 1.6 Order placement + tracking

#### `POST /orders`

```
Headers: Content-Type: application/json
         Idempotency-Key: <client-generated-UUID>
         Authorization: Bearer <token>
```

Request:
```json
{
  "addressId": "...",
  "speed": 0,
  "paymentMethod": 0,
  "promoCode": "WELCOME10"
}
```

Field rules:
- `speed`: `0=Normal, 1=Fast, 2=UltraFast`. UltraFast doubles the delivery fee.
- `paymentMethod`: `0=Cod` (only valid value in v1). `1=Online` returns 409 `online_payment_not_supported_in_v1`.
- `promoCode`: optional. If passed and rejected, returns 409 `discount_rejected:<reason>` (`expired`, `min_subtotal`, `area_not_eligible`, `user_not_eligible`, `usage_limit_reached`, `not_found`). User-typed codes beat any auto-discounts.

Response — 201:
```json
{
  "id": "...",
  "orderNumber": "KLN-2026-000001",
  "status": 0,
  "riderId": null,
  "subtotal": 120.00,
  "discountAmount": 12.00,
  "deliveryFee": 60.00,
  "total": 168.00,
  "currency": "BDT",
  "paymentMethod": 0,
  "paymentStatus": 0
}
```

**v1.1 — `status` is always `0` (OrderPlaced) and `riderId` is always `null` in this response.** Rider dispatch runs asynchronously in a background job (Hangfire) right after the response is sent. The order is saved; cart is cleared. The customer learns about rider assignment in one of two ways:

1. **Push notification** — when the dispatch job picks a rider, the customer's device gets a `RiderAssigned` push (per the §14.2 trigger matrix). The notification's `data` block carries `orderId` and `statusCode: "1"` for in-app routing.
2. **Polling fallback** — if the customer is staring at the order screen waiting (and push permissions are denied), poll `GET /orders/{id}` every ~5 seconds for the first 30 seconds after placement.

**Recommended UX flow:**

```
POST /orders → 201 (status=OrderPlaced, riderId=null)
    ↓
Navigate to order detail screen
    ↓
Show "Looking for a rider…" with a subtle progress indicator
    ↓
EITHER push lands (data.statusCode=1) → repaint with rider info
        OR  poll GET /orders/{id} every 5s → riderId populated → repaint
    ↓
If still OrderPlaced after 60s → show "No rider available. Admin will assign one shortly."
    (Don't fail the order — admin uses /admin/orders/{id}/reassign-rider when a rider comes online.)
```

Dispatch is **idempotent** — if admin manually reassigns a rider before the job runs, the job sees it and skips. No risk of double-assignment.

Common errors:
- 409 `out_of_service_area` — pickup lat/lng outside any active service area.
- 409 `no_vendor_in_area` — no active vendor available in the area.
- 409 `cart_empty` — cart had zero items.
- 409 `cart_contains_inactive_items` — a wash type or cloth category was deactivated between cart add and checkout.

#### `GET /orders?status=active|past&page=&pageSize=` — own list

`status=active` filters to non-terminal; `status=past` filters to `Delivered`/`Cancelled`; omitted returns both.

Response — 200:
```json
{
  "items": [
    {
      "id": "...",
      "orderNumber": "KLN-2026-000001",
      "placedAt": "2026-05-14T07:30:00Z",
      "itemsSummary": "3 items · Regular Wash",
      "total": 168.00,
      "currency": "BDT",
      "status": 1,
      "paymentMethod": 0,
      "paymentStatus": 0
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 1
}
```

#### `GET /orders/{id}` — detail (customer/rider/admin)

Response — 200:
```json
{
  "id": "...",
  "orderNumber": "KLN-2026-000001",
  "customerId": "...",
  "riderId": "...",
  "vendorId": "...",
  "serviceAreaId": "...",
  "pickupAddress": {
    "addressId": "...", "label": "Home", "lat": 23.7461, "lng": 90.3742,
    "formattedAddress": "Road 5, Dhanmondi", "details": "Apt 3B"
  },
  "dropoffAddress": { /* same shape */ },
  "deliverySpeed": 0,
  "paymentMethod": 0,
  "paymentStatus": 0,
  "status": 5,
  "etaArrival": "2026-05-14T07:40:00Z",
  "etaDelivery": "2026-05-14T08:30:00Z",
  "subtotal": 120.00, "discountAmount": 12.00, "deliveryFee": 60.00,
  "total": 168.00, "currency": "BDT", "appliedDiscountId": "...",
  "placedAt": "2026-05-14T07:30:00Z",
  "cancelledAt": null, "deliveredAt": null,
  "items": [
    {
      "id": "...", "washTypeId": "...", "washTypeName": "Regular Wash",
      "clothCategoryId": "...", "clothCategoryName": "Shirt",
      "quantity": 3, "unitPrice": 40.00, "lineTotal": 120.00
    }
  ],
  "statusHistory": [
    { "status": 0, "at": "2026-05-14T07:30:00Z", "actorRole": 0, "note": null },
    { "status": 1, "at": "2026-05-14T07:30:01Z", "actorRole": 0, "note": null }
  ]
}
```

#### `POST /orders/{id}/cancel`

No body. Response — 200:
```json
{ "id": "...", "status": 7, "cancelledAt": "2026-05-14T07:32:00Z" }
```

**Allowed only in OrderPlaced / RiderAssigned / RiderArriving** (i.e. before the rider physically picks up clothes). Past that, 409 `cancel_not_allowed_in_current_status`. The customer app should check the order's current status before showing the cancel button.

### 1.7 FCM token management + notification inbox

#### `POST /me/fcm-tokens`

Request:
```json
{
  "deviceId": "stable-device-uuid",
  "token": "<FCM-token-from-Firebase-SDK>",
  "platform": "android"
}
```

`platform` is `"ios" | "android" | "web"`. Response — 204.

Re-registering same `(userId, deviceId)` updates the token in place. **Call this on every cold start** AND whenever Firebase fires `onTokenRefresh`.

#### `DELETE /me/fcm-tokens/{deviceId}` — call on logout. 204.

#### `GET /me/notifications?page=&pageSize=`

Response — 200:
```json
{
  "items": [
    {
      "id": "...",
      "type": "status_change",
      "title": "Items picked up",
      "body": "Your rider has collected your laundry. (KLN-2026-000001)",
      "data": "{\"type\":\"status_change\",\"orderId\":\"...\",\"statusCode\":\"3\"}",
      "sentAt": "2026-05-14T07:45:00Z",
      "readAt": null
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

`data` is a JSON string (server stores as JSONB; client parses).

#### `GET /me/notifications/unread-count`

Response — 200:
```json
{ "count": 3 }
```

**Drives the red dot.** Call on app launch. Poll every 60s when foreground IF the user has notifications disabled (silent FCM messages keep this fresh otherwise).

#### `POST /me/notifications/{id}/read` — 204. `POST /me/notifications/read-all` — 204.

### 1.8 Profile self-service

#### `GET /me`

Response — 200:
```json
{
  "id": "...",
  "name": "Alice",
  "phoneMasked": "+88017****1111",
  "profilePictureUrl": "https://kleannr-pics.example.com/users/.../pic.jpg",
  "role": 0,
  "serviceAreaId": null,
  "createdAt": "2026-05-14T07:00:00Z"
}
```

#### `PATCH /me`

Request:
```json
{
  "name": "Alice Khan",
  "profilePictureUrl": "https://kleannr-pics.example.com/users/.../pic.jpg",
  "clearProfilePicture": false
}
```

To **clear** the picture: send `clearProfilePicture: true` and `profilePictureUrl: null`. To **leave it unchanged**: send `clearProfilePicture: false` and omit `profilePictureUrl` (or send `null`).

Response — 200:
```json
{ "id": "...", "name": "Alice Khan", "profilePictureUrl": "..." }
```

Errors — 400 `picture_url_not_from_allowed_storage` (URL host doesn't match the bucket), 400 `picture_url_must_be_https`, 400 `object_storage_not_configured` (only if the server has no R2 config — see below).

#### `POST /me/profile-picture/presign` — get a presigned upload URL

Request:
```json
{ "contentType": "image/jpeg", "sizeBytes": 184523 }
```

Response — 200:
```json
{
  "uploadUrl": "https://<account>.r2.cloudflarestorage.com/kleannr-pics-prod/users/abc/9f8e7d.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Signature=...",
  "fileUrl":   "https://pub-xxxx.r2.dev/users/abc/9f8e7d.jpg",
  "expiresAt": "2026-05-21T07:45:00Z"
}
```

Backed by **Cloudflare R2**. Two distinct URLs — don't confuse them:
- **`uploadUrl`** — a one-time, time-limited (15 min) presigned **PUT** URL on the R2 S3 API host. `PUT` the image bytes here directly. Don't display it, don't store it, don't reuse it.
- **`fileUrl`** — the permanent **public** URL on the bucket's public host (`pub-xxxx.r2.dev` today; will become `pics.kleannr.com` once a custom domain is configured — same path, so existing `fileUrl`s keep working). This is what you send to `PATCH /me` and what you render as the avatar.

**`object_storage_unavailable` (503)** only happens if the server's R2 config is absent (e.g. a dev build without credentials). In a properly configured environment you won't see it — but keep the "hide the change-picture button on 503" fallback for safety.

**Locked flow:**
1. Resize image to ≤800×800 px in the app, re-encode JPEG quality 80 (~100-300 KB).
2. Call `/me/profile-picture/presign` with the compressed size + content type.
3. `PUT` the bytes directly to `uploadUrl` (NOT via our backend). Set the `Content-Type` header on the PUT to the **same** value you sent in step 2 — R2 binds it into the signature and rejects a mismatch.
4. Call `PATCH /me { profilePictureUrl: fileUrl }`.

Allowed content types: `image/jpeg`, `image/png`, `image/webp` (locked at presign, enforced by R2). Max size: 5 MB, enforced server-side at presign (you should never approach this after compression).

#### `POST /me/phone/change/request` + `/verify`

Request to `/request`:
```json
{ "newPhone": "+8801799999999" }
```

OTP arrives at the **NEW** phone. Then `/verify`:

```json
{ "newPhone": "+8801799999999", "code": "123456" }
```

Response — 200:
```json
{ "forceReauth": true }
```

**On `forceReauth: true`, clear local tokens and force re-sign-in** with the new number. The old JWT's phone-hash claim is now stale.

#### `POST /me/delete/request` + `/me/delete/confirm` — customer-only

```
Authorization: Bearer <customer-token>
```

No body on `/request`. Response — 200 `{}` OR 409 `active_order` (if the customer has any non-terminal orders).

`/confirm` body:
```json
{ "code": "123456" }
```

Response — 204. On success: account soft-deleted, refresh tokens revoked, FCM tokens deleted. Clear all local state, route to sign-in.

**Re-signup with the same phone auto-restores the original account** (same `userId`, history intact). Don't show "create account" UI on next sign-in — it's the same OTP flow.

### 1.9 Discount preview

#### `POST /discounts/validate`

Request:
```json
{ "code": "WELCOME10", "subtotal": 200.00, "currency": "BDT", "areaId": "..." }
```

Response — 200:
```json
{
  "valid": true,
  "code": "WELCOME10",
  "rewardType": 0,
  "discountAmount": 20.00,
  "currency": "BDT",
  "message": "10% off, max ৳50"
}
```

Or — 200 with `valid: false` and a `reason`:
```json
{ "valid": false, "reason": "expired" }
```

Use this for live "apply code" UX before placing the order. Server re-validates at checkout, so a `valid: true` here is informational only.

---

## Part 2 — Rider App (Flutter)

The rider app is **much smaller** than the customer app. The rider has no signup, no cart, no checkout — they're operational accounts that admin pre-creates.

### 2.1 Authentication

**Same OTP flow as customer.** See §1.1. The differences:
- Rider's User row was created by admin via `POST /admin/riders` (not self-signup).
- Verify response has `role: 1`.
- **If your rider app sees `role: 0`** (Customer): tell the user their phone wasn't enrolled as a rider yet — contact admin.

### 2.2 FCM registration

**Same as customer.** See §1.7. Call `POST /me/fcm-tokens` on every cold start.

### 2.3 Jobs list

#### `GET /rider/jobs?status=active|past&page=&pageSize=`

`status=active` filters to non-terminal; `past` to Delivered/Cancelled; omitted returns all. **Only the rider's own jobs are returned** — there's no open job pool in v1.

Response — 200:
```json
{
  "items": [
    {
      "id": "...",
      "orderNumber": "KLN-2026-000001",
      "status": 1,
      "placedAt": "2026-05-14T07:30:00Z",
      "vendorId": "...",
      "pickupAddress": {
        "lat": 23.7461, "lng": 90.3742,
        "formattedAddress": "Road 5, Dhanmondi", "label": "Home"
      },
      "dropoffAddress": { /* same shape */ },
      "itemCount": 3,
      "total": 168.00,
      "currency": "BDT",
      "deliverySpeed": 0
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

### 2.4 Order detail (rider's own)

#### `GET /orders/{id}` — same shape as customer (§1.6), but rider can only see jobs assigned to them (404 otherwise).

### 2.5 Status transitions

#### `POST /orders/{id}/status`

Request:
```json
{ "newStatus": 2, "lat": 23.7460, "lng": 90.3740 }
```

`newStatus` is the integer target. The 5 forward transitions:

| From → To | newStatus | lat/lng required? | What |
|---|---|---|---|
| RiderAssigned → RiderArriving | `2` | **Yes** | Rider is moving toward pickup (ETA computed) |
| RiderArriving → ItemsPickedUp | `3` | No | Rider has clothes |
| ItemsPickedUp → HandOverToVendor | `4` | No | Clothes dropped at vendor |
| HandOverToVendor → ReturningForDelivery | `5` | **Yes** | Vendor done, rider heading back (ETA computed) |
| ReturningForDelivery → Delivered | `6` | No | Done. COD payment row written automatically. |

Response — 200:
```json
{
  "id": "...",
  "status": 2,
  "etaArrival": "2026-05-14T07:40:00Z",
  "etaDelivery": null
}
```

Errors:
- 400 if `lat`/`lng` missing on `RiderArriving` or `ReturningForDelivery`.
- 409 `invalid_status_transition` if you skip a step.
- 404 if you're not assigned to this order (IDOR-safe — never reveals "this order exists for someone else").

### 2.6 Vendor override

#### `POST /orders/{id}/vendor`

Request:
```json
{ "newVendorId": "..." }
```

Response — 200:
```json
{ "id": "...", "vendorId": "...", "status": 2 }
```

**Allowed only in RiderAssigned / RiderArriving / ItemsPickedUp** (before `HandOverToVendor`). The new vendor must be **active** and **in the order's service area** (else 409 `vendor_not_in_order_area` or `vendor_inactive`).

### 2.7 Notification inbox

**Same as customer.** See §1.7. Riders receive pushes for:
- `RiderAssigned` (new job) — type `new_job`
- `Cancelled` (while assigned) — type `job_cancelled`
- Admin-reassign (job moved to another rider) — type `job_reassigned_away`

### 2.8 Profile self-service

**Mostly same as customer**, with two locked differences:

| Endpoint | Rider behavior |
|---|---|
| `PATCH /me` | Same. Rider can edit name + profile picture. |
| `POST /me/profile-picture/presign` | Same. |
| `POST /me/phone/change/request` + `/verify` | Same. |
| **`POST /me/delete/request`** | **403 Forbidden** for riders. Admin must remove them. |
| **`POST /me/delete/confirm`** | **403 Forbidden** for riders. |

**Hide the "Delete account" button** in the rider app — check `user.role` and don't render it.

### 2.9 Cash balance & ledger (read-only)

Phase 11.1 — the rider sees their cash position with admin, but cannot write anything. Every entry on their ledger comes from one of three sources:

- **Admin gave them cash** (`loose_change`) — morning float, small notes for change
- **A customer paid them** (`cod_collection`) — auto-written when an order hits `Delivered`
- **Admin recorded their deposit / adjustment** (`rider_deposit`, `admin_adjustment_*`) — when the rider hands cash back, or admin corrects a mistake

The **current due** is the sum of every entry. Positive means the rider still owes admin; negative means admin owes the rider (rare — usually rolls into the next loose-change).

#### `GET /me/cash/balance`

Returns:

```json
{
  "currentDue": 500.00,
  "currency": "BDT",
  "lastEntryAt": "2026-05-16T18:31:09.044663Z"
}
```

`lastEntryAt` is `null` for a rider who has never had any ledger activity.

**Display rule:** show `currentDue` prominently at the top of the rider's "My Cash" screen. Use the sign convention: positive = "You owe Kleannr 500 BDT," negative = "Kleannr owes you 300 BDT," zero = "All settled."

**Refresh rule:** re-fetch on every screen open + on every pull-to-refresh. There's no push notification for cash-ledger changes in v1 (admin's actions are the writes; the rider just reflects state).

#### `GET /me/cash/ledger?page=1&pageSize=20`

Returns paginated entries, newest first:

```json
{
  "items": [
    {
      "id": "cc36c383-86fa-4e2e-8727-e05631775aa7",
      "entryType": 4,
      "amount": -50.00,
      "reason": "Counterfeit note deduction",
      "orderNumber": null,
      "createdAt": "2026-05-16T18:31:10.179080Z"
    },
    {
      "id": "7097846d-9d8d-40a0-8fde-83f358d2f59f",
      "entryType": 2,
      "amount": -200.00,
      "reason": "bank slip #12345",
      "orderNumber": null,
      "createdAt": "2026-05-16T18:31:10.023105Z"
    },
    {
      "id": "6a2accb7-ef0a-4351-b16a-a68c4036e566",
      "entryType": 0,
      "amount": 500.00,
      "reason": "morning float",
      "orderNumber": null,
      "createdAt": "2026-05-16T18:31:09.044663Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 3
}
```

`pageSize` max is 50 for the rider endpoint.

**`entryType` decode** — drives the row icon + label in the UI:

| Value | Type | Sign | UI label |
|---|---|---|---|
| 0 | `loose_change` | + | "Cash received from admin" |
| 1 | `cod_collection` | + | "Customer payment (Order KLN-...)"  ← uses `orderNumber` |
| 2 | `rider_deposit` | − | "Deposit to admin" |
| 3 | `admin_adjustment_add` | + | "Admin adjustment (+)" |
| 4 | `admin_adjustment_subtract` | − | "Admin adjustment (−)" |

For type `1` (`cod_collection`), `orderNumber` is populated so the rider can tap through to the order detail. For other types, `orderNumber` is `null`.

#### Flutter snippet — "My Cash" screen

```dart
class MyCashScreen extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(myCashBalanceProvider);
    final ledger = ref.watch(myCashLedgerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Cash')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(myCashBalanceProvider);
          ref.invalidate(myCashLedgerProvider);
        },
        child: ListView(
          children: [
            balance.when(
              data: (b) => _BalanceCard(b),
              loading: () => const _BalanceSkeleton(),
              error: (e, _) => _ErrorTile(e.toString()),
            ),
            ...ledger.when(
              data: (l) => l.items.map(_LedgerRow.new).toList(),
              loading: () => [const _LedgerSkeleton()],
              error: (e, _) => [_ErrorTile(e.toString())],
            ),
          ],
        ),
      ),
    );
  }
}
```

#### What the rider CANNOT do

- ❌ Submit their own deposit. They hand cash to admin in person; admin records it.
- ❌ Adjust their own balance.
- ❌ View another rider's ledger.

All three are by design — cash goes through the admin, the system mirrors that.

---

## Part 3 — Admin Panel (Web)

The admin panel covers ~40 endpoints across user management, vendor management, service areas, catalog, promos, reports, and operational overrides.

### 3.1 Authentication

#### `POST /auth/admin/login`

Request:
```json
{
  "username": "admin",
  "password": "<password>",
  "deviceId": "admin-web-device"
}
```

Two response shapes:
- **TOTP enabled (production):**
  ```json
  { "totpRequired": true, "totpToken": "<short-lived-step-token>", "totpEnrollmentNeeded": false }
  ```
  Now show the TOTP entry screen and call `/auth/admin/totp/verify` next.
- **TOTP disabled (dev only):**
  ```json
  {
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 900,
    "user": { "id": "...", "name": "admin", "role": 3 }
  }
  ```

Errors — 401 with `code` of `invalid_credentials`, `admin_must_use_password_login` (if username belongs to a non-admin user trying password login). (Authentication failures are 401, not 403.)

#### `POST /auth/admin/totp/verify` — step 2

Request — **all three fields are required**; `deviceId` is mandatory (omitting it returns `400 validation_failed`, *not* a TOTP error):
```json
{ "totpToken": "<from-step-1>", "code": "123456", "deviceId": "admin-web-device" }
```

Response — 200, same shape as the TOTP-disabled login response. Auth errors are `401` (`invalid_totp_code` / `invalid_totp_token` / `totp_not_enabled`); a malformed body is `400`.

#### `POST /auth/admin/totp/setup` + `/confirm` — enrollment

`/setup` returns:
```json
{ "secret": "JBSWY3DPEHPK3PXP", "qrCodeBase64": "<raw base64 PNG — prepend data:image/png;base64, to render>", "otpAuthUri": "otpauth://totp/Kleannr:admin?secret=...&issuer=Kleannr&algorithm=SHA1&digits=6&period=30" }
```

User scans the QR with Google Authenticator, then `/confirm` (**`totpToken` is required too**):
```json
{ "totpToken": "<from-step-1>", "code": "123456" }
```

Response — 204.

#### Token storage (web only)

- Access token: in-memory only (JS variable / store).
- Refresh token: `HttpOnly` `Secure` `SameSite=Lax` cookie. The browser doesn't expose it to JS.
- On 401: hit `/auth/refresh` once; if that fails, redirect to login.

### 3.2 Service area management

#### `GET /admin/service-areas`

Response — 200:
```json
[
  {
    "id": "...",
    "name": "Dhanmondi",
    "code": "DHK_DHM",
    "flatDeliveryFee": 60.00,
    "currency": "BDT",
    "avgVendorProcessingMinutes": 120,
    "isActive": true
  }
]
```

#### `POST /admin/service-areas`

Request — a GeoJSON-ish polygon ring of `[lng, lat]` pairs (note the order):
```json
{
  "name": "Dhanmondi",
  "code": "DHK_DHM",
  "polygonRing": [
    [90.367, 23.738], [90.385, 23.738], [90.385, 23.752],
    [90.367, 23.752], [90.367, 23.738]
  ],
  "flatDeliveryFee": 60,
  "currency": "BDT",
  "avgVendorProcessingMinutes": 120
}
```

The first and last points must match (closed ring). Response — 201:
```json
{ "id": "..." }
```

#### `PATCH /admin/service-areas/{id}`, `POST /{id}/activate`, `POST /{id}/deactivate` — 204 each.

### 3.3 Catalog management

#### `POST /admin/wash-types`, `POST /admin/cloth-categories`

```json
// Wash type
{ "name": "Regular Wash", "description": null, "sortOrder": 1 }

// Cloth category
{ "gender": 0, "name": "Shirt", "iconUrl": "https://...", "sortOrder": 1 }
```

Response — 201 `{ "id": "..." }`. PATCH and DELETE follow standard CRUD patterns.

#### `PUT /admin/base-prices`

Request:
```json
{ "washTypeId": "...", "clothCategoryId": "...", "price": 40.00 }
```

Response — 200. Upsert behavior — replaces existing price for that (washType, clothCategory) pair.

#### `PUT /admin/areas/{areaId}/price-overrides`

Same shape as base-prices, scoped to a specific area. Overrides layer on top of base prices.

#### Search synonyms — `/admin/search-synonyms`

Curated aliases that make customer search forgiving for local slang the fuzzy matcher can't guess
(`genji` → `tshirt`, `shari` → `saree`). A `term` is what the customer types; `canonical` is the
catalog word it should resolve to. Both are **normalized server-side** on save (lowercased, spaces
and hyphens stripped) — so `"Tee-Shirt"` is stored as `teeshirt`.

```
GET    /admin/search-synonyms            → 200 [{ id, term, canonical, createdAt }]
POST   /admin/search-synonyms            → 201 { id }      body: { term, canonical }
PATCH  /admin/search-synonyms/{id}       → 204             body: { term, canonical }
DELETE /admin/search-synonyms/{id}       → 204
```

Admin web notes:
- Build a simple two-column editable table (term → canonical). The list is small; no pagination.
- Duplicate `term` (after normalization) → `409 conflict` (`synonym_term_exists`); surface "that alias already exists." Multiple terms may map to the same canonical (tee, genji → tshirt).
- A seeded BD starter set ships with the system; admins extend/trim it live (no deploy).
- Tip: the `canonical` should match an actual cloth-category name (normalized) to be useful — e.g. if your catalog calls it "T-shirt", map aliases to `tshirt`.

### 3.4 Vendor management

#### `POST /admin/vendors`

Request:
```json
{
  "name": "Dhanmondi Laundry",
  "phone": "+8801711000099",
  "lat": 23.7475,
  "lng": 90.3760,
  "serviceAreaId": "...",
  "addressText": "Road 5, Dhanmondi"
}
```

Response — 201:
```json
{ "id": "..." }
```

#### `GET /admin/vendors?areaId=&isActive=&page=&pageSize=`

Response — 200:
```json
{
  "items": [
    {
      "id": "...", "name": "Dhanmondi Laundry", "phone": "+8801711000099",
      "lat": 23.7475, "lng": 90.3760,
      "serviceAreaId": "...", "isActive": true,
      "addressText": "Road 5", "createdAt": "2026-05-14T07:00:00Z"
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

#### `PATCH /admin/vendors/{id}`

Request — same field set as POST minus `serviceAreaId` (not editable):
```json
{ "name": "...", "phone": "...", "lat": ..., "lng": ..., "addressText": "..." }
```

Response — 204.

#### `POST /admin/vendors/{id}/activate` / `/deactivate` — 204.

Deactivated vendors stop receiving new auto-assigned orders. Existing orders referencing them are unaffected.

### 3.5 Rider management

#### `POST /admin/riders`

Request:
```json
{
  "phone": "+8801711000099",
  "name": "Karim",
  "serviceAreaId": "..."
}
```

Response — 201:
```json
{
  "id": "...",
  "phone": "+8801711000099",
  "name": "Karim",
  "role": 1,
  "serviceAreaId": "..."
}
```

`serviceAreaId` is **mandatory** — riders without an area are never auto-dispatched.

#### `POST /admin/riders/{id}/move-area`

Request:
```json
{ "newAreaId": "..." }
```

Response — 200:
```json
{ "id": "...", "serviceAreaId": "..." }
```

**STRICT** — returns 409 `rider_has_active_jobs` if the rider has any active assigned order. Admin web should:
1. Before showing the "Move area" button, check rider's `activeJobs` via `GET /admin/riders`.
2. If `activeJobs > 0`, disable the button and link to the reassign-rider workflow.

### 3.6 User management

#### `GET /admin/users?role=&page=&pageSize=`

`role` is `0=Customer, 1=Rider, 2=Vendor, 3=Admin`. Response — 200:
```json
{
  "items": [
    {
      "id": "...", "name": "Alice",
      "phoneMasked": "+88017****1111",
      "role": 0,
      "serviceAreaId": null,
      "isDeleted": false,
      "createdAt": "2026-05-14T07:00:00Z"
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

#### `PATCH /admin/users/{id}`

Request:
```json
{ "name": "Alice Khan" }
```

**Name only** — phone goes through OTP self-service, role isn't editable via this endpoint, rider area uses the dedicated move-area endpoint. Response — 204.

#### `POST /admin/users/{id}/disable` + `/enable`

No body. Response — 204.

**Disable guards (409 codes):**
- Customer with active orders → `active_order`
- Rider with active assigned jobs → `rider_has_active_jobs`
- Last non-deleted admin → `last_admin`

Side effects of disable: refresh tokens revoked, FCM tokens deleted. Enable doesn't re-issue tokens — the user re-signs-in fresh.

### 3.7 Order overrides

#### `POST /admin/orders/{id}/reassign-rider`

Request:
```json
{ "riderId": "..." }
```

Response — 200:
```json
{ "id": "...", "riderId": "...", "status": 1 }
```

Allowed at any non-terminal status. Bypasses the area-match rule. Pushes both new rider ("new job") and previous rider, if any ("job reassigned away").

#### `POST /admin/orders/{id}/status`

Request:
```json
{ "newStatus": 3, "reason": "rider's phone died, picked up clothes manually" }
```

`reason` is **mandatory** (validated for non-empty). It's stored permanently in `order_status_events.note` as `admin_override:<reason>` — treat it like a commit message.

Response — 200:
```json
{ "id": "...", "status": 3, "reason": "..." }
```

**Terminal-state lock:** if the order is already `Delivered` or `Cancelled`, returns 409 `override_not_allowed_in_terminal_status`. Admin web should disable the status-change control on terminal orders with a tooltip explaining why.

### 3.8 Reports (read-only)

#### `GET /admin/orders` — admin's broad orders list

Query params: `status`, `areaId`, `customerId`, `riderId`, `vendorId`, `from` (ISO 8601 UTC), `to`, `page`, `pageSize`.

Response — 200:
```json
{
  "items": [
    {
      "id": "...", "orderNumber": "KLN-2026-000001", "status": 6,
      "customerId": "...", "riderId": "...", "vendorId": "...",
      "serviceAreaId": "...",
      "total": 168.00, "currency": "BDT",
      "paymentMethod": 0, "paymentStatus": 1,
      "placedAt": "2026-05-14T07:30:00Z",
      "deliveredAt": "2026-05-14T08:30:00Z",
      "cancelledAt": null
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

#### `GET /admin/payments`

Query params: `gateway` (`"cod"` in v1), `status`, `riderId`, `from`, `to`, `page`, `pageSize`.

Response — 200:
```json
{
  "items": [
    {
      "id": "...", "orderId": "...", "gateway": "cod",
      "txnId": null, "amount": 168.00, "status": 1,
      "collectedByRiderId": "...", "createdAt": "2026-05-14T08:30:00Z"
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

#### `GET /admin/riders` — roster with stats

Response — 200:
```json
{
  "items": [
    {
      "id": "...", "name": "Karim", "serviceAreaId": "...",
      "isDeleted": false, "createdAt": "2026-05-14T07:00:00Z",
      "activeJobs": 2, "completedJobs": 47, "totalCashCollected": 8400.00
    }
  ],
  "page": 1, "pageSize": 20, "totalCount": 1
}
```

### 3.9 Promo management

#### `GET /admin/discounts`

Response — 200, array of full discount records.

#### `POST /admin/discounts`

Request:
```json
{
  "name": "Welcome 10%",
  "code": "WELCOME10",
  "kind": 0,
  "rewardType": 0,
  "value": 10,
  "maxDiscount": 50.00,
  "activeFrom": "2026-05-14T00:00:00Z",
  "activeUntil": "2026-12-31T23:59:59Z",
  "minSubtotal": 100.00,
  "firstOrderOnly": false,
  "usageLimitTotal": 1000,
  "usageLimitPerUser": 1,
  "areaIds": ["...", "..."],
  "userIds": null
}
```

Field rules:
- `kind`: `0=PromoCode` (user types it), `1=Auto` (applied automatically when no code given).
- `rewardType`: `0=Percent, 1=FixedAmount, 2=FreeDelivery`.
- `value`: percentage 1-100 for Percent, amount for FixedAmount, ignored for FreeDelivery.
- `maxDiscount`: cap on Percent (e.g. "10% off, max ৳50").
- `code`: required when `kind=0`, omitted when `kind=1`. Stored uppercase; case-insensitive lookup at validation.
- `areaIds` / `userIds`: optional restrictions. `null` means "any area" / "any user."

Response — 201:
```json
{ "id": "..." }
```

#### `PATCH /admin/discounts/{id}` — same fields, partial update. 204.

#### `POST /admin/discounts/{id}/disable` + `/enable` — kill switch + revive. 204 each.

#### `DELETE /admin/discounts/{id}` — soft-delete. Returns 409 if there are usage rows referencing this discount; user must disable instead.

### 3.10 Operational rules for admin web

**Confirmation dialogs are mandatory** for destructive operations:
- `POST /admin/users/{id}/disable`
- `POST /admin/vendors/{id}/deactivate`
- `POST /admin/orders/{id}/status` (mandatory reason input — reject empty)
- `POST /admin/orders/{id}/reassign-rider`
- `POST /admin/riders/{id}/move-area`
- `DELETE /admin/discounts/{id}`

Show:
1. What's about to happen.
2. Side effects (e.g. "this will revoke the user's sessions and delete their push tokens").
3. A "type RIDER_NAME to confirm" pattern for irreversible-feeling actions like rider disable.

**Date pickers** in reports — convert local-timezone input to UTC ISO-8601 (`...Z`) before sending. The user clicks "Today"; you send `from=2026-05-14T00:00:00Z&to=2026-05-15T00:00:00Z`.

**No export endpoint in v1** — generate CSV client-side from paginated JSON. Server-side export lands in v1.x.

**Hangfire dashboard** (v1.1) — when push retry / dispatch async lands, the `/hangfire` URL will live behind admin auth. Add it to the admin nav as a separate link; nothing to integrate API-side.

### 3.11 Cash ledger management (Phase 11.1)

The admin owns every write to the rider cash ledger except COD (which the system auto-writes when an order hits `Delivered`). Three write endpoints, three read endpoints, one reporting endpoint.

#### The mental model

Every cash movement is a **row in the ledger** with a signed amount. The rider's "current due" is just `SUM(amount)`. The ledger is **append-only** — you fix mistakes by writing a compensating `admin_adjustment_*` row, never by editing or deleting.

| Action | Endpoint | Sign of stored amount |
|---|---|---|
| Admin gave rider cash | `POST .../cash/loose-change` | + (due grows) |
| Rider handed cash back | `POST .../cash/deposit` | − (due shrinks) |
| Manual correction | `POST .../cash/adjust` | sign of input |
| (Customer paid rider) | (system auto-write on `Delivered`) | + |

#### `POST /admin/riders/{riderId}/cash/loose-change`

Records cash given to the rider. Always positive — sets the entry sign internally.

Request:
```json
{ "amount": 500.00, "note": "morning float" }
```

Headers:
```
Authorization: Bearer <token>
Content-Type:  application/json
Idempotency-Key: <client-generated UUID per attempt>
```

Response `201`:
```json
{
  "entryId": "6a2accb7-ef0a-4351-b16a-a68c4036e566",
  "newBalance": 500.00,
  "currency": "BDT"
}
```

**Idempotency** — generate a fresh UUID per attempt and persist it locally **before** the network call. If the network drops and you retry with the same key, the server returns the **original** entry and balance — no double insert.

`note` is optional, up to 500 chars. Common values: `"morning float"`, `"top-up for change"`, etc.

#### `POST /admin/riders/{riderId}/cash/deposit`

Records cash the rider physically handed back. Pass the **absolute** amount; the server stores it as a negative ledger entry so the due shrinks.

Request:
```json
{ "amount": 200.00, "reference": "bank slip #12345" }
```

Same headers as loose-change. Response shape identical:
```json
{
  "entryId": "7097846d-9d8d-40a0-8fde-83f358d2f59f",
  "newBalance": 300.00,
  "currency": "BDT"
}
```

If the rider hands back more than they owe (overpaid), `newBalance` goes negative. That's OK — usually balanced by the next loose-change.

#### `POST /admin/riders/{riderId}/cash/adjust`

Manual correction with **mandatory reason** (≥10 characters). Sign of the input `amount` picks the entry type:

| Input | Entry type | Effect |
|---|---|---|
| Positive | `admin_adjustment_add` (3) | Due grows |
| Negative | `admin_adjustment_subtract` (4) | Due shrinks |

Request:
```json
{ "amount": -50.00, "reason": "Confirmed counterfeit note deduction" }
```

Response `201`:
```json
{
  "entryId": "cc36c383-86fa-4e2e-8727-e05631775aa7",
  "newBalance": 250.00,
  "currency": "BDT",
  "entryType": 4
}
```

**Reason validation** is server-enforced (≥10 chars). The admin UI must **also enforce it client-side** before sending, with a clear error message. Empty or short reasons return:

```json
{
  "title": "validation_failed",
  "status": 400,
  "detail": "Reason: The length of 'Reason' must be at least 10 characters. You entered 9 characters."
}
```

Treat the reason like a commit message — it's stamped permanently on the row and shows up in the rider's ledger feed forever.

#### `GET /admin/riders/{riderId}/cash/balance`

```json
{
  "riderId": "7fd027eb-bf52-479d-9c6d-c6f354ae7e5d",
  "currentDue": 250.00,
  "currency": "BDT",
  "lastEntryAt": "2026-05-16T18:31:10.179080Z"
}
```

#### `GET /admin/riders/{riderId}/cash/ledger?page=1&pageSize=20&entryType=&from=&to=`

Same shape as the rider's own ledger plus admin-only fields:

```json
{
  "items": [
    {
      "id": "cc36c383-86fa-4e2e-8727-e05631775aa7",
      "entryType": 4,
      "amount": -50.00,
      "reason": "Confirmed counterfeit note deduction",
      "orderId": null,
      "orderNumber": null,
      "paymentId": null,
      "createdByAdminId": "edfa1e71-4f09-4580-a78b-f15d7ffd7681",
      "createdAt": "2026-05-16T18:31:10.179080Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 3
}
```

Filters (all optional):
- `entryType` — `0..4` per the matrix above; isolates one row class
- `from`, `to` — UTC ISO-8601; bounds the `createdAt` range
- `pageSize` max is 100 on admin endpoints

`createdByAdminId` is `null` for `cod_collection` rows (system-written). `orderId` + `orderNumber` are populated only for `cod_collection`.

#### `GET /admin/cash/overview?from=&to=&bucket=day|week|month&areaId=&riderId=`

Time-bucketed revenue summary, aligned to **Dhaka local calendar** (`Asia/Dhaka`, UTC+6). Bucket choices:
- `day` — midnight Dhaka
- `week` — Sunday-start (BD work week)
- `month` — 1st of month, Dhaka

`from` and `to` are required. `areaId` and `riderId` are optional filters.

Response (truncated to show the shape — `rows` is empty here because no orders delivered in the window):
```json
{
  "bucket": "day",
  "from": "2026-05-15T00:00:00Z",
  "to":   "2026-05-17T00:00:00Z",
  "rows": [
    {
      "bucket": "2026-05-15T00:00:00Z",
      "totalCollected": 24500.00,
      "ordersDelivered": 47,
      "distinctCustomersServed": 38,
      "activeRiders": 6
    }
  ],
  "totals": {
    "totalCollected": 24500.00,
    "ordersDelivered": 47,
    "distinctCustomersServed": 38,
    "activeRiders": 6
  }
}
```

**This is the "how much money / how many customers" report.** Send the date range from the admin's local picker converted to UTC. The buckets in the response are aligned to Dhaka days, not UTC — a 23:55 Dhaka delivery counts on the right day in BD.

#### COD auto-write — what the admin will see without any action

When a rider transitions an order to `Delivered` (or admin force-completes it), the system writes:
1. A `payments` row (gateway=cod, status=Paid)
2. A `rider_cash_ledger` row of type `cod_collection`, signed positive, linked to the order and the payment

Both in the **same** `SaveChangesAsync` — there's no window where one exists without the other.

The admin's dashboard will see the rider's `currentDue` grow by the order total the moment the order is delivered. No manual entry needed.

#### UI patterns for the admin cash dashboard

- **Refresh button** (or auto-refresh on tab focus) — the admin pulls the latest state when they want it. There's no SignalR / push in v1; this is deliberate (SPEC §18.5.8).
- **Per-rider drill-down** — click a rider in the list, see their balance + ledger, with the three write actions inline.
- **Reason input is mandatory** for `adjust` — the form must reject `< 10` chars and disable the submit button until valid.
- **Idempotency keys** — generate a fresh UUID per submit attempt; persist it in the form state before the network call; resubmit with the same key if the network drops.
- **Display sign convention** — a positive `currentDue` of `250` means "rider owes us 250 BDT." Don't show raw numbers like `-50` without context; render as `"+500 BDT"` / `"−200 BDT"` with color cues (green for credit to rider, red for debit).

#### What admin cannot do

- ❌ Edit or delete an existing ledger row. Mistakes are fixed by recording a compensating `adjust` with a clear reason like `"reversing entry abc-123, wrong amount entered"`.
- ❌ Pay a rider directly through this surface. v1 is collection-only; rider payroll lands in v1.x (SPEC §27.4).

---

## Quick reference — endpoint matrix

For the full endpoint list with response shapes, see [SPEC.md §22](SPEC.md#22-endpoints-reference). For client rules and limits, see [SPEC.md Appendix B](SPEC.md#appendix-b--client-implementation-notes).

| Group | Customer | Rider | Admin |
|---|---|---|---|
| `/auth/*` | OTP signup, login, refresh, logout | OTP login (pre-created), refresh, logout | password+TOTP login |
| `/service-area/check` | ✅ | — | — |
| `/wash-types`, `/cloth-categories`, `/pricing` | ✅ public | ✅ public | ✅ |
| `/addresses` | ✅ own | — | — |
| `/addresses/geocode` | ✅ | — | — |
| `/cart` | ✅ own | — | — |
| `/discounts/validate` | ✅ | — | — |
| `/orders` POST/GET/cancel | ✅ own | — | — |
| `/orders/{id}` GET | ✅ own | ✅ if assigned | ✅ all |
| `/orders/{id}/status` | — | ✅ if assigned | (via admin endpoint) |
| `/orders/{id}/vendor` | — | ✅ if assigned | — |
| `/rider/jobs` | — | ✅ own | — |
| `/me/*` | ✅ all | ✅ except delete | ✅ except delete |
| `/me/cash/balance`, `/me/cash/ledger` | — | ✅ own (read-only) | — |
| `/admin/riders/{id}/cash/*` | — | — | ✅ write + read any rider |
| `/admin/cash/overview` | — | — | ✅ |
| `/admin/*` | — | — | ✅ |

---

*This guide is a living document. When the API changes, update this file in the same commit as the SPEC.md and code changes — the standing rule in CLAUDE.md applies.*
