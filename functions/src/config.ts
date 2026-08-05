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

// Fine-grained GitHub PAT with only "Contents: read and write" on the site
// repo, used to POST a repository_dispatch that rebuilds the static product
// pages. Kept server-side: the site repo is public, so a browser-held token
// would be extractable from the JS bundle.
export const GITHUB_DISPATCH_TOKEN = defineSecret('GITHUB_DISPATCH_TOKEN');

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
export const SHIP_BASE_FEE = defineString('EK_SHIP_BASE_FEE', { default: '7.35' });
export const SHIP_ZONE_RATES = defineString('EK_SHIP_ZONE_RATES', { default: '0.38,0.76,1.19,1.67,2.27,2.97,3.40,3.56' });
export const SHIP_PADDING_G = defineString('EK_SHIP_PADDING_G', { default: '150' });
export const SHIP_STEP_KG = defineString('EK_SHIP_STEP_KG', { default: '0.25' });
export const SHIP_MAX_FEE = defineString('EK_SHIP_MAX_FEE', { default: '32' });
export const FREE_SHIPPING_THRESHOLD = defineString('EK_FREE_SHIPPING_OVER', { default: '150' });
export const SHIP_DEFAULT_ITEM_G = defineString('EK_SHIP_DEFAULT_ITEM_G', { default: '300' });

/** Build the ShippingParams object from the env-configurable values above. */
export function shippingParams() {
  const rates = String(SHIP_ZONE_RATES.value() || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return {
    baseFee: Number(SHIP_BASE_FEE.value() || '7.35'),
    zoneRates: rates.length === 8 ? rates : [0.38, 0.76, 1.19, 1.67, 2.27, 2.97, 3.40, 3.56],
    packagePaddingKg: Number(SHIP_PADDING_G.value() || '150') / 1000,
    stepKg: Number(SHIP_STEP_KG.value() || '0.25'),
    maxFee: Number(SHIP_MAX_FEE.value() || '32'),
    freeOverSubtotal: Number(FREE_SHIPPING_THRESHOLD.value() || '150'),
    defaultItemWeightKg: Number(SHIP_DEFAULT_ITEM_G.value() || '300') / 1000,
  };
}

/**
 * Allowed browser origins for CORS on callable/onRequest endpoints.
 * Includes the Firebase hosting domains, the custom domain, and localhost for
 * dev. Regex entries cover the custom apex + any subdomain and local ports so a
 * legitimate front end is never blocked (which would surface as an "internal"
 * error in the browser).
 */
export const ALLOWED_ORIGINS: (string | RegExp)[] = [
  'https://eduvatekids-store.web.app',
  'https://eduvatekids-store.firebaseapp.com',
  'https://eduvatekids.com',
  'https://www.eduvatekids.com',
  /^https:\/\/([a-z0-9-]+\.)*eduvatekids\.com$/,
  /^https:\/\/eduvatekids-store(--[a-z0-9-]+)?\.web\.app$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
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
 * to an address on that domain, then this can be any recipient.
 */
export const ORDER_NOTIFY_TO = 'salam@eduvatekids.com';
/** From address for all app emails. Uses the verified eduvatekids.com domain in
 *  Resend, so mail sends from the brand and reaches any recipient. */
export const ORDER_NOTIFY_FROM = 'Eduvate Kids <salam@eduvatekids.com>';
