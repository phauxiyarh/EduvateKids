/**
 * Eduvate Kids — Cloud Functions entrypoint.
 *
 * STRIPE is fully wired (test-mode ready). It stays guarded until the Blaze plan
 * is on and STRIPE_SECRET_KEY is set — then it creates real PaymentIntents.
 * PAYPAL is deferred: its callables remain guarded stubs (Phase D).
 *
 * Security invariants:
 *  - Totals are recomputed server-side from Firestore (client amounts ignored).
 *  - Orders are written only here (Admin SDK); clients cannot forge a paid order.
 *  - Order finalization is idempotent (webhook + client return safe).
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY,
  stripeConfigured,
} from './config';
import { priceCart, finalizeOrder } from './orders';
import { sendOrderNotification } from './email';
import { registerReader, logBook, editBook, deleteBook, type RegisterInput, type LogBookInput, type EditBookInput } from './summer';
import type { CreatePaymentInput, CustomerInfo, ShippingAddress, OrderItem } from './types';

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

function assertValidPayload(data: CreatePaymentInput | undefined): asserts data is CreatePaymentInput {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpsError('invalid-argument', 'Cart items are required.');
  }
  if (!data.customer?.email || !data.customer?.name) {
    throw new HttpsError('invalid-argument', 'Customer name and email are required.');
  }
  const a = data.shippingAddress;
  if (!a?.line1 || !a?.city || !a?.state || !a?.postalCode || !a?.country) {
    throw new HttpsError('invalid-argument', 'A complete shipping address is required.');
  }
}

/** Compact metadata for Stripe (values must be strings; keep small). */
function orderMetadata(
  items: OrderItem[],
  customer: CustomerInfo,
  addr: ShippingAddress,
  breakdown: { subtotal: number; shippingFee: number; total: number; currency: string }
): Record<string, string> {
  return {
    ek_items: JSON.stringify(items.map((i) => ({ id: i.id, q: i.quantity }))).slice(0, 480),
    ek_customer: JSON.stringify(customer).slice(0, 480),
    ek_address: JSON.stringify(addr).slice(0, 480),
    ek_subtotal: String(breakdown.subtotal),
    ek_shipping: String(breakdown.shippingFee),
    ek_total: String(breakdown.total),
    ek_currency: breakdown.currency,
  };
}

/**
 * Stripe: create a PaymentIntent for the server-priced cart.
 * Returns { clientSecret, total, currency } for the Payment Element.
 */
export const createStripePaymentIntent = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const data = request.data as CreatePaymentInput;
    assertValidPayload(data);

    const priced = await priceCart(db, data.items);

    if (!stripeConfigured()) {
      throw new HttpsError(
        'failed-precondition',
        'Stripe is not configured yet (set STRIPE_SECRET_KEY + enable Blaze). ' +
          `Cart validated; authoritative total would be ${priced.total} ${priced.currency}.`
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2025-02-24.acacia' });

    // Stripe expects the smallest currency unit (cents).
    const amountMinor = Math.round(priced.total * 100);

    const intent = await stripe.paymentIntents.create(
      {
        amount: amountMinor,
        currency: priced.currency,
        automatic_payment_methods: { enabled: true },
        receipt_email: data.customer.email,
        metadata: orderMetadata(priced.items, data.customer, data.shippingAddress, priced),
      },
      { idempotencyKey: `ek_${data.customer.email}_${amountMinor}_${priced.items.map((i) => i.id + 'x' + i.quantity).join('_')}`.slice(0, 255) }
    );

    return {
      clientSecret: intent.client_secret,
      subtotal: priced.subtotal,
      shippingFee: priced.shippingFee,
      tax: priced.tax,
      total: priced.total,
      currency: priced.currency,
    };
  }
);

/**
 * Stripe webhook: verifies signature, finalizes the order on success.
 * Register this URL in Stripe and set STRIPE_WEBHOOK_SECRET.
 */
export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY] },
  async (req, res) => {
    if (!stripeConfigured()) {
      res.status(503).send('Stripe not configured');
      return;
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2025-02-24.acacia' });
    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as unknown as { rawBody: Buffer }).rawBody,
        sig as string,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.error('Stripe webhook signature verification failed', err);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
      return;
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;
      try {
        const md = pi.metadata || {};
        const lines = JSON.parse(md.ek_items || '[]') as Array<{ id: string; q: number }>;
        const customer = JSON.parse(md.ek_customer || '{}') as CustomerInfo;
        const shippingAddress = JSON.parse(md.ek_address || '{}') as ShippingAddress;

        // Re-price from Firestore to guarantee integrity even at finalize time.
        const priced = await priceCart(
          db,
          lines.map((l) => ({ id: l.id, quantity: l.q }))
        );

        const result = await finalizeOrder(db, {
          paymentRef: pi.id,
          provider: 'stripe',
          status: 'paid',
          items: priced.items,
          subtotal: priced.subtotal,
          shippingFee: priced.shippingFee,
          tax: priced.tax,
          total: priced.total,
          currency: priced.currency,
          customer,
          shippingAddress,
          live: pi.livemode,
        });
        logger.info('Order finalized from webhook', { orderId: result.orderId, created: result.created, pi: pi.id });

        // Notify the store on the FIRST creation only (idempotent — no duplicate
        // emails if Stripe retries the webhook). Email failures never fail the webhook.
        if (result.created) {
          await sendOrderNotification({
            orderId: result.orderId,
            items: priced.items,
            subtotal: priced.subtotal,
            shippingFee: priced.shippingFee,
            tax: priced.tax,
            total: priced.total,
            currency: priced.currency,
            customer,
            shippingAddress,
            paymentRef: pi.id,
            live: pi.livemode,
          });
        }
      } catch (err) {
        logger.error('Failed to finalize order from webhook', err);
        // 500 so Stripe retries.
        res.status(500).send('finalize failed');
        return;
      }
    }

    res.json({ received: true });
  }
);

/**
 * Client backstop: after the browser confirms payment, it calls this with the
 * PaymentIntent id. We fetch the PI from Stripe, verify it actually succeeded,
 * then finalize the order. Idempotent (deterministic order id) — a no-op if the
 * webhook already recorded it. Guarantees an order even if the webhook is delayed.
 */
export const finalizeStripeOrder = onCall(
  { secrets: [STRIPE_SECRET_KEY, RESEND_API_KEY], cors: true },
  async (request) => {
    if (!stripeConfigured()) {
      throw new HttpsError('failed-precondition', 'Stripe is not configured.');
    }
    const paymentIntentId = String((request.data as { paymentIntentId?: string })?.paymentIntentId || '');
    if (!paymentIntentId.startsWith('pi_')) {
      throw new HttpsError('invalid-argument', 'A valid paymentIntentId is required.');
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2025-02-24.acacia' });
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return { finalized: false, status: pi.status };
    }
    try {
      const md = pi.metadata || {};
      const lines = JSON.parse(md.ek_items || '[]') as Array<{ id: string; q: number }>;
      const customer = JSON.parse(md.ek_customer || '{}') as CustomerInfo;
      const shippingAddress = JSON.parse(md.ek_address || '{}') as ShippingAddress;
      const priced = await priceCart(db, lines.map((l) => ({ id: l.id, quantity: l.q })));
      const result = await finalizeOrder(db, {
        paymentRef: pi.id, provider: 'stripe', status: 'paid',
        items: priced.items, subtotal: priced.subtotal, shippingFee: priced.shippingFee,
        tax: priced.tax, total: priced.total, currency: priced.currency,
        customer, shippingAddress, live: pi.livemode,
      });
      if (result.created) {
        await sendOrderNotification({
          orderId: result.orderId, items: priced.items, subtotal: priced.subtotal,
          shippingFee: priced.shippingFee, tax: priced.tax, total: priced.total,
          currency: priced.currency, customer, shippingAddress, paymentRef: pi.id, live: pi.livemode,
        });
      }
      return { finalized: true, orderId: result.orderId, created: result.created };
    } catch (err) {
      logger.error('finalizeStripeOrder failed', err);
      throw new HttpsError('internal', 'Could not finalize the order.');
    }
  }
);

// ─────────────────────────── Summer Reading Program ───────────────────────────

/** Register a child and return a guaranteed-unique code (server-generated). */
export const registerSummerReader = onCall({ cors: true }, async (request) => {
  const d = request.data as RegisterInput;
  if (!d?.childName?.trim() || !d?.parentName?.trim() || !d?.parentEmail?.trim()) {
    throw new HttpsError('invalid-argument', 'Child name, parent name, and parent email are required.');
  }
  if (!d.consent) {
    throw new HttpsError('invalid-argument', 'Parent consent is required to register.');
  }
  try {
    return await registerReader(db, d);
  } catch (err) {
    logger.error('registerSummerReader failed', err);
    throw new HttpsError('internal', 'Could not complete registration. Please try again.');
  }
});

/** Log a parent-verified book against a code; recomputes count + tier server-side. */
export const logSummerBook = onCall({ cors: true }, async (request) => {
  const d = request.data as LogBookInput;
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (!d?.title?.trim()) throw new HttpsError('invalid-argument', 'A book title is required.');
  if (!d?.parentVerified) throw new HttpsError('invalid-argument', 'Parent verification is required.');
  try {
    return await logBook(db, d);
  } catch (err) {
    const msg = (err as Error)?.message || 'Could not log the book.';
    // Surface "code not found" cleanly; treat the rest as internal.
    throw new HttpsError(msg.includes('not found') ? 'not-found' : 'internal', msg);
  }
});

/** Edit a logged book at an index. */
export const editSummerBook = onCall({ cors: true }, async (request) => {
  const d = request.data as EditBookInput;
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (typeof d.index !== 'number') throw new HttpsError('invalid-argument', 'A book index is required.');
  if (!d?.title?.trim()) throw new HttpsError('invalid-argument', 'A book title is required.');
  try {
    return await editBook(db, d);
  } catch (err) {
    const msg = (err as Error)?.message || 'Could not edit the book.';
    throw new HttpsError(msg.includes('not found') ? 'not-found' : 'internal', msg);
  }
});

/** Delete a logged book at an index; recomputes count + tier. */
export const deleteSummerBook = onCall({ cors: true }, async (request) => {
  const d = request.data as { code?: string; index?: number };
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (typeof d.index !== 'number') throw new HttpsError('invalid-argument', 'A book index is required.');
  try {
    return await deleteBook(db, d.code, d.index);
  } catch (err) {
    const msg = (err as Error)?.message || 'Could not delete the book.';
    throw new HttpsError(msg.includes('not found') ? 'not-found' : 'internal', msg);
  }
});

// ─────────────────────────── PayPal (deferred — Phase D) ───────────────────────────
// Intentionally NOT deployed yet. The PayPal callables + their secrets
// (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are added in Phase D so the current
// Stripe-only deploy doesn't prompt for PayPal secrets that don't exist yet.
// See functions/src/config.ts (declarations kept) and the plan doc.
