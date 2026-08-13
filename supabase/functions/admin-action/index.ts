// Admin-only edge function: approves/rejects requests, posts transactions, issues ATC codes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createClient>;
type ActionKind = "transfer" | "deposit" | "withdrawal" | "kyc" | "freeze" | "adjustment" | "reverse" | "loan" | "card" | "atc" | "accounts";
type ActionName = "approve" | "reject" | "freeze" | "unfreeze";
type EmailResult = { ok: true; id?: unknown } | { ok: false; error: string; details?: unknown } | { ok: false; error: "missing recipient" };

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
    if (!roles?.length) return json({ error: "forbidden" }, 403);

    const { kind, id, action, note } = (await req.json()) as { kind: ActionKind; id: string; action: ActionName; note?: string };
    if (!kind || !id || !action) return json({ error: "kind, id and action are required" }, 400);

    const adminName = user.user_metadata?.full_name ?? user.email ?? "Admin";
    const adminEmail = user.email ?? "admin";
    const now = () => new Date().toISOString();
    const log = async (act: string, details: Record<string, unknown>, targetUser?: string) => {
      await admin.from("admin_audit_log").insert({ admin_id: user.id, action: act, target_id: id, target_user_id: targetUser, details });
    };
    const withAdmin = (data: Record<string, unknown>) => ({ ...data, adminName, adminEmail, date: now() });

    if (kind === "accounts") {
      const { data: prof } = await admin.from("profiles").select("id").eq("id", id).single();
      if (!prof) return json({ error: "user not found" }, 404);
      const accounts = await ensureAccounts(admin, id);
      await log("ensure_accounts", { account_count: accounts.length }, id);
      return json({ ok: true, accounts });
    }

    if (kind === "transfer") {
      const { data: tr } = await admin.from("transfer_requests").select("*").eq("id", id).single();
      if (!tr) return json({ error: "not found" }, 404);
      if (tr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("transfer_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: now() }).eq("id", id);
        const email = await emailUser(admin, tr.user_id, "transfer-rejected", withAdmin({ amount: Number(tr.amount), reason: note, reference: id }));
        await log("reject_transfer", { id, note, email }, tr.user_id);
        return json({ ok: true, email });
      }

      if (!tr.is_external && tr.to_account_id) {
        const { data: txOut, error: rpcErr } = await admin.rpc("execute_internal_transfer", {
          _from: tr.from_account_id, _to: tr.to_account_id, _amount: Number(tr.amount), _memo: tr.memo ?? null,
        });
        if (rpcErr) return json({ error: rpcErr.message }, 400);
        await admin.from("transfer_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now(), admin_note: note }).eq("id", id);

        const { data: recAcct } = await admin.from("accounts").select("user_id").eq("id", tr.to_account_id).single();
        const { data: senderProf } = await admin.from("profiles").select("full_name").eq("id", tr.user_id).single();
        const { data: recProf } = recAcct ? await admin.from("profiles").select("full_name").eq("id", recAcct.user_id).single() : { data: null };
        const senderTx = await txDetails(admin, typeof txOut === "string" ? txOut : undefined);
        const senderAccount = await accountDetails(admin, tr.from_account_id);
        const recipientAccount = await accountDetails(admin, tr.to_account_id);
        const senderEmail = await emailUser(admin, tr.user_id, "transfer-sent", withAdmin({
          amount: Number(tr.amount), to: recProf?.full_name ?? "Recipient", memo: tr.memo, description: tr.memo,
          reference: senderTx?.reference ?? id, balanceAfter: senderTx?.balance_after, ...senderAccount,
        }));
        const recipientEmail = recAcct ? await emailUser(admin, recAcct.user_id, "transfer-received", withAdmin({
          amount: Number(tr.amount), from: senderProf?.full_name ?? "Sender", memo: tr.memo, description: tr.memo,
          reference: senderTx?.reference ?? id, ...recipientAccount,
        })) : { ok: false, error: "missing recipient" };
        await log("approve_internal_transfer", { id, txOut, senderEmail, recipientEmail }, tr.user_id);
        return json({ ok: true, email: senderEmail, recipientEmail });
      }

      const { data: txId, error } = await admin.rpc("post_transaction", {
        _account_id: tr.from_account_id, _type: "transfer_out", _amount: Number(tr.amount),
        _description: `Transfer to ${tr.external_recipient_name ?? "recipient"}`,
        _counterparty: tr.external_account_number ? `${tr.external_account_number}/${tr.external_routing_number}` : null,
        _related_tx_id: null, _allow_negative: false,
      });
      if (error) return json({ error: error.message }, 400);
      await admin.from("transfer_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now(), admin_note: note }).eq("id", id);
      const tx = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const account = await accountDetails(admin, tr.from_account_id);
      const email = await emailUser(admin, tr.user_id, "transfer-approved", withAdmin({ amount: Number(tr.amount), recipient: tr.external_recipient_name, description: tr.memo, reference: tx?.reference ?? id, balanceAfter: tx?.balance_after, ...account }));
      await log("approve_transfer", { id, txId, email }, tr.user_id);
      return json({ ok: true, email });
    }

    if (kind === "deposit") {
      const { data: dr } = await admin.from("deposit_requests").select("*").eq("id", id).single();
      if (!dr) return json({ error: "not found" }, 404);
      if (dr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("deposit_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: now() }).eq("id", id);
        const email = await emailUser(admin, dr.user_id, "deposit-rejected", withAdmin({ amount: Number(dr.amount), reason: note, reference: id }));
        await log("reject_deposit", { id, note, email }, dr.user_id);
        return json({ ok: true, email });
      }
      const { data: txId, error } = await admin.rpc("post_transaction", { _account_id: dr.account_id, _type: "deposit", _amount: Number(dr.amount), _description: "Approved deposit", _counterparty: null, _related_tx_id: null, _allow_negative: false });
      if (error) return json({ error: error.message }, 400);
      await admin.from("deposit_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now(), admin_note: note }).eq("id", id);
      const tx = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const account = await accountDetails(admin, dr.account_id);
      const email = await emailUser(admin, dr.user_id, "deposit-approved", withAdmin({ amount: Number(dr.amount), description: "Approved deposit", reference: tx?.reference ?? id, balanceAfter: tx?.balance_after, ...account }));
      await log("approve_deposit", { id, txId, email }, dr.user_id);
      return json({ ok: true, email });
    }

    if (kind === "withdrawal") {
      const { data: wr } = await admin.from("withdrawal_requests").select("*").eq("id", id).single();
      if (!wr) return json({ error: "not found" }, 404);
      if (wr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("withdrawal_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: now() }).eq("id", id);
        const email = await emailUser(admin, wr.user_id, "withdrawal-rejected", withAdmin({ amount: Number(wr.amount), reason: note, reference: id }));
        await log("reject_withdrawal", { id, note, email }, wr.user_id);
        return json({ ok: true, email });
      }
      const { data: txId, error } = await admin.rpc("post_transaction", { _account_id: wr.account_id, _type: "withdrawal", _amount: Number(wr.amount), _description: "Approved withdrawal", _counterparty: null, _related_tx_id: null, _allow_negative: false });
      if (error) return json({ error: error.message }, 400);
      await admin.from("withdrawal_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now(), admin_note: note }).eq("id", id);
      const tx = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const account = await accountDetails(admin, wr.account_id);
      const email = await emailUser(admin, wr.user_id, "withdrawal-approved", withAdmin({ amount: Number(wr.amount), description: "Approved withdrawal", reference: tx?.reference ?? id, balanceAfter: tx?.balance_after, ...account }));
      await log("approve_withdrawal", { id, txId, email }, wr.user_id);
      return json({ ok: true, email });
    }

    if (kind === "kyc") {
      const newStatus = action === "approve" ? "approved" : "rejected";
      await admin.from("profiles").update({ kyc_status: newStatus, kyc_reason: note ?? null }).eq("id", id);
      const accounts = action === "approve" ? await ensureAccounts(admin, id) : [];
      const email = await emailUser(admin, id, action === "approve" ? "kyc-approved" : "kyc-rejected", withAdmin({ reason: note, accountCount: accounts.length }));
      await log("kyc_" + action, { note, email }, id);
      return json({ ok: true, email, accounts });
    }

    if (kind === "freeze") {
      const newStatus = action === "freeze" ? "frozen" : "approved";
      await admin.from("profiles").update({ kyc_status: newStatus, kyc_reason: note ?? null }).eq("id", id);
      await admin.from("accounts").update({ is_frozen: action === "freeze" }).eq("user_id", id);
      const email = await emailUser(admin, id, action === "freeze" ? "account-frozen" : "account-unfrozen", withAdmin({ reason: note }));
      await log(action + "_account", { note, email }, id);
      return json({ ok: true, email });
    }

    if (kind === "adjustment") {
      const parsed = parseAdjustment(note);
      const amt = Number(parsed.amount ?? 0);
      if (!amt) return json({ error: "amount required" }, 400);
      const { data: acct } = await admin.from("accounts").select("user_id, account_type, account_number").eq("id", id).single();
      if (!acct) return json({ error: "account not found" }, 404);
      const txType = amt > 0 ? "adjustment" : "withdrawal";
      const description = parsed.description ?? (amt > 0 ? "Admin credit" : "Admin debit");
      const { data: txId, error } = await admin.rpc("post_transaction", { _account_id: id, _type: txType, _amount: Math.abs(amt), _description: description, _counterparty: adminEmail, _related_tx_id: null, _allow_negative: parsed.allow_negative ?? true });
      if (error) return json({ error: error.message }, 400);
      // Optional manual value date/time supplied by the admin
      let postedAt: string | null = null;
      if (typeof parsed.posted_at === "string" && parsed.posted_at) {
        const d = new Date(parsed.posted_at);
        if (!Number.isNaN(d.getTime())) {
          postedAt = d.toISOString();
          if (typeof txId === "string") await admin.from("transactions").update({ created_at: postedAt }).eq("id", txId);
        }
      }
      const tx = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const email = await emailUser(admin, acct.user_id, "balance-adjusted", { ...withAdmin({ amount: amt, description, reference: tx?.reference ?? txId ?? id, balanceAfter: tx?.balance_after, accountType: acct.account_type, accountLast4: String(acct.account_number).slice(-4) }), date: postedAt ?? now() });
      await log("balance_adjustment", { account_id: id, amount: amt, description, txId, postedAt, email }, acct.user_id);
      return json({ ok: true, txId, postedAt, email });
    }

    if (kind === "reverse") {
      const { data: tx } = await admin.from("transactions").select("*").eq("id", id).single();
      if (!tx) return json({ error: "not found" }, 404);
      const reverseType = ["deposit", "transfer_in", "interest"].includes(tx.type) ? "withdrawal" : "deposit";
      const { data: txId, error } = await admin.rpc("post_transaction", { _account_id: tx.account_id, _type: reverseType, _amount: Math.abs(Number(tx.amount)), _description: `Reversal of ${tx.reference}`, _counterparty: tx.counterparty, _related_tx_id: tx.id, _allow_negative: true });
      if (error) return json({ error: error.message }, 400);
      const reversal = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const email = await emailUser(admin, tx.user_id, "transaction-reversed", withAdmin({ amount: Number(tx.amount), reference: tx.reference, reversalReference: reversal?.reference }));
      await log("reverse_transaction", { tx_id: id, reversalTxId: txId, email }, tx.user_id);
      return json({ ok: true, email });
    }

    if (kind === "loan") {
      const { data: lr } = await admin.from("loan_requests").select("*").eq("id", id).single();
      if (!lr) return json({ error: "not found" }, 404);
      if (lr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("loan_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: now() }).eq("id", id);
        const email = await emailUser(admin, lr.user_id, "loan-rejected", withAdmin({ amount: Number(lr.amount), reason: note, reference: id }));
        await log("reject_loan", { id, note, email }, lr.user_id);
        return json({ ok: true, email });
      }
      const { data: accts } = await admin.from("accounts").select("id, account_type, account_number").eq("user_id", lr.user_id).eq("account_type", "checking");
      const targetAccount = accts?.[0];
      if (!targetAccount) return json({ error: "User has no checking account" }, 400);
      const { data: txId, error } = await admin.rpc("post_transaction", { _account_id: targetAccount.id, _type: "deposit", _amount: Number(lr.amount), _description: `Loan approved: ${lr.purpose ?? "Personal loan"}`, _counterparty: null, _related_tx_id: null, _allow_negative: false });
      if (error) return json({ error: error.message }, 400);
      await admin.from("loan_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now(), admin_note: note }).eq("id", id);
      const tx = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const email = await emailUser(admin, lr.user_id, "loan-approved", withAdmin({ amount: Number(lr.amount), description: lr.purpose, reference: tx?.reference ?? id, balanceAfter: tx?.balance_after, accountType: targetAccount.account_type, accountLast4: String(targetAccount.account_number).slice(-4) }));
      await log("approve_loan", { id, txId, email }, lr.user_id);
      return json({ ok: true, email });
    }

    if (kind === "card") {
      const { data: cr } = await admin.from("card_requests").select("*").eq("id", id).single();
      if (!cr) return json({ error: "not found" }, 404);
      if (cr.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("card_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: now() }).eq("id", id);
        const email = await emailUser(admin, cr.user_id, "card-rejected", withAdmin({ reason: note, reference: id }));
        await log("reject_card", { id, note, email }, cr.user_id);
        return json({ ok: true, email });
      }
      const { data: prof } = await admin.from("profiles").select("full_name").eq("id", cr.user_id).single();
      const rand = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
      const number = "4" + rand(15);
      const cvv = rand(3);
      const issuedAt = new Date();
      await admin.from("cards").insert({ user_id: cr.user_id, account_id: cr.account_id, card_number: number, cardholder_name: (prof?.full_name ?? "CARDHOLDER").toUpperCase(), expiry_month: issuedAt.getMonth() + 1, expiry_year: issuedAt.getFullYear() + 4, cvv });
      await admin.from("card_requests").update({ status: "approved", reviewed_by: user.id, reviewed_at: now(), admin_note: note }).eq("id", id);
      const email = await emailUser(admin, cr.user_id, "card-issued", withAdmin({ last4: number.slice(-4), reference: id }));
      await log("approve_card", { id, email }, cr.user_id);
      return json({ ok: true, email });
    }

    if (kind === "atc") {
      const { data: ar } = await admin.from("atc_requests").select("*").eq("id", id).single();
      if (!ar) return json({ error: "not found" }, 404);
      if (ar.status !== "pending") return json({ error: "already processed" }, 400);
      if (action === "reject") {
        await admin.from("atc_requests").update({ status: "rejected", admin_note: note, reviewed_by: user.id, reviewed_at: now() }).eq("id", id);
        const email = await emailUser(admin, ar.user_id, "atc-rejected", withAdmin({ reason: note, reference: id }));
        await log("reject_atc", { id, note, email }, ar.user_id);
        return json({ ok: true, email });
      }
      let code = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
        const { data: dup } = await admin.from("atc_requests").select("id").eq("code", candidate).maybeSingle();
        if (!dup) { code = candidate; break; }
      }
      if (!code) return json({ error: "could not generate unique code" }, 500);
      const { data: txId } = await admin.rpc("post_transaction", { _account_id: ar.account_id, _type: "adjustment", _amount: Number(ar.amount), _description: "ATC fee refund", _counterparty: null, _related_tx_id: null, _allow_negative: false });
      await admin.from("atc_requests").update({ status: "approved", code, reviewed_by: user.id, reviewed_at: now(), admin_note: note, expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString() }).eq("id", id);
      const tx = await txDetails(admin, typeof txId === "string" ? txId : undefined);
      const account = await accountDetails(admin, ar.account_id);
      const email = await emailUser(admin, ar.user_id, "atc-issued", withAdmin({ code, amount: Number(ar.amount), reference: tx?.reference ?? id, ...account }));
      await log("approve_atc", { id, code, txId, email }, ar.user_id);
      return json({ ok: true, email });
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

function parseAdjustment(note?: string) {
  try { return JSON.parse(note ?? "{}"); } catch { return {}; }
}

async function accountNumber(admin: AdminClient) {
  const { data } = await admin.rpc("gen_account_number");
  if (typeof data === "string" && data.length > 0) return data;
  return "100" + Math.floor(Math.random() * 1e7).toString().padStart(7, "0");
}

async function ensureAccounts(admin: AdminClient, targetUserId: string) {
  const { data: existing, error: existingError } = await admin.from("accounts").select("id, account_type").eq("user_id", targetUserId);
  if (existingError) throw new Error(existingError.message);
  const existingTypes = new Set((existing ?? []).map((account) => account.account_type));
  const rows = [];
  if (!existingTypes.has("checking")) rows.push({ user_id: targetUserId, account_type: "checking", account_number: await accountNumber(admin) });
  if (!existingTypes.has("savings")) rows.push({ user_id: targetUserId, account_type: "savings", account_number: await accountNumber(admin) });
  if (rows.length > 0) {
    const { error: insertError } = await admin.from("accounts").insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
  const { data: accounts, error: loadError } = await admin.from("accounts").select("*").eq("user_id", targetUserId).order("created_at");
  if (loadError) throw new Error(loadError.message);
  return accounts ?? [];
}

async function txDetails(admin: AdminClient, txId?: string) {
  if (!txId) return null;
  const { data } = await admin.from("transactions").select("reference, balance_after, created_at").eq("id", txId).maybeSingle();
  return data ?? null;
}

async function accountDetails(admin: AdminClient, accountId?: string) {
  if (!accountId) return {};
  const { data } = await admin.from("accounts").select("account_type, account_number").eq("id", accountId).maybeSingle();
  return data ? { accountType: data.account_type, accountLast4: String(data.account_number).slice(-4) } : {};
}

async function emailUser(admin: AdminClient, userId: string, templateName: string, templateData: Record<string, unknown>): Promise<EmailResult> {
  const { data: prof } = await admin.from("profiles").select("email, full_name").eq("id", userId).single();
  if (!prof?.email) return { ok: false, error: "missing recipient" };
  try {
    const { data, error } = await admin.functions.invoke("send-transactional-email", {
      body: { templateName, recipientEmail: prof.email, idempotencyKey: `${templateName}-${userId}-${Date.now()}`, templateData: { name: prof.full_name, ...templateData } },
    });
    const result = data as { id?: unknown; error?: string; details?: unknown } | null;
    if (error || result?.error) {
      const message = result?.error ?? error?.message ?? "Email send failed";
      console.error("email failed", { templateName, userId, error: message, data });
      return { ok: false, error: message, details: result?.details };
    }
    return { ok: true, id: result?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Email send failed";
    console.error("email failed", e);
    return { ok: false, error: message };
  }
}
