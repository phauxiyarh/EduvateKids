/**
 * Central config for Cloud Functions.
 *
 * Secrets are declared via firebase-functions params (defineSecret). They are
 * never committed. Set them with:
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 * (PayPal secrets are added in Phase D.)
 *
 * Note: declaring a secret makes Firebase prompt for it at deploy time, so only
 * secrets actually used by a deployed function should be declared here.
 */
import { defineSecret, defineString } from 'firebase-functions/params';

export const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
export const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// PayPal secrets are intentionally NOT declared yet (Phase D). Declaring a secret
// makes Firebase prompt for it at deploy time even if unused, so we keep these
// commented until PayPal is wired. Restore in Phase D:
//   export const PAYPAL_CLIENT_ID = defineSecret('PAYPAL_CLIENT_ID');
//   export const PAYPAL_CLIENT_SECRET = defineSecret('PAYPAL_CLIENT_SECRET');
//   export const PAYPAL_WEBHOOK_ID = defineSecret('PAYPAL_WEBHOOK_ID');

/** Non-secret config (safe defaults; override via environment if desired). */
export const CURRENCY = defineString('EK_CURRENCY', { default: 'usd' });
export const FLAT_SHIPPING_FEE = defineString('EK_SHIPPING_FEE', { default: '5.99' });
export const FREE_SHIPPING_THRESHOLD = defineString('EK_FREE_SHIPPING_OVER', { default: '50' });
/** Flat sales-tax rate as a percentage of subtotal (Maryland = 6). Override via env EK_TAX_RATE. */
export const TAX_RATE_PERCENT = defineString('EK_TAX_RATE', { default: '6' });

/** Allowed browser origins for CORS on callable/onRequest endpoints. */
export const ALLOWED_ORIGINS = [
  'https://eduvatekids-store.web.app',
  'https://eduvatekids-store.firebaseapp.com',
  'http://localhost:8050',
];

/** True once a Stripe secret is actually present at runtime. */
export function stripeConfigured(): boolean {
  try {
    return Boolean(STRIPE_SECRET_KEY.value());
  } catch {
    return false;
  }
}

/** True once a Resend API key is present (order-notification emails). */
export function emailConfigured(): boolean {
  try {
    return Boolean(RESEND_API_KEY.value());
  } catch {
    return false;
  }
}

/**
 * Where new-order notifications are sent.
 * NOTE: With Resend's shared sender (onboarding@resend.dev) and NO verified domain,
 * Resend only delivers to the Resend account owner's email. Using the account owner
 * (thalamuxtech@gmail.com) for now so notifications work in test mode.
 * To send to eduvatekids@gmail.com, verify a domain in Resend and switch ORDER_NOTIFY_FROM
 * to an address on that domain — then this can be any recipient.
 */
export const ORDER_NOTIFY_TO = 'thalamuxtech@gmail.com';
/** From address for notifications. Use Resend's shared sender until a domain is verified. */
export const ORDER_NOTIFY_FROM = 'Eduvate Kids <onboarding@resend.dev>';
