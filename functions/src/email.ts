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

/**
 * Notify the admin that a shopper reserved (pre-ordered) an out-of-stock book.
 * No-op (logged) if RESEND_API_KEY is not configured — never blocks the request.
 */
export async function sendBookRequestNotification(params: {
  requestId: string;
  bookTitle: string;
  quantity: number;
  name: string;
  email: string;
  phone?: string;
}): Promise<void> {
  if (!emailConfigured()) {
    logger.info('Book-request email skipped — RESEND_API_KEY not set', { requestId: params.requestId });
    return;
  }
  const resend = new Resend(RESEND_API_KEY.value());
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">
      <h1 style="margin:0;font-size:20px">📚 New Book Reservation</h1>
      <p style="margin:6px 0 0;opacity:.9;font-size:13px">Out-of-stock pre-order request</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:24px;font-size:14px">
      <p style="margin:0 0 4px"><strong>Book:</strong> ${esc(params.bookTitle)}</p>
      <p style="margin:0 0 4px"><strong>Copies requested:</strong> ${params.quantity}</p>
      <h3 style="margin:20px 0 6px;font-size:14px">Requested by</h3>
      <p style="margin:0">${esc(params.name)}<br>${esc(params.email)}${params.phone ? '<br>' + esc(params.phone) : ''}</p>
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af">Request ref: ${esc(params.requestId)}</p>
    </div>
  </div>`;
  try {
    await resend.emails.send({
      from: ORDER_NOTIFY_FROM,
      to: ORDER_NOTIFY_TO,
      replyTo: params.email,
      subject: `Book reservation — ${params.quantity}× ${params.bookTitle}`,
      html,
    });
    logger.info('Book-request notification email sent', { requestId: params.requestId });
  } catch (err) {
    logger.error('Failed to send book-request notification email', err);
  }
}

/**
 * Warm welcome email to a parent after they register a child for Summer Reads.
 * Sent to the PARENT (not the admin). No-op if Resend isn't configured; never
 * throws, so it can't fail the registration.
 */
export async function sendReaderWelcome(params: {
  parentName: string;
  parentEmail: string;
  childName: string;
  code: string;
  levelName: string;
  goal: number;
}): Promise<void> {
  if (!emailConfigured()) {
    logger.info('Reader welcome email skipped — RESEND_API_KEY not set', { code: params.code });
    return;
  }
  const resend = new Resend(RESEND_API_KEY.value());
  const logUrl = 'https://eduvatekids.com/summer-reads/log';
  const child = esc(params.childName);
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#1a7a3c,#7c3aed);color:#fff;padding:26px 24px;border-radius:14px 14px 0 0;text-align:center">
      <img src="https://eduvatekids.com/email-logo.png" alt="Eduvate Kids" width="60" height="86" style="display:block;margin:0 auto 12px;width:60px;height:86px;background:#fff;border-radius:14px;padding:8px 12px;object-fit:contain" />
      <h1 style="margin:0;font-size:22px">Welcome to Eduvate Kids Summer Reads!</h1>
      <p style="margin:8px 0 0;opacity:.92;font-size:14px">Rooted in Faith. Growing in Knowledge.</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:26px;font-size:15px;line-height:1.6">
      <p style="margin:0 0 14px"><strong>Assalamu alaikum ${esc(params.parentName)},</strong></p>
      <p style="margin:0 0 14px">JazakAllahu khayran for registering <strong>${child}</strong> for Summer Reads! We're so excited to have your family join us this summer, insha'Allah. 🎉</p>
      <p style="margin:0 0 18px">You've taken a beautiful step — nurturing a love of reading that's <em>rooted in faith and growing in knowledge.</em></p>

      <div style="text-align:center;margin:22px 0">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#6b7280">${child}'s reading code</p>
        <div style="display:inline-block;border:2px dashed #7c3aed;border-radius:14px;padding:12px 26px;font-size:26px;font-weight:bold;letter-spacing:3px;color:#4c1d95">${esc(params.code)}</div>
        <p style="margin:8px 0 0;font-size:13px;color:#6b7280">Keep this handy — you'll need it every time you want to log a book.</p>
      </div>

      <p style="margin:20px 0 8px;font-weight:bold">Here's how it works:</p>
      <ul style="margin:0 0 18px;padding-left:20px">
        <li style="margin-bottom:6px">📚 <strong>Choose great books</strong> — Islamic stories, prophets &amp; companions, Arabic readers, and more.</li>
        <li style="margin-bottom:6px">✍️ <strong>Log each book:</strong> when ${child} finishes a book, go to <a href="${logUrl}" style="color:#7c3aed;font-weight:bold">Log a Book</a> using the code above (parent-verified).</li>
        <li style="margin-bottom:6px">🏅 <strong>${child}'s goal:</strong> read <strong>${params.goal} books</strong> to complete the <strong>${esc(params.levelName)}</strong> level and earn a certificate.</li>
        <li style="margin-bottom:6px">🎁 Reach the goal and you're entered into the <strong>raffle to win a $30 store credit!</strong></li>
      </ul>

      <p style="margin:0 0 18px">Every book is a seed. We can't wait to see how much ${child} grows this summer, biidhnillah. 🌸</p>

      <div style="text-align:center;margin:22px 0">
        <a href="${logUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;text-decoration:none;font-weight:bold;padding:13px 28px;border-radius:999px">Log ${child}'s first book →</a>
      </div>

      <p style="margin:18px 0 0">Happy reading!<br><strong>The Eduvate Kids Team</strong></p>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:14px">Registered by mistake or need help? Just reply to this email.</p>
    </div>
  </div>`;
  try {
    await resend.emails.send({
      from: ORDER_NOTIFY_FROM,
      to: params.parentEmail,
      replyTo: ORDER_NOTIFY_TO,
      subject: `🌱 Welcome to Summer Reads — ${params.childName}'s reading code is ${params.code}`,
      html,
    });
    logger.info('Reader welcome email sent', { code: params.code });
  } catch (err) {
    logger.error('Failed to send reader welcome email', err);
  }
}

/**
 * Build the customer-facing purchase-confirmation email HTML. Pure function
 * (no side effects) so the exact same markup can be rendered for a preview and
 * for the actual send. Kept intentionally simple and inline-styled for email
 * client compatibility.
 */
export function buildCustomerPurchaseEmailHtml(params: {
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
}): string {
  const cur = params.currency.toUpperCase();
  const a = params.shippingAddress;
  const firstName = String(params.customer.name || '').trim().split(/\s+/)[0] || 'there';
  const rows = params.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 10px;border-bottom:1px solid #eee">${esc(i.title)}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>` +
        `<td style="padding:8px 10px;border-bottom:1px solid #eee;text-align:right">$${i.lineTotal.toFixed(2)}</td></tr>`
    )
    .join('');
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
    <div style="background:linear-gradient(135deg,#1a7a3c,#7c3aed);color:#fff;padding:26px 24px;border-radius:14px 14px 0 0;text-align:center">
      <img src="https://eduvatekids.com/email-logo.png" alt="Eduvate Kids" width="60" height="86" style="display:block;margin:0 auto 12px;width:60px;height:86px;background:#fff;border-radius:14px;padding:8px 12px;object-fit:contain" />
      <h1 style="margin:0;font-size:22px">Thank you for your order!</h1>
      <p style="margin:8px 0 0;opacity:.92;font-size:14px">Order ${esc(params.orderId)}</p>
    </div>
    <div style="border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px;padding:26px;font-size:14px;line-height:1.6">
      <p style="margin:0 0 14px"><strong>Assalamu alaikum ${esc(firstName)},</strong></p>
      <p style="margin:0 0 18px">JazakAllahu khayran for shopping with Eduvate Kids! We've received your order and are getting it ready. Here's your summary:</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">
          <th style="padding:6px 10px">Item</th><th style="padding:6px 10px;text-align:center">Qty</th><th style="padding:6px 10px;text-align:right">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <tr><td style="padding:3px 10px;color:#6b7280">Subtotal</td><td style="padding:3px 10px;color:#6b7280;text-align:right">$${params.subtotal.toFixed(2)}</td></tr>
        <tr><td style="padding:3px 10px;color:#6b7280">Shipping</td><td style="padding:3px 10px;color:#6b7280;text-align:right">$${params.shippingFee.toFixed(2)}</td></tr>
        <tr><td style="padding:3px 10px;color:#6b7280">Tax</td><td style="padding:3px 10px;color:#6b7280;text-align:right">$${params.tax.toFixed(2)}</td></tr>
        <tr><td style="padding:8px 10px 3px;font-weight:bold">Total paid</td><td style="padding:8px 10px 3px;font-weight:bold;text-align:right">$${params.total.toFixed(2)} ${cur}</td></tr>
      </table>
      <h3 style="margin:22px 0 6px;font-size:14px">Shipping to</h3>
      <p style="margin:0;font-size:14px">
        ${esc(params.customer.name)}<br>
        ${esc(a.line1)}${a.line2 ? '<br>' + esc(a.line2) : ''}<br>
        ${esc(a.city)}, ${esc(a.state)} ${esc(a.postalCode)}<br>${esc(a.country)}
      </p>
      <p style="margin:22px 0 0">We'll be in touch when your order ships, insha'Allah. If you have any questions, just reply to this email.</p>
      <p style="margin:18px 0 0">With gratitude,<br><strong>The Eduvate Kids Team</strong></p>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;border-top:1px solid #eee;padding-top:14px">Rooted in Faith. Growing in Knowledge.</p>
    </div>
  </div>`;
}

/**
 * Send the customer their purchase confirmation. Triggered manually by the admin
 * (not automatically on payment). No-op if Resend isn't configured; throws on a
 * real send failure so the caller can surface an error to the admin.
 */
export async function sendCustomerPurchaseEmail(params: {
  orderId: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  tax: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  shippingAddress: ShippingAddress;
}): Promise<void> {
  if (!emailConfigured()) {
    throw new Error('Email is not configured (RESEND_API_KEY missing).');
  }
  const resend = new Resend(RESEND_API_KEY.value());
  const cur = params.currency.toUpperCase();
  await resend.emails.send({
    from: ORDER_NOTIFY_FROM,
    to: params.customer.email,
    replyTo: ORDER_NOTIFY_TO,
    subject: `Your Eduvate Kids order — $${params.total.toFixed(2)} ${cur}`,
    html: buildCustomerPurchaseEmailHtml(params),
  });
  logger.info('Customer purchase email sent', { orderId: params.orderId, to: params.customer.email });
}
