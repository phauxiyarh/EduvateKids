/**
 * Eduvate Kids: Cloud Functions entrypoint.
 *
 * STRIPE is fully wired (test-mode ready). It stays guarded until the Blaze plan
 * is on and STRIPE_SECRET_KEY is set, then it creates real PaymentIntents.
 * PAYPAL is deferred: its callables remain guarded stubs (Phase D).
 *
 * Security invariants:
 *  - Totals are recomputed server-side from Firestore (client amounts ignored).
 *  - Orders are written only here (Admin SDK); clients cannot forge a paid order.
 *  - Order finalization is idempotent (webhook + client return safe).
 */
import { setGlobalOptions } from 'firebase-functions/v2';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  RESEND_API_KEY,
  USPS_CLIENT_ID,
  USPS_CLIENT_SECRET,
  GITHUB_DISPATCH_TOKEN,
  ALLOWED_ORIGINS,
  stripeConfigured,
  uspsConfigured,
} from './config';
import { noteCatalogChange, publishIfDue, publishNow } from './publish';
import { validateUsAddress } from './address';
import { priceCart, finalizeOrder } from './orders';
import { sendOrderNotification, sendBookRequestNotification, sendCustomerPurchaseEmail, sendSummerReminderBroadcast } from './email';
import { registerReader, logBook, editBook, deleteBook, resendReaderWelcome, setBookValidity, setReaderEligibility, type RegisterInput, type LogBookInput, type EditBookInput } from './summer';
import type { CreatePaymentInput, CustomerInfo, ShippingAddress, OrderItem } from './types';

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// A single, well-formed email address (no commas, whitespace, or angle brackets
// that could inject additional recipients/headers downstream).
const EMAIL_RE = /^[^\s@,<>";]+@[^\s@,<>";]+\.[^\s@,<>";]+$/;
function isValidEmail(v: unknown): v is string {
  const s = String(v ?? '').trim();
  return s.length <= 254 && EMAIL_RE.test(s);
}

/**
 * Bootstrap owner emails that are always admin (mirrors firestore.rules
 * isBootstrapAdmin). Keep in sync with the rules file.
 */
const BOOTSTRAP_ADMIN_EMAILS = ['admin@eduvatekids.com', 'eduvatekids@gmail.com'];

/**
 * Assert the caller is an admin. These summer-admin callables run with the Admin
 * SDK (which BYPASSES Firestore rules), so the admin check that rules would
 * normally enforce must be re-done here. An admin is a signed-in user whose
 * /users/{uid} doc has role 'admin', or a verified bootstrap-owner email.
 */
async function assertAdmin(request: { auth?: { uid?: string; token?: { email?: string; email_verified?: boolean } } }): Promise<void> {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in.');
  }
  const email = String(auth.token?.email ?? '').toLowerCase();
  if (auth.token?.email_verified === true && BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
    return;
  }
  const userSnap = await db.collection('users').doc(auth.uid).get();
  if (userSnap.exists && (userSnap.data() as { role?: string })?.role === 'admin') {
    return;
  }
  throw new HttpsError('permission-denied', 'Admin access is required.');
}

function assertValidPayload(data: CreatePaymentInput | undefined): asserts data is CreatePaymentInput {
  if (!data || !Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpsError('invalid-argument', 'Cart items are required.');
  }
  if (!data.customer?.name) {
    throw new HttpsError('invalid-argument', 'Customer name is required.');
  }
  if (!isValidEmail(data.customer?.email)) {
    throw new HttpsError('invalid-argument', 'A valid customer email is required.');
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
 * Returns { clientSecret, subtotal, shippingFee, tax, total, currency } for the Payment Element.
 * (rev: idempotency-key removed to fix StripeIdempotencyError on cart retries)
 */
export const createStripePaymentIntent = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: ALLOWED_ORIGINS },
  async (request) => {
    const data = request.data as CreatePaymentInput;
    assertValidPayload(data);

    const priced = await priceCart(db, data.items, data.shippingAddress.state);

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

    // No idempotency key here: each checkout attempt creates its own PaymentIntent
    // (a per-cart key would 400 on retries/abandoned carts). Duplicate ORDERS are
    // still prevented downstream by the deterministic order doc id keyed on the
    // PaymentIntent id (see finalizeOrder). Unpaid duplicate intents are harmless.
    const intent = await stripe.paymentIntents.create({
      amount: amountMinor,
      currency: priced.currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: data.customer.email,
      metadata: orderMetadata(priced.items, data.customer, data.shippingAddress, priced),
    });

    return {
      clientSecret: intent.client_secret,
      subtotal: priced.subtotal,
      shippingFee: priced.shippingFee,
      shipWeightGrams: priced.shipWeightGrams,
      shipZone: priced.shipZone,
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
        // Finalize after payment: don't block on stock (customer already paid).
        const priced = await priceCart(
          db,
          lines.map((l) => ({ id: l.id, quantity: l.q })),
          shippingAddress.state,
          false
        );

        const result = await finalizeOrder(db, {
          paymentRef: pi.id,
          provider: 'stripe',
          status: 'paid',
          items: priced.items,
          subtotal: priced.subtotal,
          shippingFee: priced.shippingFee,
          shipWeightGrams: priced.shipWeightGrams,
          shipZone: priced.shipZone,
          tax: priced.tax,
          total: priced.total,
          currency: priced.currency,
          customer,
          shippingAddress,
          live: pi.livemode,
        });
        logger.info('Order finalized from webhook', { orderId: result.orderId, created: result.created, pi: pi.id });

        // Notify the store on the FIRST creation only (idempotent, no duplicate
        // emails if Stripe retries the webhook). Email failures never fail the webhook.
        if (result.created) {
          await sendOrderNotification({
            orderId: result.orderId,
            items: priced.items,
            subtotal: priced.subtotal,
            shippingFee: priced.shippingFee,
            shipWeightGrams: priced.shipWeightGrams,
            shipZone: priced.shipZone,
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
 * then finalize the order. Idempotent (deterministic order id), a no-op if the
 * webhook already recorded it. Guarantees an order even if the webhook is delayed.
 */
export const finalizeStripeOrder = onCall(
  { secrets: [STRIPE_SECRET_KEY, RESEND_API_KEY], cors: ALLOWED_ORIGINS },
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
      // Finalize after payment: don't block on stock (customer already paid).
      const priced = await priceCart(db, lines.map((l) => ({ id: l.id, quantity: l.q })), shippingAddress.state, false);
      const result = await finalizeOrder(db, {
        paymentRef: pi.id, provider: 'stripe', status: 'paid',
        items: priced.items, subtotal: priced.subtotal, shippingFee: priced.shippingFee,
        shipWeightGrams: priced.shipWeightGrams, shipZone: priced.shipZone,
        tax: priced.tax, total: priced.total, currency: priced.currency,
        customer, shippingAddress, live: pi.livemode,
      });
      if (result.created) {
        await sendOrderNotification({
          orderId: result.orderId, items: priced.items, subtotal: priced.subtotal,
          shippingFee: priced.shippingFee, shipWeightGrams: priced.shipWeightGrams, shipZone: priced.shipZone,
          tax: priced.tax, total: priced.total,
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
export const registerSummerReader = onCall({ secrets: [RESEND_API_KEY], cors: ALLOWED_ORIGINS }, async (request) => {
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

// Map an internal summer error to an HttpsError code (not-found / permission / internal).
function summerError(err: unknown, fallback: string): HttpsError {
  const msg = (err as Error)?.message || fallback;
  if (msg.startsWith('not-authorized')) {
    return new HttpsError('permission-denied', 'The parent email does not match this code.');
  }
  return new HttpsError(msg.includes('not found') ? 'not-found' : 'internal', msg);
}

/** Log a parent-verified book against a code; recomputes count + tier server-side. */
export const logSummerBook = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const d = request.data as LogBookInput;
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (!isValidEmail(d?.parentEmail)) throw new HttpsError('invalid-argument', 'The parent email on file is required.');
  if (!d?.title?.trim()) throw new HttpsError('invalid-argument', 'A book title is required.');
  if (!d?.parentVerified) throw new HttpsError('invalid-argument', 'Parent verification is required.');
  try {
    return await logBook(db, d);
  } catch (err) {
    throw summerError(err, 'Could not log the book.');
  }
});

/** Edit a logged book at an index. */
export const editSummerBook = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const d = request.data as EditBookInput;
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (!isValidEmail(d?.parentEmail)) throw new HttpsError('invalid-argument', 'The parent email on file is required.');
  if (typeof d.index !== 'number') throw new HttpsError('invalid-argument', 'A book index is required.');
  if (!d?.title?.trim()) throw new HttpsError('invalid-argument', 'A book title is required.');
  try {
    return await editBook(db, d);
  } catch (err) {
    throw summerError(err, 'Could not edit the book.');
  }
});

/** Delete a logged book at an index; recomputes count + tier. */
export const deleteSummerBook = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const d = request.data as { code?: string; index?: number; parentEmail?: string };
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (!isValidEmail(d?.parentEmail)) throw new HttpsError('invalid-argument', 'The parent email on file is required.');
  if (typeof d.index !== 'number') throw new HttpsError('invalid-argument', 'A book index is required.');
  try {
    return await deleteBook(db, d.code, d.index, d.parentEmail as string);
  } catch (err) {
    throw summerError(err, 'Could not delete the book.');
  }
});

/**
 * Re-send the Summer Reads welcome email to a reader's parent (admin action for
 * readers who signed up before the welcome email existed). Requires BOTH the code
 * and the parent email on file, a bare code is not enough to trigger an email to
 * that inbox, which prevents anyone from spamming a parent by guessing codes.
 */
export const resendSummerWelcome = onCall({ secrets: [RESEND_API_KEY], cors: ALLOWED_ORIGINS }, async (request) => {
  const d = request.data as { code?: string; parentEmail?: string };
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (!isValidEmail(d?.parentEmail)) throw new HttpsError('invalid-argument', 'The parent email on file is required.');
  // Ownership: the supplied email must match the record before we send.
  const snap = await db.collection('summerReads').doc(d.code.trim().toUpperCase()).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Code not found.');
  const onFile = String((snap.data() as { parentEmail?: string })?.parentEmail ?? '').trim().toLowerCase();
  if (!onFile || onFile !== String(d.parentEmail).trim().toLowerCase()) {
    throw new HttpsError('permission-denied', 'The parent email does not match this code.');
  }
  try {
    return await resendReaderWelcome(db, d.code);
  } catch (err) {
    throw summerError(err, 'Could not re-send the welcome email.');
  }
});

/**
 * ADMIN-ONLY: silently mark a reader's logged book valid or invalid. Only valid
 * books count towards the reading goal / raffle eligibility. Recomputes the
 * reader's count + goalMet server-side.
 */
export const setSummerBookValidity = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  await assertAdmin(request);
  const d = request.data as { code?: string; index?: number; valid?: boolean };
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (typeof d.index !== 'number') throw new HttpsError('invalid-argument', 'A book index is required.');
  if (typeof d.valid !== 'boolean') throw new HttpsError('invalid-argument', 'A valid flag (true/false) is required.');
  try {
    return await setBookValidity(db, d.code, d.index, d.valid);
  } catch (err) {
    throw summerError(err, 'Could not update the book.');
  }
});

/**
 * ADMIN-ONLY: set or clear a reader's raffle-eligibility override. Pass
 * `eligible: true|false` to force it, or `eligible: null` to clear the override
 * and revert to the country-derived default.
 */
export const setSummerReaderEligibility = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  await assertAdmin(request);
  const d = request.data as { code?: string; eligible?: boolean | null };
  if (!d?.code?.trim()) throw new HttpsError('invalid-argument', 'A code is required.');
  if (!(d.eligible === true || d.eligible === false || d.eligible === null)) {
    throw new HttpsError('invalid-argument', 'eligible must be true, false, or null.');
  }
  try {
    return await setReaderEligibility(db, d.code, d.eligible);
  } catch (err) {
    throw summerError(err, 'Could not update eligibility.');
  }
});

/**
 * ADMIN-ONLY: broadcast the Summer Reads reminder email to every registered
 * parent. Recipients are read server-side from the `summerReads` collection
 * (the client never supplies the list), de-duplicated by email. Returns how many
 * were sent / failed.
 *
 * TEST MODE: if a valid `testEmail` is supplied, the email is sent ONLY to that
 * one address (a preview send for the admin to check before the real broadcast),
 * the registered parents are NOT contacted. The response carries `test: true`.
 */
export const sendSummerReminder = onCall({ secrets: [RESEND_API_KEY], cors: ALLOWED_ORIGINS }, async (request) => {
  await assertAdmin(request);
  const testEmail = String((request.data as { testEmail?: string })?.testEmail ?? '').trim();
  try {
    // Test send: one email to the given address only; nobody else is contacted.
    if (testEmail) {
      if (!isValidEmail(testEmail)) {
        throw new HttpsError('invalid-argument', 'The test email address is not valid.');
      }
      const result = await sendSummerReminderBroadcast([{ email: testEmail }]);
      logger.info('Summer reminder TEST send', { testEmail, ...result });
      return { ...result, recipients: 1, test: true };
    }
    const snap = await db.collection('summerReads').get();
    const byEmail = new Map<string, { email: string; parentName?: string; childName?: string }>();
    snap.forEach((docSnap) => {
      const data = docSnap.data() as { parentEmail?: string; parentName?: string; childName?: string };
      const email = String(data.parentEmail ?? '').trim();
      if (!isValidEmail(email)) return;
      const key = email.toLowerCase();
      // Keep the first registration per email (its child name greets the parent).
      if (!byEmail.has(key)) {
        byEmail.set(key, { email, parentName: data.parentName, childName: data.childName });
      }
    });
    const recipients = Array.from(byEmail.values());
    if (recipients.length === 0) {
      return { sent: 0, failed: 0, recipients: 0, skipped: false };
    }
    const result = await sendSummerReminderBroadcast(recipients);
    logger.info('Summer reminder broadcast triggered', { recipients: recipients.length, ...result });
    return { ...result, recipients: recipients.length };
  } catch (err) {
    // Preserve explicit validation errors (e.g. a bad test email) so the admin
    // sees the specific message rather than a generic failure.
    if (err instanceof HttpsError) throw err;
    logger.error('sendSummerReminder failed', err);
    throw new HttpsError('internal', 'Could not send the reminder broadcast. Please try again.');
  }
});

// ─────────────────────────── Book requests (out-of-stock pre-orders) ───────────────────────────

/**
 * Record a shopper's reservation for an out-of-stock book and notify the admin.
 * Written to the `bookRequests` collection (admin-only read; create is locked to
 * this function via Firestore rules). No payment, a reservation of intent only.
 */
export const submitBookRequest = onCall(
  { secrets: [RESEND_API_KEY], cors: ALLOWED_ORIGINS },
  async (request) => {
    const d = request.data as {
      bookId?: string;
      bookTitle?: string;
      name?: string;
      email?: string;
      phone?: string;
      quantity?: number;
    };
    if (!d?.name?.trim()) throw new HttpsError('invalid-argument', 'Your name is required.');
    if (!isValidEmail(d?.email)) throw new HttpsError('invalid-argument', 'A valid email is required.');
    if (!d?.bookTitle?.trim()) throw new HttpsError('invalid-argument', 'A book is required.');
    const quantity = Math.max(1, Math.min(999, Math.floor(Number(d.quantity) || 1)));

    try {
      const ref = db.collection('bookRequests').doc();
      await ref.set({
        bookId: String(d.bookId ?? '').trim(),
        bookTitle: d.bookTitle.trim().slice(0, 300),
        name: d.name.trim().slice(0, 200),
        email: String(d.email).trim().slice(0, 254),
        phone: String(d.phone ?? '').trim().slice(0, 40),
        quantity,
        status: 'requested',
        _live: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // Fire-and-forget notification (never fails the request).
      await sendBookRequestNotification({
        requestId: ref.id,
        bookTitle: d.bookTitle.trim(),
        quantity,
        name: d.name.trim(),
        email: String(d.email).trim(),
        phone: String(d.phone ?? '').trim(),
      });
      logger.info('Book request submitted', { requestId: ref.id, bookId: d.bookId });
      return { ok: true, id: ref.id };
    } catch (err) {
      logger.error('submitBookRequest failed', err);
      throw new HttpsError('internal', 'Could not submit your request. Please try again.');
    }
  }
);

/**
 * Manually send a customer their purchase-confirmation email for an existing
 * order (admin action, this email is NOT sent automatically on payment). Loads
 * the order server-side so the email always reflects the real order record.
 */
export const sendPurchaseEmail = onCall({ secrets: [RESEND_API_KEY], cors: ALLOWED_ORIGINS }, async (request) => {
  const d = request.data as { orderId?: string };
  const orderId = String(d?.orderId ?? '').trim();
  if (!orderId) throw new HttpsError('invalid-argument', 'An order id is required.');
  const snap = await db.collection('orders').doc(orderId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Order not found.');
  const o = snap.data() as {
    items?: OrderItem[];
    subtotal?: number;
    shippingFee?: number;
    tax?: number;
    total?: number;
    currency?: string;
    customer?: CustomerInfo;
    shippingAddress?: ShippingAddress;
  };
  if (!o.customer?.email || !isValidEmail(o.customer.email)) {
    throw new HttpsError('failed-precondition', 'This order has no valid customer email.');
  }
  try {
    await sendCustomerPurchaseEmail({
      orderId,
      items: Array.isArray(o.items) ? o.items : [],
      subtotal: Number(o.subtotal ?? 0),
      shippingFee: Number(o.shippingFee ?? 0),
      tax: Number(o.tax ?? 0),
      total: Number(o.total ?? 0),
      currency: String(o.currency ?? 'usd'),
      customer: o.customer,
      shippingAddress: o.shippingAddress as ShippingAddress,
    });
    return { ok: true, to: o.customer.email };
  } catch (err) {
    logger.error('sendPurchaseEmail failed', err);
    throw new HttpsError('internal', 'Could not send the purchase email. Please try again.');
  }
});

// ─────────────────────────── Address validation (USPS) ───────────────────────────

/**
 * Validate + standardise a US shipping address via USPS. Returns the corrected
 * address so the customer can confirm it before paying. If USPS credentials are
 * not configured, returns { available: false } so the client falls back to plain
 * entry rather than blocking checkout.
 */
export const validateAddress = onCall(
  { secrets: [USPS_CLIENT_ID, USPS_CLIENT_SECRET], cors: ALLOWED_ORIGINS },
  async (request) => {
    const a = (request.data as { address?: ShippingAddress })?.address;
    if (!a || !a.line1 || !a.city || !a.state || !a.postalCode || !a.country) {
      throw new HttpsError('invalid-argument', 'A complete address is required.');
    }
    if (!uspsConfigured()) {
      return { available: false };
    }
    try {
      const result = await validateUsAddress(a);
      return { available: true, ...result };
    } catch (err) {
      logger.error('validateAddress failed', err);
      // Do not block checkout on a validation outage.
      return { available: false };
    }
  }
);

// ─────────────────────── Publish static product pages ────────────────────────
// /book/<slug> pages are generated at build time from `catalog`, so a new book
// has no page until the site rebuilds. These fire the GitHub Actions deploy.

/**
 * Record every catalog change. Deliberately does no network work: it only
 * stamps a timestamp, and the scheduled sweep below decides when to build, so
 * editing ten books in a row costs ten cheap writes and one build.
 */
export const onCatalogWrite = onDocumentWritten('catalog/{docId}', async () => {
  await noteCatalogChange(db);
});

/**
 * Shelves are baked into the static /shelves page at build time, so editing
 * one in the admin has no visible effect until the site rebuilds. Without this
 * the admin saves successfully and nothing changes on the site.
 */
export const onShelfWrite = onDocumentWritten('shelves/{docId}', async () => {
  await noteCatalogChange(db);
});

/**
 * Debounce sweep. Runs every 5 minutes and builds only once the catalog has
 * been quiet for DEBOUNCE_MS and no build has happened since the last change.
 */
export const publishCatalogIfDue = onSchedule(
  { schedule: 'every 5 minutes', secrets: [GITHUB_DISPATCH_TOKEN] },
  async () => {
    try {
      const result = await publishIfDue(db, GITHUB_DISPATCH_TOKEN.value());
      if (result === 'built') logger.info('Scheduled catalog publish dispatched');
    } catch (error) {
      // Never throw: a failed dispatch must not retry-storm the scheduler.
      logger.error('Scheduled catalog publish failed', error);
    }
  },
);

/** Dashboard "Publish now" button. Admin-only, rate-limited inside publishNow. */
export const requestPublish = onCall(
  { secrets: [GITHUB_DISPATCH_TOKEN], cors: ALLOWED_ORIGINS },
  async (request) => {
    await assertAdmin(request);
    try {
      return await publishNow(db, GITHUB_DISPATCH_TOKEN.value());
    } catch (error) {
      logger.error('Manual publish failed', error);
      throw new HttpsError('internal', 'Could not start the publish. Please try again.');
    }
  },
);

// ─────────────────────────── PayPal (deferred, Phase D) ───────────────────────────
// Intentionally NOT deployed yet. The PayPal callables + their secrets
// (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are added in Phase D so the current
// Stripe-only deploy doesn't prompt for PayPal secrets that don't exist yet.
// See functions/src/config.ts (declarations kept) and the plan doc.
