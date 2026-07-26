import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { fmtDate, fmtMoney } from "@/lib/format";

type Req = { id: string; user_id: string; amount: number; created_at: string; status: string; memo?: string | null; external_recipient_name?: string | null; is_external?: boolean; purpose?: string | null; duration_months?: number; account_id?: string };

export default function Approvals() {
  const [transfers, setTransfers] = useState<Req[]>([]);
  const [deposits, setDeposits] = useState<Req[]>([]);
  const [withdrawals, setWithdrawals] = useState<Req[]>([]);
  const [loans, setLoans] = useState<Req[]>([]);
  const [cards, setCards] = useState<Req[]>([]);
  const [atcs, setAtcs] = useState<Req[]>([]);

  const load = useCallback(async () => {
    const [t, d, w, l, c, a] = await Promise.all([
      supabase.from("transfer_requests").select("*").eq("status", "pending").order("created_at"),
      supabase.from("deposit_requests").select("*").eq("status", "pending").order("created_at"),
      supabase.from("withdrawal_requests").select("*").eq("status", "pending").order("created_at"),
      supabase.from("loan_requests").select("*").eq("status", "pending").order("created_at"),
      supabase.from("card_requests").select("*").eq("status", "pending").order("created_at"),
      supabase.from("atc_requests").select("*").eq("status", "pending").order("created_at"),
    ]);
    setTransfers((t.data as Req[]) ?? []); setDeposits((d.data as Req[]) ?? []); setWithdrawals((w.data as Req[]) ?? []); setLoans((l.data as Req[]) ?? []); setCards((c.data as Req[]) ?? []); setAtcs((a.data as Req[]) ?? []);
  }, []);
  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-approvals-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_requests" }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const act = async (kind: string, id: string, action: "approve" | "reject") => {
    const note = action === "reject" ? prompt("Reason?") ?? "" : "";
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind, id, action, note } });
    if (error || (data as { error?: string })?.error) return toast.error((data as { error?: string })?.error ?? "Failed");
    toast.success("Done"); load();
  };

  const renderList = (items: Req[], kind: string) => (
    <Card className="divide-y">
      {items.length === 0 ? <div className="p-6 text-sm text-muted-foreground text-center">Nothing pending.</div> :
        items.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold tabular">{fmtMoney(r.amount)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {r.external_recipient_name ? `→ ${r.external_recipient_name} · ` : ""}{fmtDate(r.created_at)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act(kind, r.id, "approve")}>Approve</Button>
              <Button size="sm" variant="destructive" onClick={() => act(kind, r.id, "reject")}>Reject</Button>
            </div>
          </div>
        ))}
    </Card>
  );

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Approvals</h1>
      <Tabs defaultValue="transfers">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="transfers">Transfers ({transfers.length})</TabsTrigger>
          <TabsTrigger value="deposits">Deposits ({deposits.length})</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals ({withdrawals.length})</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="cards">Cards ({cards.length})</TabsTrigger>
          <TabsTrigger value="atc">ATC ({atcs.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="transfers">{renderList(transfers, "transfer")}</TabsContent>
        <TabsContent value="deposits">{renderList(deposits, "deposit")}</TabsContent>
        <TabsContent value="withdrawals">{renderList(withdrawals, "withdrawal")}</TabsContent>
        <TabsContent value="loans">{renderList(loans, "loan")}</TabsContent>
        <TabsContent value="cards">{renderList(cards, "card")}</TabsContent>
        <TabsContent value="atc">{renderList(atcs, "atc")}</TabsContent>
      </Tabs>
    </div>
  );
}
