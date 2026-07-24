// Admin-only edge function: approves/rejects requests, posts transactions, issues ATC codes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "musasule863@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service) return json({ error: "Supabase function secrets are not configured" }, 500);
    const auth = req.headers.get("Authorization") ?? "";

    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, service);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
    if (!roles?.length || user.email?.toLowerCase() !== ADMIN_EMAIL) return json({ error: "forbidden" }, 403);

    const { kind, id, action, note } = (await req.json()) as {
      kind: "transfer" | "deposit" | "withdrawal" | "kyc" | "freeze" | "adjustment" | "reverse" | "loan" | "card" | "atc" | "accounts";
      id: string; action: "approve" | "reject" | "freeze" | "unfreeze"; note?: string;
    };

    const log = async (act: string, details: Record<string, unknown>, target_user?: string) => {
      await admin.from("admin_audit_log").insert({ admin_id: user.id, action: act, target_id: id, target_user_id: target_user, details });
    };

    const accountNumber = async () => {
      const { data } = await admin.rpc("gen_account_number");
      if (typeof data === "string" && data.length > 0) return data;
      return "100" + Math.floor(Math.random() * 1e7).toString().padStart(7, "0");
    };

    const ensureAccounts = async (targetUserId: string) => {
      const { data: existing, error: existingError } = await admin
        .from("accounts")
        .select("id, account_type")
        .eq("user_id", targetUserId);
      if (existingError) throw new Error(existingError.message);
      const existingTypes = new Set((existing ?? []).map((account) => account.account_type));
      const rows = [];
      if (!existingTypes.has("checking")) rows.push({ user_id: targetUserId, account_type: "checking", account_number: await accountNumber() });
      if (!existingTypes.has("savings")) rows.push({ user_id: targetUserId, account_type: "savings", account_number: await accountNumber() });
      if (rows.length > 0) {
        const { error: insertError } = await admin.from("accounts").insert(rows);
        if (insertError) throw new Error(insertError.message);
      }
      const { data: accounts, error: loadError } = await admin.from("accounts").select("*").eq("user_id", targetUserId).order("created_at");
      if (loadError) throw new Error(loadError.message);
      return accounts ?? [];
    };

    if (kind === "accounts") {
      const { data: prof } = await admin.from("profiles").select("id").eq("id", id).single();
      if (!prof) return json({ error: "user not found" }, 404);
      const accounts = await ensureAccounts(id);
      await log("ensure_accounts", { account_count: accounts.length }, id);
      return json({ ok: true, accounts });
    }

    if (kind === "transfer") {
      const { data: tr } = await admin.from("transfer_requests").select("*").eq("id", id).single();
      if (!tr) return json({ error: "not found" }, 404);
      if (tr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("transfer_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await emailUser(admin, tr.user_id, "transfer-rejected", { amount: Number(tr.amount), reason: note });
        await log("reject_transfer", { id, note }, tr.user_id);
        return json({ ok: true });
      }

      // Internal transfer between two Lyncrest Digital Bank users
      if (!tr.is_external && tr.to_account_id) {
        const { error: rpcErr } = await admin.rpc("execute_internal_transfer", {
          _from: tr.from_account_id, _to: tr.to_account_id, _amount: Number(tr.amount), _memo: tr.memo ?? null,
        });
        if (rpcErr) return json({ error: rpcErr.message }, 400);

        await admin.from("transfer_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", id);

        // Notify sender + recipient with credit/debit alerts
        const { data: recAcct } = await admin.from("accounts").select("user_id").eq("id", tr.to_account_id).single();
        const { data: senderProf } = await admin.from("profiles").select("full_name, email").eq("id", tr.user_id).single();
        const { data: recProf } = recAcct ? await admin.from("profiles").select("full_name, email").eq("id", recAcct.user_id).single() : { data: null };
        await emailUser(admin, tr.user_id, "transfer-sent", { amount: Number(tr.amount), to: recProf?.full_name ?? "Recipient", memo: tr.memo, description: tr.memo });
        if (recAcct) await emailUser(admin, recAcct.user_id, "transfer-received", { amount: Number(tr.amount), from: senderProf?.full_name ?? "Sender", memo: tr.memo, description: tr.memo });
        await log("approve_internal_transfer", { id }, tr.user_id);
        return json({ ok: true });
      }

      // External transfer — debit sender only
      const { error } = await admin.rpc("post_transaction", {
        _account_id: tr.from_account_id, _type: "transfer_out",
        _amount: Number(tr.amount),
        _description: `Transfer to ${tr.external_recipient_name ?? "recipient"}`,
        _counterparty: tr.external_account_number ? `${tr.external_account_number}/${tr.external_routing_number}` : null,
        _related_tx_id: null, _allow_negative: false,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("transfer_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", id);
      await emailUser(admin, tr.user_id, "transfer-approved", { amount: Number(tr.amount), recipient: tr.external_recipient_name, description: tr.memo });
      await log("approve_transfer", { id }, tr.user_id);
      return json({ ok: true });
    }

    if (kind === "deposit") {
      const { data: dr } = await admin.from("deposit_requests").select("*").eq("id", id).single();
      if (!dr) return json({ error: "not found" }, 404);
      if (dr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("deposit_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await emailUser(admin, dr.user_id, "deposit-rejected", { amount: Number(dr.amount), reason: note });
        await log("reject_deposit", { id, note }, dr.user_id);
        return json({ ok: true });
      }
      const { error } = await admin.rpc("post_transaction", {
        _account_id: dr.account_id, _type: "deposit", _amount: Number(dr.amount),
        _description: "Approved deposit", _counterparty: null, _related_tx_id: null, _allow_negative: false,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("deposit_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", id);
      await emailUser(admin, dr.user_id, "deposit-approved", { amount: Number(dr.amount) });
      await log("approve_deposit", { id }, dr.user_id);
      return json({ ok: true });
    }

    if (kind === "withdrawal") {
      const { data: wr } = await admin.from("withdrawal_requests").select("*").eq("id", id).single();
      if (!wr) return json({ error: "not found" }, 404);
      if (wr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("withdrawal_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await emailUser(admin, wr.user_id, "withdrawal-rejected", { amount: Number(wr.amount), reason: note });
        return json({ ok: true });
      }
      const { error } = await admin.rpc("post_transaction", {
        _account_id: wr.account_id, _type: "withdrawal", _amount: Number(wr.amount),
        _description: "Approved withdrawal", _counterparty: null, _related_tx_id: null, _allow_negative: false,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("withdrawal_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", id);
      await emailUser(admin, wr.user_id, "withdrawal-approved", { amount: Number(wr.amount) });
      await log("approve_withdrawal", { id }, wr.user_id);
      return json({ ok: true });
    }

    if (kind === "kyc") {
      const newStatus = action === "approve" ? "approved" : "rejected";
      await admin.from("profiles").update({ kyc_status: newStatus, kyc_reason: note ?? null }).eq("id", id);
      const { data: prof } = await admin.from("profiles").select("email, full_name").eq("id", id).single();
      if (action === "approve") {
        await ensureAccounts(id);
        await emailUser(admin, id, "kyc-approved", { name: prof?.full_name });
      } else {
        await emailUser(admin, id, "kyc-rejected", { name: prof?.full_name, reason: note });
      }
      await log("kyc_" + action, { note }, id);
      return json({ ok: true });
    }

    if (kind === "freeze") {
      const newStatus = action === "freeze" ? "frozen" : "approved";
      await admin.from("profiles").update({ kyc_status: newStatus, kyc_reason: note ?? null }).eq("id", id);
      await admin.from("accounts").update({ is_frozen: action === "freeze" }).eq("user_id", id);
      await emailUser(admin, id, action === "freeze" ? "account-frozen" : "account-unfrozen", { reason: note });
      await log(action + "_account", { note }, id);
      return json({ ok: true });
    }

    if (kind === "adjustment") {
      const parsed = (() => { try { return JSON.parse(note ?? "{}"); } catch { return {}; } })() as { amount?: number; description?: string; allow_negative?: boolean };
      const amt = Number(parsed.amount ?? 0);
      if (!amt) return json({ error: "amount required" }, 400);
      const { data: acct } = await admin.from("accounts").select("user_id").eq("id", id).single();
      if (!acct) return json({ error: "account not found" }, 404);
      const txType = amt > 0 ? "adjustment" : "withdrawal";
      const { error } = await admin.rpc("post_transaction", {
        _account_id: id, _type: txType, _amount: Math.abs(amt),
        _description: parsed.description ?? "Admin adjustment",
        _counterparty: null, _related_tx_id: null, _allow_negative: parsed.allow_negative ?? true,
      });
      if (error) return json({ error: error.message }, 400);
      await emailUser(admin, acct.user_id, "balance-adjusted", { amount: amt, description: parsed.description });
      await log("balance_adjustment", { account_id: id, amount: amt, description: parsed.description }, acct.user_id);
      return json({ ok: true });
    }

    if (kind === "reverse") {
      const { data: tx } = await admin.from("transactions").select("*").eq("id", id).single();
      if (!tx) return json({ error: "not found" }, 404);
      const reverseType = ["deposit", "transfer_in", "interest"].includes(tx.type) ? "withdrawal" : "deposit";
      const { error } = await admin.rpc("post_transaction", {
        _account_id: tx.account_id, _type: reverseType, _amount: Math.abs(Number(tx.amount)),
        _description: `Reversal of ${tx.reference}`,
        _counterparty: tx.counterparty, _related_tx_id: tx.id, _allow_negative: true,
      });
      if (error) return json({ error: error.message }, 400);
      await emailUser(admin, tx.user_id, "transaction-reversed", { amount: Number(tx.amount), reference: tx.reference });
      await log("reverse_transaction", { tx_id: id }, tx.user_id);
      return json({ ok: true });
    }

    if (kind === "loan") {
      const { data: lr } = await admin.from("loan_requests").select("*").eq("id", id).single();
      if (!lr) return json({ error: "not found" }, 404);
      if (lr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("loan_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await emailUser(admin, lr.user_id, "loan-rejected", { amount: Number(lr.amount), reason: note });
        return json({ ok: true });
      }
      const { data: accts } = await admin.from("accounts").select("id").eq("user_id", lr.user_id).eq("account_type", "checking");
      if (!accts?.length) return json({ error: "User has no checking account" }, 400);
      const { error } = await admin.rpc("post_transaction", {
        _account_id: accts[0].id, _type: "deposit", _amount: Number(lr.amount),
        _description: `Loan approved: ${lr.purpose ?? "Personal loan"}`,
        _counterparty: null, _related_tx_id: null, _allow_negative: false,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("loan_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", id);
      await emailUser(admin, lr.user_id, "loan-approved", { amount: Number(lr.amount) });
      await log("approve_loan", { id }, lr.user_id);
      return json({ ok: true });
    }

    if (kind === "card") {
      const { data: cr } = await admin.from("card_requests").select("*").eq("id", id).single();
      if (!cr) return json({ error: "not found" }, 404);
      if (cr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("card_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await emailUser(admin, cr.user_id, "card-rejected", { reason: note });
        return json({ ok: true });
      }
      const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", cr.user_id).single();
      const rand = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
      const number = "4" + rand(15);
      const cvv = rand(3);
      const now = new Date();
      await admin.from("cards").insert({
        user_id: cr.user_id, account_id: cr.account_id, card_number: number,
        cardholder_name: (prof?.full_name ?? "CARDHOLDER").toUpperCase(),
        expiry_month: now.getMonth() + 1, expiry_year: now.getFullYear() + 4, cvv,
      });
      await admin.from("card_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", id);
      await emailUser(admin, cr.user_id, "card-issued", { last4: number.slice(-4) });
      await log("approve_card", { id }, cr.user_id);
      return json({ ok: true });
    }

    if (kind === "atc") {
      const { data: ar } = await admin.from("atc_requests").select("*").eq("id", id).single();
      if (!ar) return json({ error: "not found" }, 404);
      if (ar.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("atc_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
        await emailUser(admin, ar.user_id, "atc-rejected", { reason: note });
        return json({ ok: true });
      }
      // Generate a unique 10-character code
      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
        const { data: dup } = await admin.from("atc_requests").select("id").eq("code", candidate).maybeSingle();
        if (!dup) { code = candidate; break; }
      }
      if (!code) return json({ error: "could not generate unique code" }, 500);

      // Refund/credit ATC fee back to the user's account
      await admin.rpc("post_transaction", {
        _account_id: ar.account_id, _type: "adjustment", _amount: Number(ar.amount),
        _description: "ATC fee refund", _counterparty: null, _related_tx_id: null, _allow_negative: false,
      });

      await admin.from("atc_requests").update({
        status: "approved", code, reviewed_by: user.id, reviewed_at: new Date().toISOString(), admin_note: note,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      }).eq("id", id);

      await emailUser(admin, ar.user_id, "atc-issued", { code, amount: Number(ar.amount) });
      await log("approve_atc", { id, code }, ar.user_id);
      return json({ ok: true });
    }

    return json({ error: "unknown kind" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function emailUser(admin: ReturnType<typeof createClient>, userId: string, templateName: string, templateData: Record<string, unknown>) {
  const { data: prof } = await admin.from("profiles").select("email, full_name").eq("id", userId).single();
  if (!prof?.email) return;
  try {
    const { data, error } = await admin.functions.invoke("send-transactional-email", {
      body: { templateName, recipientEmail: prof.email, idempotencyKey: `${templateName}-${userId}-${Date.now()}`, templateData: { name: prof.full_name, ...templateData } },
    });
    if (error || (data as { error?: string } | null)?.error) console.error("email failed", { templateName, userId, error: error?.message, data });
  } catch (e) { console.error("email failed", e); }
}
