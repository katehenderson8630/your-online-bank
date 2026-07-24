import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return j({ error: "Supabase function secrets are not configured" }, 500);
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return j({ error: "unauthorized" }, 401);

    const { from_account_id, recipient_email, amount, memo } = await req.json();
    if (!from_account_id || !recipient_email || !(Number(amount) > 0)) return j({ error: "invalid input" }, 400);

    const admin = createClient(url, service);

    // verify ownership
    const { data: from } = await admin.from("accounts").select("user_id, is_frozen").eq("id", from_account_id).single();
    if (!from || from.user_id !== user.id) return j({ error: "forbidden" }, 403);
    if (from.is_frozen) return j({ error: "account frozen" }, 400);

    const { data: rec } = await admin.from("profiles").select("id, full_name, email").eq("email", recipient_email).maybeSingle();
    if (!rec) return j({ error: "recipient not found" }, 404);
    const { data: toAcc } = await admin.from("accounts").select("id, is_frozen").eq("user_id", rec.id).eq("account_type", "checking").maybeSingle();
    if (!toAcc) return j({ error: "recipient has no checking account" }, 404);

    const { data: txOut, error } = await admin.rpc("execute_internal_transfer", {
      _from: from_account_id, _to: toAcc.id, _amount: Number(amount), _memo: memo ?? null,
    });
    if (error) return j({ error: error.message }, 400);

    // emails
    const { data: senderProfile } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
    try {
      if (senderProfile?.email) await admin.functions.invoke("send-transactional-email", { body: { templateName: "transfer-sent", recipientEmail: senderProfile.email, idempotencyKey: `tx-out-${txOut}`, templateData: { name: senderProfile.full_name, amount, to: rec.full_name, memo } } });
      await admin.functions.invoke("send-transactional-email", { body: { templateName: "transfer-received", recipientEmail: rec.email, idempotencyKey: `tx-in-${txOut}`, templateData: { name: rec.full_name, amount, from: senderProfile!.full_name, memo } } });
    } catch (e) { console.error(e); }

    return j({ ok: true, tx_id: txOut });
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
function j(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
