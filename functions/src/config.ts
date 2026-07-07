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
// USPS Addresses API v3 (OAuth2). Get credentials at developer.usps.gov.
export const USPS_CLIENT_ID = defineSecret('USPS_CLIENT_ID');
export const USPS_CLIENT_SECRET = defineSecret('USPS_CLIENT_SECRET');

// PayPal secrets are intentionally NOT declared yet (Phase D). Declaring a secret
// makes Firebase prompt for it at deploy time even if unused, so we keep these
// commented until PayPal is wired. Restore in Phase D:
//   export const PAYPAL_CLIENT_ID = defineSecret('PAYPAL_CLIENT_ID');
//   export const PAYPAL_CLIENT_SECRET = defineSecret('PAYPAL_CLIENT_SECRET');
//   export const PAYPAL_WEBHOOK_ID = defineSecret('PAYPAL_WEBHOOK_ID');

/** Non-secret config (safe defaults; override via environment if desired). */
export const CURRENCY = defineString('EK_CURRENCY', { default: 'usd' });
/** Flat sales-tax rate as a percentage of subtotal (Maryland = 6). Override via env EK_TAX_RATE. */
export const TAX_RATE_PERCENT = defineString('EK_TAX_RATE', { default: '6' });

/**
 * Weight + zone shipping parameters (see functions/src/shipping.ts and the
 * approved model in implementation_docs/Weight_Based_Shipping_Model.md).
 * All overridable via environment so pricing tunes without a code change.
 */
export const SHIP_BASE_FEE = defineString('EK_SHIP_BASE_FEE', { default: '5.20' });
export const SHIP_ZONE_RATES = defineString('EK_SHIP_ZONE_RATES', { default: '0.35,0.70,1.10,1.55,2.10,2.75,3.15,3.30' });
export const SHIP_PADDING_G = defineString('EK_SHIP_PADDING_G', { default: '150' });
export const SHIP_STEP_KG = defineString('EK_SHIP_STEP_KG', { default: '0.25' });
export const SHIP_MAX_FEE = defineString('EK_SHIP_MAX_FEE', { default: '30' });
export const FREE_SHIPPING_THRESHOLD = defineString('EK_FREE_SHIPPING_OVER', { default: '150' });
export const SHIP_DEFAULT_ITEM_G = defineString('EK_SHIP_DEFAULT_ITEM_G', { default: '300' });

/** Build the ShippingParams object from the env-configurable values above. */
export function shippingParams() {
  const rates = String(SHIP_ZONE_RATES.value() || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    baseFee: Number(SHIP_BASE_FEE.value() || '5.20'),
    zoneRates: rates.length === 8 ? rates : [0.35, 0.70, 1.10, 1.55, 2.10, 2.75, 3.15, 3.30],
    packagePaddingKg: Number(SHIP_PADDING_G.value() || '150') / 1000,
    stepKg: Number(SHIP_STEP_KG.value() || '0.25'),
    maxFee: Number(SHIP_MAX_FEE.value() || '30'),
    freeOverSubtotal: Number(FREE_SHIPPING_THRESHOLD.value() || '150'),
    defaultItemWeightKg: Number(SHIP_DEFAULT_ITEM_G.value() || '300') / 1000,
  };
}

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

/** True once USPS API credentials are present (address validation). */
export function uspsConfigured(): boolean {
  try {
    return Boolean(USPS_CLIENT_ID.value() && USPS_CLIENT_SECRET.value());
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
