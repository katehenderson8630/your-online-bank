// Verifies the 6-digit login code emailed to the user. Does not create a session.
// On success, the client proceeds with signInWithPassword to start the real session.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, code } = await req.json();
    if (!email || !code) return j({ error: "Email and code required" }, 400);
    const emailLower = String(email).trim().toLowerCase();
    const codeStr = String(code).trim();
    if (!/^\d{6}$/.test(codeStr)) return j({ error: "Code must be 6 digits" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await admin
      .from("login_codes")
      .select("*")
      .eq("email", emailLower)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) return j({ error: "No active code. Please request a new one." }, 400);
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      return j({ error: "Code expired. Please request a new one." }, 400);
    }
    if (row.attempts >= 5) {
      await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      return j({ error: "Too many attempts. Please request a new code." }, 400);
    }
    const hash = await sha256(codeStr);
    if (hash !== row.code_hash) {
      await admin.from("login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return j({ error: "Incorrect code" }, 400);
    }
    await admin.from("login_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return j({ ok: true });
  } catch (e) {
    console.error(e);
    return j({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
