/**
 * Order-notification email via Resend.
 * Sends a full order summary to ORDER_NOTIFY_TO when a new order is created.
 * No-op (logged) if RESEND_API_KEY is not configured, so it never blocks checkout.
 */
import { Resend } from 'resend';
import * as logger from 'firebase-functions/logger';
import { RESEND_API_KEY, ORDER_NOTIFY_TO, ORDER_NOTIFY_FROM, emailConfigured } from './config';
import type { CustomerInfo, ShippingAddress, OrderItem } from './types';

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendOrderNotification(params: {
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  shipWeightGrams?: number;
  shipZone?: number;
  tax: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
  paymentRef: string;
  live: boolean;
}): Promise<void> {
  if (!emailConfigured()) {
    logger.info('Order email skipped — RESEND_API_KEY not set', { orderId: params.orderId });
    return;
  }

  const resend = new Resend(RESEND_API_KEY.value());
  const cur = params.currency.toUpperCase();
  const a = params.shippingAddress;
  const rows = params.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(i.title)}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">$${i.lineTotal.toFixed(2)}</td></tr>`
    )
    .join('');

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <h1 style="margin:0;font-size:20px">🛒 New Order Received${params.live ? '' : ' (TEST)'}</h1>
      <p style="margin:6px 0 0;opacity:.9;font-size:13px">Order ${esc(params.orderId)}</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:24px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">
          <th style="padding:6px 10px">Item</th><th style="padding:6px 10px;text-align:center">Qty</th><th style="padding:6px 10px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">
        <tr><td style="padding:3px 10px;color:#6b7280">Subtotal</td><td style="padding:3px 10px;color:#6b7280;text-align:right">$${params.subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:3px 10px;color:#6b7280">Shipping</td><td style="padding:3px 10px;color:#6b7280;text-align:right">$${params.shippingFee.toFixed(2)}</td></tr>
        <tr><td style="padding:3px 10px;color:#6b7280">Tax</td><td style="padding:3px 10px;color:#6b7280;text-align:right">$${params.tax.toFixed(2)}</td></tr>
        <tr><td style="padding:6px 10px 3px;font-weight:bold">Total</td><td style="padding:6px 10px 3px;font-weight:bold;text-align:right">$${params.total.toFixed(2)} ${cur}</td></tr>
      </table>
      <h3 style="margin:20px 0 6px;font-size:14px">Customer</h3>
      <p style="margin:0;font-size:14px">${esc(params.customer.name)}<br>${esc(params.customer.email)}${params.customer.phone ? '<br>' + esc(params.customer.phone) : ''}</p>
      <h3 style="margin:20px 0 6px;font-size:14px">Ship To</h3>
      <p style="margin:0;font-size:14px">
        ${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} ${esc(a.postalCode)}<br>${esc(a.country)}
      </p>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Payment ref: ${esc(params.paymentRef)}</p>
    </div>
  </div>`;

  try {
    await resend.emails.send({
      from: ORDER_NOTIFY_FROM,
      to: ORDER_NOTIFY_TO,
      replyTo: params.customer.email,
      subject: `New order — $${params.total.toFixed(2)} ${cur}${params.live ? '' : ' (TEST)'}`,
      html,
    });
    logger.info('Order notification email sent', { orderId: params.orderId });
  } catch (err) {
    // Never fail the webhook because of email — just log.
    logger.error('Failed to send order notification email', err);
  }
}
