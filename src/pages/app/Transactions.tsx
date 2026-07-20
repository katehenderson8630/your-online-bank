import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, Download } from "lucide-react";

type Tx = { id: string; type: string; status: string; amount: number; description: string | null; created_at: string; reference: string };

export default function Transactions() {
  const [list, setList] = useState<Tx[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setList((data as Tx[]) ?? []));
  }, []);

  const filtered = list.filter((t) =>
    !q || t.description?.toLowerCase().includes(q.toLowerCase()) || t.reference.toLowerCase().includes(q.toLowerCase()) || t.type.includes(q.toLowerCase())
  );

  const exportCsv = () => {
    const rows = [["Date", "Type", "Status", "Amount", "Description", "Reference"]];
    filtered.forEach((t) => rows.push([t.created_at, t.type, t.status, String(t.amount), t.description ?? "", t.reference]));
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transactions.csv";
    a.click();
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Export</Button>
      </div>
      <Input placeholder="Search description, reference, or type" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="divide-y">
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No transactions.</div>
        ) : filtered.map((t) => {
          const isIn = ["deposit", "transfer_in", "interest", "reversal"].includes(t.type);
          return (
            <div key={t.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isIn ? "bg-success/10 text-success" : "bg-secondary"}`}>
                  {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{t.description || t.type.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(t.created_at)} · {t.reference}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`tabular font-semibold text-sm ${isIn ? "text-success" : ""}`}>
                  {isIn ? "+" : "-"}{fmtMoney(Math.abs(Number(t.amount)))}
                </div>
                <Badge variant="outline" className="text-xs mt-1">{t.status}</Badge>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
