import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtDate, fmtMoney } from "@/lib/format";

type Tx = { id: string; type: string; status: string; amount: number; description: string | null; created_at: string; reference: string; user_id: string };

export default function AdminTransactions() {
  const [list, setList] = useState<Tx[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setList((data as Tx[]) ?? [])); }, []);
  const reverse = async (id: string) => {
    if (!confirm("Reverse this transaction?")) return;
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind: "reverse", id, action: "approve" } });
    if (error || (data as { error?: string })?.error) return toast.error((data as { error?: string })?.error ?? "Failed");
    toast.success("Reversed");
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500).then(({ data: d }) => setList((d as Tx[]) ?? []));
  };
  const filtered = list.filter((t) => !q || t.reference.includes(q) || t.description?.toLowerCase().includes(q.toLowerCase()) || t.type.includes(q));
  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">All transactions</h1>
      <Input placeholder="Search reference, description, type" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="divide-y">
        {filtered.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{t.description || t.type}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(t.created_at)} · {t.reference}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="tabular font-semibold">{fmtMoney(t.amount)}</div>
              <Badge variant="outline" className="text-xs">{t.status}</Badge>
              <Button size="sm" variant="outline" onClick={() => reverse(t.id)}>Reverse</Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
