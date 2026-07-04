# Eduvate Kids — Cloud Functions

Payments (Stripe/PayPal), order finalization, and (later) Summer Reads integrity.
See `implementation_docs/Eduvate_Kids_Ecommerce_and_Summer_Reads_Plan.md` for the full plan.

## Status: Phase A (scaffold — nothing charges yet)

Payment functions validate the cart and compute the **authoritative** total from
Firestore, but are guarded: they return a clear "not configured" error until the
Blaze plan is on and provider secrets are set. Real Stripe/PayPal wiring lands in
Phases C/D.

## Prerequisites (owner, blocking)

1. **Enable the Firebase Blaze (pay-as-you-go) plan** on `eduvatekids-store`.
   Cloud Functions + outbound calls to Stripe/PayPal require it.
2. Node 20 locally (matches the functions runtime).

## Install & build

```bash
cd app/functions
npm install
npm run build      # tsc -> lib/
npm run typecheck  # tsc --noEmit
```

## Secrets (never commit these)

Set via the Firebase CLI (values only exist in Google Secret Manager):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY        # sk_test_... then sk_live_...
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET    # whsec_...
firebase functions:secrets:set PAYPAL_CLIENT_ID
firebase functions:secrets:set PAYPAL_CLIENT_SECRET
firebase functions:secrets:set PAYPAL_WEBHOOK_ID
```

Client-safe publishable values go in the site's env (`.env.local`, see `.env.local.example`):
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.

## Deploy

```bash
# from app/
firebase deploy --only functions
# Firestore rules deploy separately (do NOT forget after rules changes):
firebase deploy --only firestore:rules
```

## Local emulation (optional)

```bash
cd app/functions
npm run serve   # builds + starts the functions emulator
```

## Files

- `src/index.ts` — function entrypoints (guarded in Phase A)
- `src/config.ts` — secret/param declarations, CORS origins, "configured?" guards
- `src/orders.ts` — server-authoritative cart pricing + idempotent order finalization
- `src/types.ts` — shared order/cart types (mirror of `app/lib/orders.ts`)
