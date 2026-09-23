# Phase 2 setup — server-owned credits

Credits are now granted by the SERVER against a purchase the platform signed,
not on the app's say-so. That fixes two things Phase 1 did not:

- a reinstall no longer loses paid credits (the balance lives server-side)
- a refunded or forged purchase cannot grant credits

## New endpoints

- `POST /api/credits/redeem` — app posts its signed purchase, server grants
- `GET  /api/credits/balance` — the server's number, which the app mirrors

Both require the `X-Install-Id` header that Phase 1 added.

## Environment variables to add in Vercel

### `REDEEM_ENFORCE` — leave UNSET at first

Unset (or "false") = **log-only mode**. A purchase that fails verification is
logged loudly and the credits are granted anyway.

That is on purpose. Verification code cannot be tested here — no npm, no
sandbox, no real receipts. Shipping it as authoritative on day one means a bug
sits between a paying customer and what they just bought, and the first you
hear of it is a refund request.

So: ship in log-only, watch the logs for `[redeem] verification FAILED`, and
set `REDEEM_ENFORCE=true` once real purchases are verifying cleanly.

### `APPLE_ROOT_CERTS` — required for iOS

Apple's root certificates, base64 DER, newline- or comma-separated.

Get them from https://www.apple.com/certificateauthority/ — you want
**Apple Root CA - G3** (and the older Apple Root CA does no harm). Convert:

    openssl x509 -inform der -in AppleRootCA-G3.cer -outform der | base64

Without this, every iOS redeem is REFUSED, never granted. That is deliberate:
failing open would hand credits to anyone who can send a POST.

### `APPLE_BUNDLE_ID` — optional

Defaults to `com.dreamteamapps.searchquest`. Set it if that is wrong.

### `GOOGLE_PLAY_PUBLIC_KEY` — required for Android

Play Console -> your app -> **Monetise -> Monetisation setup -> Licensing**.
Copy the base64 RSA public key. Same rule: absent means every Android redeem is
refused.

## Pack sizes live in redeem.ts

`PACKS` in `pages/api/credits/redeem.ts` maps product id -> credits. The server
is now the authority on what a pack is worth, so if you change a pack size in
App Store Connect or Play Console, change it there too or the two disagree.

## Client work still to do

The apps do not yet CALL these endpoints. iOS needs to send
`VerificationResult.jwsRepresentation` to `/api/credits/redeem` after a
purchase; Android needs `purchase.originalJson` + `purchase.signature`. Until
that is wired, purchases still only exist on the device.

## Suggested order

1. Push a branch, confirm the Vercel preview build is green.
2. Add `APPLE_ROOT_CERTS`. Leave `REDEEM_ENFORCE` unset.
3. Wire iOS to call redeem after a purchase, and balance on launch.
4. Ship. Watch the logs.
5. `REDEEM_ENFORCE=true` once verification is clean.
6. Only then retire the device-local credit balance as the source of truth.
7. Android after, since it has no installs yet.
