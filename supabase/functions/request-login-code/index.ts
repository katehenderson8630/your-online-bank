// Verifies email+password, generates a 6-digit code, emails it, stores hash for verification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM = "Green Wells Fargo <noreply@greenwellsfargo.site>";
const SUPPORT_EMAIL = "support@greenwellsfargo.site";

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function emailHtml(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
<tr><td style="background:#1a3d6e;color:#ffffff;padding:20px 28px;font-weight:700;font-size:18px">Green Wells Fargo</td></tr>
<tr><td style="padding:28px 28px 8px;color:#0f172a;font-size:16px;font-weight:600">Your sign-in code</td></tr>
<tr><td style="padding:8px 28px 24px;color:#334155;font-size:14px;line-height:1.55">
Use the code below to finish signing in. It expires in 10 minutes.
<div style="font-size:28px;letter-spacing:10px;font-weight:700;background:#f1f5f9;padding:18px;border-radius:8px;text-align:center;margin:18px 0;color:#0f172a">${code}</div>
If you did not try to sign in, change your password immediately and contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#1a3d6e">${SUPPORT_EMAIL}</a>.
</td></tr>
<tr><td style="padding:18px 28px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
This is an automated message from Green Wells Fargo. Please do not reply.
</td></tr></table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, password } = await req.json();
    if (!email || !password) return j({ error: "Email and password required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify password using anon client (won't keep session)
    const anonClient = createClient(supabaseUrl, anon, { auth: { persistSession: false } });
    const { data: signIn, error: signErr } = await anonClient.auth.signInWithPassword({ email, password });
    if (signErr || !signIn.user) return j({ error: "Invalid email or password" }, 401);
    await anonClient.auth.signOut();

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256(code);
    const admin = createClient(supabaseUrl, service);

    const emailLower = email.trim().toLowerCase();
    // Invalidate previous unused codes for this email
    await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("email", emailLower).is("used_at", null);
    await admin.from("login_codes").insert({
      email: emailLower,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    // Send email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return j({ error: "Email service not configured" }, 500);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject: `Your sign-in code: ${code}`, html: emailHtml(code) }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      console.error("resend error", d);
      return j({ error: "Could not send code email" }, 502);
    }
    return j({ ok: true });
  } catch (e) {
    console.error(e);
    return j({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
