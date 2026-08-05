/**
 * Weight + distance (zone) based shipping calculator.
 *
 * Cost for shipping books is driven by two things: total package weight and how
 * far it travels from our origin (MD 21075). This module encodes both:
 *   fee = baseFee + zoneRate[zone] * billableKg
 * where billableKg = ceil((contentKg + packagePadding) / step) * step.
 *
 * Originally calibrated against four 2026 shipments, but it undercharged every
 * one of them (mean -$0.27) and carrier prices have risen since: actual
 * postage was running about $2.40 above what checkout collected.
 *
 * Retuned 2026-08 by lifting the base fee and nudging the zone rates 8%. The
 * base does most of the work because the shortfall is roughly flat per parcel;
 * a large per-kg increase instead would have overcharged the rare heavy,
 * distant order by $5 or more. Against the four shipments uplifted by $2.40 the
 * mean absolute error is $0.31, and every realistic basket rises $2.16 to $3.77.
 *
 * The numbers below are defaults only. Production reads them from
 * functions/.env.eduvatekids-store, so rates can be retuned with a functions
 * deploy and no code change. Keep the two in step: config.ts holds the same
 * values so a missing env file does not silently revert pricing.
 *
 * There is no client-side copy on purpose. Shipping is priced server-side in
 * priceCart so the browser cannot influence what is charged.
 */

/** USPS-style distance zones from MD 21075, by USPS state abbreviation. */
export const STATE_ZONE: Record<string, number> = {
  MD: 1,
  DC: 2, DE: 2, VA: 2, PA: 2, WV: 2, NJ: 2,
  NY: 3, CT: 3, RI: 3, MA: 3, OH: 3, NC: 3, SC: 3, KY: 3, IN: 3,
  NH: 4, VT: 4, ME: 4, MI: 4, TN: 4, GA: 4, AL: 4, IL: 4, WI: 4,
  FL: 5, MS: 5, LA: 5, AR: 5, MO: 5, IA: 5, MN: 5, KS: 5, NE: 5, OK: 5,
  TX: 6, SD: 6, ND: 6, CO: 6, NM: 6, WY: 6, MT: 6,
  UT: 7, ID: 7, AZ: 7, NV: 7,
  CA: 8, OR: 8, WA: 8, AK: 8, HI: 8,
};

/** Default per-zone rate ($/kg). Overridable via EK_ZONE_RATES (comma list z1..z8). */
export const DEFAULT_ZONE_RATES = [0.38, 0.76, 1.19, 1.67, 2.27, 2.97, 3.40, 3.56];

export interface ShippingParams {
  baseFee: number;          // fixed carrier minimum + label + drop-off
  zoneRates: number[];      // $/kg for zones 1..8 (index 0 == zone 1)
  packagePaddingKg: number; // added to content weight for mailer/box/dunnage
  stepKg: number;           // round billable weight up to this step
  maxFee: number;           // ceiling so a heavy far order never shocks the buyer
  freeOverSubtotal: number; // subtotal at/above which shipping is free
  defaultItemWeightKg: number; // fallback when an item has no weight
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Map a US state (2-letter code, case-insensitive) to a distance zone.
 * Unknown/foreign states fall back to the farthest zone so we never undercharge.
 */
export function zoneForState(state: string, zoneCount = 8): number {
  const z = STATE_ZONE[String(state || '').trim().toUpperCase()];
  return z && z >= 1 && z <= zoneCount ? z : zoneCount;
}

/**
 * Compute the shipping fee for a total content weight (grams) to a state.
 * Returns the fee plus the intermediate values so they can be shown/audited.
 */
export function computeShipping(args: {
  contentGrams: number;
  subtotal: number;
  state: string;
  params: ShippingParams;
}): { fee: number; zone: number; billableKg: number; totalWeightKg: number } {
  const p = args.params;
  const contentKg = Math.max(0, args.contentGrams) / 1000;
  const zone = zoneForState(args.state, p.zoneRates.length);

  // Free over the subtotal threshold, regardless of weight/zone.
  const totalWeightKg = round2(contentKg);
  if (args.subtotal >= p.freeOverSubtotal) {
    const billableFree = ceilTo(contentKg + p.packagePaddingKg, p.stepKg);
    return { fee: 0, zone, billableKg: billableFree, totalWeightKg };
  }

  const paddedKg = contentKg + p.packagePaddingKg;
  const billableKg = ceilTo(paddedKg, p.stepKg);
  const rate = p.zoneRates[zone - 1] ?? p.zoneRates[p.zoneRates.length - 1];
  const raw = p.baseFee + rate * billableKg;
  const fee = Math.min(round2(raw), p.maxFee); // no minimum floor (base is the floor)
  return { fee, zone, billableKg, totalWeightKg };
}

function ceilTo(value: number, step: number): number {
  if (!(step > 0)) return round2(value);
  return round2(Math.ceil(value / step) * step);
}
