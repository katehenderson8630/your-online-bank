import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export async function sendEmail(templateName: string, recipientEmail: string, idempotencyKey: string, templateData?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("send-transactional-email", {
    body: { templateName, recipientEmail, idempotencyKey, templateData },
  });

  if (error) {
    let details = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        details = await error.context.text();
      } catch {
        details = error.message;
      }
    }
    console.error("email send failed", details);
    throw new Error(details || "Email send failed");
  }

  const result = data as { error?: string; details?: unknown } | null;
  if (result?.error) {
    console.error("email send failed", result);
    throw new Error(result.error);
  }

  return data;
}
