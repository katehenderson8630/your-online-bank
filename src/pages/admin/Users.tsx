import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

type Profile = { id: string; email: string; full_name: string; phone: string | null; avatar_url: string | null; kyc_status: string; kyc_reason: string | null };
type Account = { id: string; account_number: string; account_type: string; balance: number };

export default function AdminUsers() {
  const [list, setList] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Profile | null>(null);
  const [reason, setReason] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [adjustAcc, setAdjustAcc] = useState("");
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setList((data as Profile[]) ?? []);
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        load();
        if (open) openUser(open);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, open]);

  const openUser = async (p: Profile) => {
    setOpen(p); setReason(p.kyc_reason ?? ""); setAdjustAmount(""); setAdjustNote("");
    setAccountsLoading(true);
    const { data, error } = await supabase.from("accounts").select("id, account_number, account_type, balance").eq("user_id", p.id).order("created_at");
    setAccountsLoading(false);
    if (error) {
      setAccounts([]); setAdjustAcc("");
      return toast.error("Could not load user accounts: " + error.message);
    }
    setAccounts((data as Account[]) ?? []);
    setAdjustAcc(data?.[0]?.id ?? "");
  };

  const action = async (kind: string, action: string) => {
    if (!open) return;
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind, id: open.id, action, note: reason } });
    if (error || (data as { error?: string })?.error) return toast.error((data as { error?: string })?.error ?? "Failed");
    toast.success("Done"); setOpen(null); load();
  };
  const creditDebit = async (sign: 1 | -1) => {
    if (!adjustAcc) return toast.error("Create or select an account first");
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) return toast.error("Enter a positive amount");
    const signed = sign * Math.abs(amt);
    setAdjusting(true);
    const { error, data } = await supabase.functions.invoke("admin-action", {
      body: { kind: "adjustment", id: adjustAcc, action: "approve", note: JSON.stringify({ amount: signed, description: adjustNote || (sign > 0 ? "Account credit" : "Account debit"), allow_negative: true }) },
    });
    setAdjusting(false);
    if (error || (data as { error?: string })?.error) return toast.error((data as { error?: string })?.error ?? "Failed");
    toast.success(sign > 0 ? "Account credited" : "Account debited"); setAdjustAmount(""); setAdjustNote("");
    if (open) openUser(open);
  };

  const createAccounts = async () => {
    if (!open) return;
    setAccountsLoading(true);
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind: "accounts", id: open.id, action: "approve" } });
    if (error || (data as { error?: string })?.error) {
      setAccountsLoading(false);
      return toast.error((data as { error?: string })?.error ?? "Could not create accounts");
    }
    toast.success("Checking and savings accounts are ready");
    await openUser(open);
  };

  const filtered = list.filter((p) => !q || p.email.includes(q.toLowerCase()) || p.full_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">Users & KYC</h1>
      <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <Card className="divide-y">
        {filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">No applicants found.</div>
        ) : filtered.map((p) => (
          <div key={p.id} className="p-4 flex items-center gap-3">
            <Avatar><AvatarImage src={p.avatar_url ?? undefined} /><AvatarFallback>{p.full_name[0]}</AvatarFallback></Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.full_name}</div>
              <div className="text-xs text-muted-foreground truncate">{p.email}</div>
            </div>
            <Badge variant={p.kyc_status === "approved" ? "default" : p.kyc_status === "pending" ? "secondary" : "destructive"} className="capitalize">{p.kyc_status}</Badge>
            <Dialog open={open?.id === p.id} onOpenChange={(o) => !o && setOpen(null)}>
              <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => openUser(p)}>Manage / Credit</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{p.full_name}</DialogTitle></DialogHeader>
                {p.avatar_url && <img src={p.avatar_url} alt="selfie" className="w-32 h-32 rounded-full object-cover mx-auto" />}
                <div className="text-sm space-y-1">
                  <div><b>Email:</b> {p.email}</div>
                  <div><b>Phone:</b> {p.phone ?? "—"}</div>
                  <div><b>Status:</b> {p.kyc_status}</div>
                </div>
                <div>
                  <Label>Reason / note</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => action("kyc", "approve")}>Approve KYC</Button>
                  <Button size="sm" variant="destructive" onClick={() => action("kyc", "reject")}>Reject</Button>
                  <Button size="sm" variant="outline" onClick={() => action("freeze", "freeze")}>Freeze</Button>
                  <Button size="sm" variant="outline" onClick={() => action("freeze", "unfreeze")}>Unfreeze</Button>
                </div>
                <div className="border-t pt-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">Credit / Debit account</div>
                      <div className="text-xs text-muted-foreground">Post a real transaction and email the user via Resend.</div>
                    </div>
                    {accounts.length === 0 && !accountsLoading && <Button size="sm" variant="outline" onClick={createAccounts}>Create accounts</Button>}
                  </div>
                  {accountsLoading ? (
                    <div className="p-3 text-sm text-muted-foreground border rounded-md">Loading accounts…</div>
                  ) : accounts.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground border rounded-md">No accounts found for this user yet. Create accounts, then use Credit or Debit.</div>
                  ) : (
                    <>
                      <select className="w-full border rounded p-2 text-sm bg-background" value={adjustAcc} onChange={(e) => setAdjustAcc(e.target.value)}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_type} •••{a.account_number.slice(-4)} ({fmtMoney(a.balance)})</option>)}
                      </select>
                      <Input type="number" step="0.01" min="0" placeholder="Amount" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                      <Input placeholder="Description (e.g. wire credit, fee debit)" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
                      <div className="flex gap-2">
                        <Button size="sm" disabled={adjusting} onClick={() => creditDebit(1)}>Credit</Button>
                        <Button size="sm" disabled={adjusting} variant="destructive" onClick={() => creditDebit(-1)}>Debit</Button>
                      </div>
                    </>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ))}
      </Card>
    </div>
  );
}
