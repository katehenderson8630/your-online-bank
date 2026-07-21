// Sends a password reset link via the project's Resend pipeline (not Supabase default).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANONICAL_APP_ORIGIN = "https://Lyncrestdigital.online";
const RESET_PATH = "/reset-password";

function resetRedirectUrl(raw?: string) {
  try {
    const parsed = new URL(raw ?? "", CANONICAL_APP_ORIGIN);
    parsed.protocol = "https:";
    parsed.hostname = "Lyncrestdigital.online";
    parsed.pathname = RESET_PATH;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return `${CANONICAL_APP_ORIGIN}${RESET_PATH}`;
  }
}

function forceResetRedirect(actionLink: string, redirectTo: string) {
  try {
    const parsed = new URL(actionLink);
    parsed.searchParams.set("redirect_to", redirectTo);
    return parsed.toString();
  } catch {
    return actionLink;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, redirectTo } = (await req.json()) as { email?: string; redirectTo?: string };
    if (!email) return json({ error: "email required" }, 400);
    const safeRedirectTo = resetRedirectUrl(redirectTo);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    // Generate a recovery link without sending Supabase's default email
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: safeRedirectTo },
    });

    // Always respond with success to avoid email enumeration
    if (error || !data?.properties?.action_link) {
      return json({ ok: true });
    }

    const actionLink = forceResetRedirect(data.properties.action_link, safeRedirectTo);
    const { data: prof } = await admin
      .from("profiles")
      .select("full_name")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    // Send via the existing Resend-based transactional email function
    await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "password-reset",
        recipientEmail: email,
        idempotencyKey: `pwreset-${email}-${Date.now()}`,
        templateData: { name: prof?.full_name ?? "Customer", link: actionLink },
      },
    });

    return json({ ok: true });
  } catch (e) {
    console.error("request-password-reset error", e);
    return json({ ok: true }); // never leak
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
