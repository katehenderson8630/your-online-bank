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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

type Profile = { id: string; email: string; full_name: string; phone: string | null; avatar_url: string | null; kyc_status: string; kyc_reason: string | null };
type Account = { id: string; account_number: string; account_type: string; balance: number };

export default function AdminUsers() {
  const [list, setList] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
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
        if (selected) loadAccounts(selected);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, selected]);

  const loadAccounts = async (p: Profile, reset = false) => {
    setAccountsLoading(true);
    const { data, error } = await supabase.from("accounts").select("id, account_number, account_type, balance").eq("user_id", p.id).order("created_at");
    setAccountsLoading(false);
    if (error) {
      setAccounts([]); setAdjustAcc("");
      return toast.error("Could not load user accounts: " + error.message);
    }
    setAccounts((data as Account[]) ?? []);
    setAdjustAcc((current) => data?.some((account) => account.id === current) && !reset ? current : data?.[0]?.id ?? "");
  };

  const selectUser = async (id: string) => {
    const p = list.find((profile) => profile.id === id);
    if (!p) return;
    setSelected(p); setReason(p.kyc_reason ?? ""); setAdjustAmount(""); setAdjustNote("");
    await loadAccounts(p, true);
  };

  const openUser = async (p: Profile) => {
    setOpen(p); setSelected(p); setReason(p.kyc_reason ?? ""); setAdjustAmount(""); setAdjustNote("");
    await loadAccounts(p, true);
  };

  const action = async (kind: string, action: string) => {
    if (!open) return;
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind, id: open.id, action, note: reason } });
    if (error || (data as { error?: string })?.error) return toast.error((data as { error?: string })?.error ?? "Failed");
    toast.success("Done"); setOpen(null); load();
  };
  const creditDebit = async (sign: 1 | -1) => {
    if (!selected) return toast.error("Select a user first");
    if (!adjustAcc) return toast.error("Create or select an account first");
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) return toast.error("Enter a positive amount");
    const signed = sign * Math.abs(amt);
    setAdjusting(true);
    const { error, data } = await supabase.functions.invoke("admin-action", {
      body: { kind: "adjustment", id: adjustAcc, action: "approve", note: JSON.stringify({ amount: signed, description: adjustNote || (sign > 0 ? "Account credit" : "Account debit"), allow_negative: true }) },
    });
    setAdjusting(false);
    const result = data as { error?: string; email?: { ok?: boolean; error?: string } } | null;
    if (error || result?.error) return toast.error(result?.error ?? "Failed");
    if (result?.email?.ok === false) toast.warning(`Transaction posted, but email failed: ${result.email.error ?? "Resend rejected the email"}`);
    toast.success(sign > 0 ? "Account credited" : "Account debited"); setAdjustAmount(""); setAdjustNote("");
    if (selected) loadAccounts(selected);
  };

  const createAccounts = async () => {
    const target = selected ?? open;
    if (!target) return toast.error("Select a user first");
    setAccountsLoading(true);
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind: "accounts", id: target.id, action: "approve" } });
    if (error || (data as { error?: string })?.error) {
      setAccountsLoading(false);
      return toast.error((data as { error?: string })?.error ?? "Could not create accounts");
    }
    toast.success("Checking and savings accounts are ready");
    await loadAccounts(target, true);
  };

  const filtered = list.filter((p) => !q || p.email.includes(q.toLowerCase()) || p.full_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-4">
      <h1 className="text-2xl font-bold">Users & KYC</h1>
      <Card className="p-4 space-y-4 border-primary/30">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold">Credit / Debit user</h2>
            {selected && <p className="text-xs text-muted-foreground truncate">{selected.full_name} · {selected.email}</p>}
          </div>
          <Select value={selected?.id ?? ""} onValueChange={selectUser}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Select user" /></SelectTrigger>
            <SelectContent>
              {list.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name} · {p.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!selected ? (
          <div className="p-4 text-sm text-muted-foreground border rounded-md">Select a user to credit or debit their account.</div>
        ) : accountsLoading ? (
          <div className="p-4 text-sm text-muted-foreground border rounded-md">Loading accounts…</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-md">
            <div className="text-sm text-muted-foreground">No accounts found for this user.</div>
            <Button size="sm" variant="outline" onClick={createAccounts}>Create accounts</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1.2fr_0.8fr] gap-3">
            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={adjustAcc} onValueChange={setAdjustAcc}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_type} •••{a.account_number.slice(-4)} · {fmtMoney(a.balance)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="0.00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Input placeholder="Wire credit, fee debit, refund, manual correction" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row gap-2">
              <Button disabled={adjusting} onClick={() => creditDebit(1)} className="flex-1">Credit user</Button>
              <Button disabled={adjusting} variant="destructive" onClick={() => creditDebit(-1)} className="flex-1">Debit user</Button>
            </div>
          </div>
        )}
      </Card>
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
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{p.full_name}</DialogTitle></DialogHeader>
                {p.avatar_url && <img src={p.avatar_url} alt="selfie" className="w-24 h-24 rounded-full object-cover mx-auto" />}
                <div className="text-sm space-y-1">
                  <div><b>Email:</b> {p.email}</div>
                  <div><b>Phone:</b> {p.phone ?? "—"}</div>
                  <div><b>Status:</b> {p.kyc_status}</div>
                </div>

                <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">Credit / Debit account</div>
                      <div className="text-xs text-muted-foreground">Posts a real transaction and emails the customer instantly.</div>
                    </div>
                    {accounts.length === 0 && !accountsLoading && <Button size="sm" variant="outline" onClick={createAccounts}>Create accounts</Button>}
                  </div>
                  {accountsLoading ? (
                    <div className="p-3 text-sm text-muted-foreground border rounded-md bg-background">Loading accounts…</div>
                  ) : accounts.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground border rounded-md bg-background">No accounts yet. Click “Create accounts”, then credit or debit.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Account</Label>
                        <Select value={adjustAcc} onValueChange={setAdjustAcc}>
                          <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_type} •••{a.account_number.slice(-4)} · {fmtMoney(a.balance)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Amount (USD)</Label>
                        <Input className="bg-background" type="number" step="0.01" min="0.01" placeholder="0.00" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description / narration</Label>
                        <Textarea
                          className="bg-background min-h-[70px]"
                          placeholder="e.g. Incoming wire transfer from Chase Bank ref 88213 — payroll deposit"
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">This text appears on the customer’s statement and in the email alert, along with date, time, reference and new balance.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" disabled={adjusting} onClick={() => creditDebit(1)}>{adjusting ? "Posting…" : "Credit user"}</Button>
                        <Button className="flex-1" disabled={adjusting} variant="destructive" onClick={() => creditDebit(-1)}>{adjusting ? "Posting…" : "Debit user"}</Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <Label>KYC reason / note</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => action("kyc", "approve")}>Approve KYC</Button>
                    <Button size="sm" variant="destructive" onClick={() => action("kyc", "reject")}>Reject</Button>
                    <Button size="sm" variant="outline" onClick={() => action("freeze", "freeze")}>Freeze</Button>
                    <Button size="sm" variant="outline" onClick={() => action("freeze", "unfreeze")}>Unfreeze</Button>
                  </div>
                </div>

              </DialogContent>
            </Dialog>
          </div>
        ))}
      </Card>
    </div>
  );
}
