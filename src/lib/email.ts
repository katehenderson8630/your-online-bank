import { supabase } from "@/integrations/supabase/client";

export async function sendEmail(templateName: string, recipientEmail: string, idempotencyKey: string, templateData?: Record<string, unknown>) {
  try {
    await supabase.functions.invoke("send-transactional-email", {
      body: { templateName, recipientEmail, idempotencyKey, templateData },
    });
  } catch (e) {
    console.error("email send failed", e);
  }
}
