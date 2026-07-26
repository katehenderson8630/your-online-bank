// Sends transactional banking emails through Resend. Idempotent on idempotencyKey.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "Lyncrest Digital Bank <support@lyncrestdigital.online>";
const SUPPORT_EMAIL = "support@Lyncrestdigital.online";

type Body = {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
};

type Tpl = { subject: string; intro: string; body: string };

function fmtMoney(v: unknown) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(v: unknown) {
  const date = typeof v === "string" || typeof v === "number" ? new Date(v) : new Date();
  const safe = Number.isNaN(date.getTime()) ? new Date() : date;
  return safe.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZoneName: "short" });
}

function safe(v: unknown, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function alertBlock(label: string, amount: unknown, rows: Record<string, string>, dateValue?: unknown) {
  const color = label.toLowerCase() === "credit" ? "#15803d" : "#b91c1c";
  const sign = label.toLowerCase() === "credit" ? "+" : "-";
  const dateStr = fmtDate(dateValue);
  const rowHtml = Object.entries(rows)
    .filter(([, v]) => v && v !== "undefined")
    .map(([k, v]) => `<tr><td style="padding:6px 0;color:#64748b;font-size:13px">${k}</td><td style="padding:6px 0;color:#0f172a;font-size:13px;text-align:right">${v}</td></tr>`)
    .join("");
  return `<div style="margin:18px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
    <div style="background:#f8fafc;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:12px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;color:${color}">${label} alert</span>
      <span style="font-size:18px;font-weight:700;color:${color}">${sign}${fmtMoney(amount)}</span>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:10px 16px 14px">
      ${rowHtml}
      <tr><td style="padding:6px 0;color:#64748b;font-size:13px">Date</td><td style="padding:6px 0;color:#0f172a;font-size:13px;text-align:right">${dateStr}</td></tr>
    </table>
  </div>`;
}

function bankingRows(d: Record<string, unknown>, fallbackDescription: string) {
  const rows: Record<string, string> = {
    Description: safe(d.description ?? d.memo, fallbackDescription),
  };
  if (d.from) rows.From = safe(d.from);
  if (d.to) rows.To = safe(d.to);
  if (d.recipient) rows.Recipient = safe(d.recipient);
  if (d.sender) rows.Sender = safe(d.sender);
  if (d.adminName || d.adminEmail) rows["Posted by"] = safe(d.adminName ?? d.adminEmail);
  if (d.accountType || d.accountLast4) rows.Account = `${safe(d.accountType, "Account")} ${d.accountLast4 ? `••••${safe(d.accountLast4)}` : ""}`.trim();
  if (d.reference) rows.Reference = safe(d.reference);
  if (d.balanceAfter !== undefined && d.balanceAfter !== null) rows["New balance"] = fmtMoney(d.balanceAfter);
  return rows;
}

function build(name: string, d: Record<string, unknown>): Tpl {
  const who = String(d.name ?? "Valued Customer");
  switch (name) {
    case "welcome":
      return {
        subject: "Welcome to Lyncrest Digital Bank",
        intro: `Hello ${who},`,
        body: `Thank you for opening an account with Lyncrest Digital Bank. Our compliance team is now reviewing your KYC documents. You will receive a follow-up email as soon as your account is activated.<br><br>For any question, please contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`,
      };
    case "kyc-submitted":
      return {
        subject: "We received your KYC documents",
        intro: `Hello ${who},`,
        body: `Your identity verification has been received and is currently under review. A KYC activation fee is required to complete this step. Please contact our live support agent at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> for the exact amount and payment details.`,
      };
    case "kyc-approved":
      return {
        subject: "Your account has been activated",
        intro: `Hello ${who},`,
        body: `Good news — your KYC has been approved and your checking and savings accounts are now active. The next step is to request your debit card. Please contact our live support agent at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> for the card issuance fee and payment details.`,
      };
    case "kyc-rejected":
      return {
        subject: "KYC verification update",
        intro: `Hello ${who},`,
        body: `Unfortunately we could not verify your identity. Reason: ${d.reason ?? "Documents could not be verified."}<br><br>Please contact our live support agent at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> to resolve this.`,
      };
    case "card-requested":
      return {
        subject: "Card request received",
        intro: `Hello ${who},`,
        body: `We have received your request for a Lyncrest Digital Bank debit card. Once your issuance fee is confirmed by support, an admin will issue your card and you will receive a confirmation email.`,
      };
    case "card-issued":
      return {
        subject: "Your debit card has been issued",
        intro: `Hello ${who},`,
        body: `Your Lyncrest Digital Bank debit card ending in ${d.last4 ?? "****"} has been issued and is linked to your account. You can now request an Authorization Transfer Code (ATC) for any transfer or payment.`,
      };
    case "card-rejected":
      return {
        subject: "Card request declined",
        intro: `Hello ${who},`,
        body: `Your card request was not approved. Reason: ${d.reason ?? "Please contact support."}<br><br>For assistance, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`,
      };
    case "atc-requested":
      return {
        subject: "ATC request received",
        intro: `Hello ${who},`,
        body: `We have received your Authorization Transfer Code request for ${fmtMoney(d.amount)}. Please contact our live support agent at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> to confirm the ATC fee. Once an admin approves the request, your unique ATC code will be sent to this email and the equivalent amount credited back to your account.`,
      };
    case "atc-issued":
      return {
        subject: "Your Authorization Transfer Code (ATC)",
        intro: `Hello ${who},`,
        body: `Your ATC for ${fmtMoney(d.amount)} has been approved. Use the code below on the Transfer page to authorize your transaction:<br><br><div style="font-size:22px;letter-spacing:6px;font-weight:700;background:#f1f5f9;padding:14px 18px;border-radius:8px;text-align:center">${d.code}</div><br>This code is bound to a single account and a single transfer. Do not share it. If you did not request this code, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> immediately.`,
      };
    case "atc-rejected":
      return {
        subject: "ATC request declined",
        intro: `Hello ${who},`,
        body: `Your ATC request was not approved. Reason: ${d.reason ?? "Please contact support."}`,
      };
    case "transfer-pending":
      return {
        subject: "Transfer submitted for review",
        intro: `Hello ${who},`,
        body: `Your transfer of ${fmtMoney(d.amount)} to ${safe(d.recipient, "the recipient")} has been received and is pending admin review.${alertBlock("Debit", d.amount, bankingRows(d, "Transfer pending review"), d.date)}We will email you once it has been processed. For help, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`,
      };
    case "transfer-approved":
      return {
        subject: `Debit alert: ${fmtMoney(d.amount)}`,
        intro: `Hello ${who},`,
        body: `Your account has been debited.${alertBlock("Debit", d.amount, bankingRows(d, "External transfer"), d.date)}If this transaction was not authorized by you, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> immediately.`,
      };
    case "transfer-rejected":
      return {
        subject: "Transfer declined",
        intro: `Hello ${who},`,
        body: `Your transfer of ${fmtMoney(d.amount)} was declined. Reason: ${d.reason ?? "Please contact support."}`,
      };
    case "transfer-sent":
      return {
        subject: `Debit alert: ${fmtMoney(d.amount)}`,
        intro: `Hello ${who},`,
        body: `Your account has been debited.${alertBlock("Debit", d.amount, bankingRows(d, "Outgoing transfer"), d.date)}If this transaction was not authorized by you, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> immediately.`,
      };
    case "transfer-received":
      return {
        subject: `Credit alert: ${fmtMoney(d.amount)}`,
        intro: `Hello ${who},`,
        body: `Your account has been credited.${alertBlock("Credit", d.amount, bankingRows(d, "Incoming transfer"), d.date)}Sign in to your dashboard to view your updated balance.`,
      };
    case "transaction-reversed":
      return {
        subject: "Transaction reversed",
        intro: `Hello ${who},`,
        body: `A transaction of ${fmtMoney(d.amount)} (ref ${d.reference}) on your account has been reversed by an administrator.`,
      };
    case "balance-adjusted": {
      const amt = Number(d.amount ?? 0);
      const isCredit = amt >= 0;
      return {
        subject: isCredit ? `Credit alert: ${fmtMoney(Math.abs(amt))}` : `Debit alert: ${fmtMoney(Math.abs(amt))}`,
        intro: `Hello ${who},`,
        body: `Your account has been ${isCredit ? "credited" : "debited"}.${alertBlock(isCredit ? "Credit" : "Debit", Math.abs(amt), bankingRows(d, "Admin account adjustment"), d.date)}If you do not recognize this transaction, contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`,
      };
    }
    case "deposit-requested":
      return { subject: "Deposit submitted", intro: `Hello ${who},`, body: `Your deposit request of ${fmtMoney(d.amount)} is awaiting review.${alertBlock("Credit", d.amount, bankingRows(d, "Deposit request"), d.date)}` };
    case "deposit-approved":
      return { subject: `Credit alert: ${fmtMoney(d.amount)}`, intro: `Hello ${who},`, body: `Your deposit has been credited to your account.${alertBlock("Credit", d.amount, bankingRows(d, "Approved deposit"), d.date)}` };
    case "deposit-rejected":
      return { subject: "Deposit declined", intro: `Hello ${who},`, body: `Your deposit request of ${fmtMoney(d.amount)} was declined. Reason: ${safe(d.reason, "Please contact support.")}` };
    case "withdrawal-approved":
      return { subject: `Debit alert: ${fmtMoney(d.amount)}`, intro: `Hello ${who},`, body: `Your withdrawal has been processed.${alertBlock("Debit", d.amount, bankingRows(d, "Approved withdrawal"), d.date)}` };
    case "withdrawal-rejected":
      return { subject: "Withdrawal declined", intro: `Hello ${who},`, body: `Your withdrawal request of ${fmtMoney(d.amount)} was declined. Reason: ${safe(d.reason, "Please contact support.")}` };
    case "loan-approved":
      return { subject: `Credit alert: ${fmtMoney(d.amount)}`, intro: `Hello ${who},`, body: `Your loan has been approved and disbursed.${alertBlock("Credit", d.amount, bankingRows(d, "Loan disbursement"), d.date)}` };
    case "loan-rejected":
      return { subject: "Loan declined", intro: `Hello ${who},`, body: `Your loan request was not approved. ${d.reason ?? ""}` };
    case "bill-scheduled":
      return { subject: "Bill payment scheduled", intro: `Hello ${who},`, body: `Your bill payment has been scheduled.${alertBlock("Debit", d.amount, { Payee: safe(d.payee), Description: "Bill payment", "Scheduled date": safe(d.date) }, d.date)}` };
    case "account-frozen":
      return { subject: "Account frozen", intro: `Hello ${who},`, body: `Your account has been frozen by an administrator. ${d.reason ?? ""} Please contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.` };
    case "account-unfrozen":
      return { subject: "Account reactivated", intro: `Hello ${who},`, body: `Your account has been reactivated. You can now resume normal banking operations.` };
    case "support-reply":
      return { subject: "New support reply", intro: `Hello ${who},`, body: `An agent has replied to your support conversation. Sign in to your dashboard to view the message.` };
    case "support-new-message":
      return { subject: "New support message", intro: `Admin,`, body: `${d.user ?? "A customer"} just sent a new support message. Open the admin support panel to reply.` };
    case "password-reset": {
      const link = String(d.link ?? "#");
      return {
        subject: "Reset your Lyncrest Digital Bank password",
        intro: `Hello ${who},`,
        body: `We received a request to reset the password for your Lyncrest Digital Bank account. Click the secure button below to choose a new password. This link will expire in 1 hour.<br><br><div style="text-align:center;margin:22px 0"><a href="${link}" style="display:inline-block;background:#1a3d6e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 26px;border-radius:8px">Reset password</a></div>If the button doesn't work, copy and paste this link into your browser:<br><span style="word-break:break-all;color:#1a3d6e">${link}</span><br><br>If you did not request this, you can safely ignore this email or contact <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.`,
      };
    }
    default:
      return { subject: "Lyncrest Digital Bank notification", intro: `Hello ${who},`, body: String(d.body ?? "You have a new notification on your Lyncrest Digital Bank account.") };
  }
}

function wrap(t: Tpl) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
      <tr><td style="background:#1a3d6e;color:#ffffff;padding:20px 28px;font-weight:700;font-size:18px">Lyncrest Digital Bank</td></tr>
      <tr><td style="padding:28px 28px 8px;color:#0f172a;font-size:16px;font-weight:600">${t.intro}</td></tr>
      <tr><td style="padding:8px 28px 24px;color:#334155;font-size:14px;line-height:1.55">${t.body}</td></tr>
      <tr><td style="padding:18px 28px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
        Need help? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a3d6e">${SUPPORT_EMAIL}</a>.<br>
        This is an automated message from Lyncrest Digital Bank. Please do not reply to this address.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return j({ error: "RESEND_API_KEY not configured" }, 500);
    const { templateName, recipientEmail, idempotencyKey, templateData } = (await req.json()) as Body;
    if (!templateName || !recipientEmail) return j({ error: "templateName and recipientEmail required" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) return j({ error: "valid recipientEmail required" }, 400);

    const tpl = build(templateName, templateData ?? {});
    const html = wrap(tpl);
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({ from: FROM, to: [recipientEmail], subject: tpl.subject, html }),
    });
    const raw = await r.text();
    let data: Record<string, unknown> = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
    if (!r.ok) {
      console.error("resend error", data);
      return j({ error: typeof data?.message === "string" ? data.message : "Resend send failed", status: r.status, details: data }, r.status);
    }
    return j({ ok: true, id: data?.id });
  } catch (e) {
    console.error(e);
    return j({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
