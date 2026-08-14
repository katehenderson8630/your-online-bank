import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/format";

type Profile = { id: string; email: string; full_name: string; phone: string | null; avatar_url: string | null; kyc_status: string; kyc_reason: string | null };
type Account = { id: string; account_number: string; account_type: string; balance: number };

const localNow = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

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
  const postingRef = useRef(false);
  const [useNow, setUseNow] = useState(true);
  const [postedAt, setPostedAt] = useState(localNow());

  const load = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setList((data as Profile[]) ?? []);
  }, []);

  const loadAccounts = useCallback(async (p: Profile, reset = false) => {
    const { data, error } = await supabase.from("accounts").select("id, account_number, account_type, balance").eq("user_id", p.id).order("created_at");
    if (error) {
      toast.error("Could not load user accounts: " + error.message);
      return [] as Account[];
    }
    const rows = (data as Account[]) ?? [];
    setAccounts(rows);
    setAdjustAcc((current) => (!reset && rows.some((a) => a.id === current) ? current : rows[0]?.id ?? ""));
    return rows;
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("admin-users-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        load();
        if (open) loadAccounts(open);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load, loadAccounts, open]);

  const openUser = async (p: Profile) => {
    setOpen(p); setReason(p.kyc_reason ?? ""); setAdjustAmount(""); setAdjustNote("");
    setUseNow(true); setPostedAt(localNow());
    setAccountsLoading(true);
    // Read what already exists first — the dialog is usable immediately.
    const existing = await loadAccounts(p, true);
    setAccountsLoading(false);
    if (existing.length > 0) return;
    // Only if the user has no accounts yet, ask the backend to create them.
    setAccountsLoading(true);
    const { error, data } = await supabase.functions.invoke("admin-action", {
      body: { kind: "accounts", id: p.id, action: "approve" },
    });
    const result = data as { error?: string; accounts?: Account[] } | null;
    if (error || result?.error) {
      setAccountsLoading(false);
      toast.error(result?.error ?? error?.message ?? "Could not prepare this user's accounts");
      return;
    }
    if (result?.accounts?.length) {
      setAccounts(result.accounts);
      setAdjustAcc(result.accounts[0].id);
    } else {
      await loadAccounts(p, true);
    }
    setAccountsLoading(false);
  };

  const action = async (kind: string, action: string) => {
    if (!open) return;
    const { error, data } = await supabase.functions.invoke("admin-action", { body: { kind, id: open.id, action, note: reason } });
    if (error || (data as { error?: string })?.error) return toast.error((data as { error?: string })?.error ?? "Failed");
    toast.success("Done"); setOpen(null); load();
  };
  const creditDebit = async (sign: 1 | -1) => {
    if (!open) return toast.error("Open a user account first");
    if (!adjustAcc) return toast.error("No account is available for this user");
    if (postingRef.current) return; // guard against double taps posting twice
    const amt = parseFloat(adjustAmount);
    if (!amt || amt <= 0) return toast.error("Enter a positive amount");
    let valueDate: string | null = null;
    if (!useNow) {
      const d = new Date(postedAt);
      if (Number.isNaN(d.getTime())) return toast.error("Enter a valid date and time");
      valueDate = d.toISOString();
    }
    const signed = sign * Math.abs(amt);
    setAdjusting(true);
    const { error, data } = await supabase.functions.invoke("admin-action", {
      body: {
        kind: "adjustment",
        id: adjustAcc,
        action: "approve",
        note: JSON.stringify({
          amount: signed,
          description: adjustNote || (sign > 0 ? "Account credit" : "Account debit"),
          allow_negative: true,
          posted_at: valueDate,
        }),
      },
    });
    setAdjusting(false);
    const result = data as { error?: string; email?: { ok?: boolean; error?: string } } | null;
    if (error || result?.error) return toast.error(result?.error ?? error?.message ?? "Failed");
    if (result?.email?.ok === false) toast.warning(`Transaction posted, but email failed: ${result.email.error ?? "Resend rejected the email"}`);
    toast.success(sign > 0 ? "Account credited" : "Account debited"); setAdjustAmount(""); setAdjustNote("");
    loadAccounts(open);
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
                <DialogTrigger asChild><Button size="sm" variant="outline" onClick={() => openUser(p)}>Manage account</Button></DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{p.full_name}</DialogTitle></DialogHeader>
                {p.avatar_url && <img src={p.avatar_url} alt="selfie" className="w-24 h-24 rounded-full object-cover mx-auto" />}
                <div className="text-sm space-y-1">
                  <div><b>Email:</b> {p.email}</div>
                  <div><b>Phone:</b> {p.phone ?? "—"}</div>
                  <div><b>Status:</b> {p.kyc_status}</div>
                </div>

                <div className="space-y-2">
                  <Label>KYC reason / note</Label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => action("kyc", "approve")}>Approve KYC</Button>
                    <Button size="sm" variant="destructive" onClick={() => action("kyc", "reject")}>Reject</Button>
                    <Button size="sm" variant="outline" onClick={() => action("freeze", "freeze")}>Freeze</Button>
                    <Button size="sm" variant="outline" onClick={() => action("freeze", "unfreeze")}>Unfreeze</Button>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <div className="font-semibold">Credit / Debit account</div>
                    <div className="text-xs text-muted-foreground">The customer receives an email containing the description, amount, date, reference, account, and new balance.</div>
                  </div>
                  {accounts.length === 0 && accountsLoading ? (
                    <div className="p-3 text-sm text-muted-foreground border rounded-md">Preparing user accounts…</div>
                  ) : accounts.length === 0 ? (
                    <div className="p-3 text-sm text-destructive border border-destructive/30 rounded-md space-y-2">
                      <div>This user has no accounts yet.</div>
                      <Button size="sm" variant="outline" onClick={() => open && openUser(open)}>Retry / create accounts</Button>
                    </div>
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
                         <Input className="bg-background" type="number" step="0.01" min="0.01" placeholder="Amount" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description / narration</Label>
                        <Textarea
                          className="bg-background min-h-[70px]"
                           placeholder="Description (e.g. wire credit from Chase Bank, service fee debit)"
                          value={adjustNote}
                          onChange={(e) => setAdjustNote(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground">This text appears on the customer’s statement and in the email alert, along with date, time, reference and new balance.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Value date &amp; time</Label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Checkbox checked={useNow} onCheckedChange={(v) => { const on = v === true; setUseNow(on); if (!on) setPostedAt(localNow()); }} />
                          Use current date &amp; time
                        </label>
                        {!useNow && (
                          <Input className="bg-background" type="datetime-local" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1" disabled={adjusting} onClick={() => creditDebit(1)}>{adjusting ? "Posting…" : "Credit"}</Button>
                        <Button className="flex-1" disabled={adjusting} variant="destructive" onClick={() => creditDebit(-1)}>{adjusting ? "Posting…" : "Debit"}</Button>
                      </div>
                    </div>
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
