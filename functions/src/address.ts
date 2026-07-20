/**
 * USPS Addresses API v3 verification (OAuth2 client-credentials).
 *
 * Standardises and validates a US shipping address against the official USPS
 * database. Called from the checkout address step so the customer can confirm a
 * corrected, deliverable address before paying. This also makes the shipping
 * zone accurate because it returns the canonical state + ZIP.
 *
 * Credentials (USPS_CLIENT_ID / USPS_CLIENT_SECRET) come from developer.usps.gov.
 * If they are not set, callers should treat validation as unavailable and fall
 * back to plain form entry rather than blocking checkout.
 */
import * as logger from 'firebase-functions/logger';
import { USPS_CLIENT_ID, USPS_CLIENT_SECRET } from './config';
import type { ShippingAddress } from './types';

const USPS_BASE = 'https://apis.usps.com';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getUspsToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${USPS_BASE}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: USPS_CLIENT_ID.value(),
      client_secret: USPS_CLIENT_SECRET.value(),
      // The Addresses API requires the "addresses" scope on the token; without
      // it the /address lookup returns HTTP 400.
      scope: 'addresses',
    }),
  });
  if (!res.ok) {
    throw new Error(`USPS auth failed (${res.status})`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (json.expires_in ?? 3600) * 1000;
  cachedToken = { token: json.access_token, expiresAt: now + ttl };
  return json.access_token;
}

export interface AddressValidationResult {
  valid: boolean;
  corrected: ShippingAddress | null;
  changed: boolean;
  message?: string;
}

/**
 * Validate + standardise a US address. Returns the canonical address when USPS
 * recognises it. Non-US addresses are passed through as-is (USPS is US-only).
 */
export async function validateUsAddress(addr: ShippingAddress): Promise<AddressValidationResult> {
  // USPS only covers the US. Anything else is accepted without verification.
  const country = String(addr.country || '').trim().toLowerCase();
  const isUS = ['us', 'usa', 'united states', 'united states of america'].includes(country);
  if (!isUS) {
    return { valid: true, corrected: null, changed: false, message: 'Non-US address; not verified.' };
  }

  const token = await getUspsToken();
  const params = new URLSearchParams({
    streetAddress: String(addr.line1 || '').trim(),
    city: String(addr.city || '').trim(),
    state: String(addr.state || '').trim().toUpperCase().slice(0, 2),
    ZIPCode: String(addr.postalCode || '').trim().slice(0, 5),
  });
  if (addr.line2) params.set('secondaryAddress', String(addr.line2).trim());

  const res = await fetch(`${USPS_BASE}/addresses/v3/address?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  // 404 = no match; 400 = the address as entered could not be resolved. Both
  // mean "we could not verify this address", return a soft failure so the
  // customer is asked to check it, rather than throwing (which would silently
  // let a bad address through in the client's catch).
  if (res.status === 404 || res.status === 400) {
    logger.info('USPS address unverified', { status: res.status });
    return { valid: false, corrected: null, changed: false, message: 'We could not verify that address. Please check the street, city, state, and ZIP.' };
  }
  if (!res.ok) {
    throw new Error(`USPS address lookup failed (${res.status})`);
  }

  const json = (await res.json()) as {
    address?: { streetAddress?: string; secondaryAddress?: string; city?: string; state?: string; ZIPCode?: string; ZIPPlus4?: string };
    additionalInfo?: { DPVConfirmation?: string };
    corrections?: Array<{ code?: string; text?: string }>;
    warnings?: string[];
  };
  const a = json.address;
  const dpv = json.additionalInfo?.DPVConfirmation;
  // Log the decision inputs so we can see exactly what USPS said (no PII beyond
  // city/state/zip which the customer already provided).
  logger.info('USPS address result', {
    dpv,
    city: a?.city,
    state: a?.state,
    zip: a?.ZIPCode,
    corrections: json.corrections?.map((c) => c.code),
    warnings: json.warnings,
  });

  if (!a || !a.state || !a.ZIPCode) {
    return { valid: false, corrected: null, changed: false, message: 'Address could not be standardised.' };
  }

  // DPVConfirmation is the definitive deliverability signal:
  //   Y = fully confirmed, D = primary confirmed (secondary missing),
  //   S = primary confirmed (secondary present but not in USPS's table), N = not confirmed.
  // Only N means the address is genuinely undeliverable, so we reject that.
  // Y, D and S are all real, deliverable buildings, accept them (many valid
  // apartments simply aren't in USPS's secondary database, which returns S).
  if (dpv === 'N') {
    return { valid: false, corrected: null, changed: false, message: 'We could not verify that address. Please check the street number, city, state, and ZIP.' };
  }
  // Y, D, and S are accepted as valid below.

  const corrected: ShippingAddress = {
    line1: a.streetAddress || addr.line1,
    line2: a.secondaryAddress || addr.line2 || '',
    city: a.city || addr.city,
    state: a.state,
    postalCode: a.ZIPPlus4 ? `${a.ZIPCode}-${a.ZIPPlus4}` : a.ZIPCode,
    country: 'United States',
  };

  const changed =
    corrected.line1.toUpperCase() !== String(addr.line1 || '').toUpperCase() ||
    corrected.city.toUpperCase() !== String(addr.city || '').toUpperCase() ||
    corrected.state.toUpperCase() !== String(addr.state || '').toUpperCase() ||
    corrected.postalCode.slice(0, 5) !== String(addr.postalCode || '').slice(0, 5);

  return { valid: true, corrected, changed };
}
