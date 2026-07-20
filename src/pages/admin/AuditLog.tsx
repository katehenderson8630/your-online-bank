import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { fmtDate } from "@/lib/format";

type Log = { id: string; admin_id: string; action: string; target_user_id: string | null; details: unknown; created_at: string };

export default function AuditLog() {
  const [list, setList] = useState<Log[]>([]);
  useEffect(() => { supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300).then(({ data }) => setList((data as Log[]) ?? [])); }, []);
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <Card className="divide-y">
        {list.map((l) => (
          <div key={l.id} className="p-3 text-sm">
            <div className="flex justify-between"><span className="font-medium">{l.action}</span><span className="text-xs text-muted-foreground">{fmtDate(l.created_at)}</span></div>
            <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{JSON.stringify(l.details, null, 2)}</pre>
          </div>
        ))}
      </Card>
    </div>
  );
}
