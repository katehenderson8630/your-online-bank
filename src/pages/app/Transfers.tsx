import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { fmtMoney, fmtAccount } from "@/lib/format";
import { sendEmail } from "@/lib/email";
import { Clock, ShieldCheck } from "lucide-react";

type Account = { id: string; account_number: string; account_type: string; balance: number };

export default function Transfers() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [extAcct, setExtAcct] = useState("");
  const [extRouting, setExtRouting] = useState("");
  const [extName, setExtName] = useState("");
  const [atcCode, setAtcCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [pendingNotice, setPendingNotice] = useState<{ amount: number; recipient: string; reference: string } | null>(null);

  useEffect(() => {
    supabase.from("accounts").select("*").then(({ data }) => {
      const list = (data as Account[]) ?? [];
      setAccounts(list);
      if (list[0]) setFrom(list[0].id);
    });
    supabase.from("cards").select("id").limit(1).then(({ data }) => {
      setHasCard((data?.length ?? 0) > 0);
    });
  }, []);

  // Validates and consumes an ATC code for the chosen account+amount
  const consumeAtc = async (amt: number): Promise<{ ok: true; id: string } | { ok: false; err: string }> => {
    const code = atcCode.trim().toUpperCase();
    if (!code) return { ok: false, err: "Enter your Authorization Transfer Code (ATC)." };
    const { data, error } = await supabase
      .from("atc_requests")
      .select("*")
      .eq("code", code)
      .eq("account_id", from)
      .eq("status", "approved")
      .eq("used", false)
      .maybeSingle();
    if (error) return { ok: false, err: error.message };
    if (!data) return { ok: false, err: "Invalid ATC code, or it doesn't match this account." };
    if (Number(data.amount) < amt) return { ok: false, err: `This ATC only authorizes up to ${fmtMoney(Number(data.amount))}.` };
    const { error: upd } = await supabase.from("atc_requests").update({ used: true }).eq("id", data.id);
    if (upd) return { ok: false, err: upd.message };
    return { ok: true, id: data.id };
  };

  const submitInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    const parsed = z.object({ email: z.string().email(), amt: z.number().positive() }).safeParse({ email: recipientEmail, amt });
    if (!parsed.success) return toast.error("Enter a valid email and amount");
    setBusy(true);

    // Look up recipient's checking account
    const { data: rec } = await supabase.from("profiles").select("id, full_name").eq("email", recipientEmail.trim()).maybeSingle();
    if (!rec) { setBusy(false); return toast.error("Recipient not found"); }
    const { data: toAcc } = await supabase.from("accounts").select("id").eq("user_id", rec.id).eq("account_type", "checking").maybeSingle();
    if (!toAcc) { setBusy(false); return toast.error("Recipient has no checking account"); }

    const consumed = await consumeAtc(amt);
    if (consumed.ok === false) { setBusy(false); return toast.error(consumed.err); }

    const { data: tr, error } = await supabase.from("transfer_requests").insert({
      user_id: user.id, from_account_id: from, to_account_id: toAcc.id, amount: amt, memo,
      is_external: false, atc_request_id: consumed.id,
    }).select("id").single();
    setBusy(false);
    if (error) {
      await supabase.from("atc_requests").update({ used: false }).eq("id", consumed.id);
      return toast.error(error.message);
    }
    await supabase.from("atc_requests").update({ used_by_transfer_id: tr?.id }).eq("id", consumed.id);
    sendEmail("transfer-pending", profile!.email, `intreq-${tr?.id}`, { name: profile!.full_name, amount: amt, recipient: rec.full_name });
    setPendingNotice({ amount: amt, recipient: rec.full_name, reference: tr?.id?.slice(0, 8).toUpperCase() ?? "" });
    setAmount(""); setMemo(""); setRecipientEmail(""); setAtcCode("");
  };

  const submitExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (!extAcct || !extRouting || !extName || !(amt > 0)) return toast.error("Fill all fields with a positive amount");
    setBusy(true);
    const consumed = await consumeAtc(amt);
    if (consumed.ok === false) { setBusy(false); return toast.error(consumed.err); }
    const { data: tr, error } = await supabase.from("transfer_requests").insert({
      user_id: user.id, from_account_id: from, amount: amt, memo,
      external_account_number: extAcct, external_routing_number: extRouting, external_recipient_name: extName,
      is_external: true, atc_request_id: consumed.id,
    }).select("id").single();
    setBusy(false);
    if (error) {
      await supabase.from("atc_requests").update({ used: false }).eq("id", consumed.id);
      return toast.error(error.message);
    }
    await supabase.from("atc_requests").update({ used_by_transfer_id: tr?.id }).eq("id", consumed.id);
    sendEmail("transfer-pending", profile!.email, `extreq-${tr?.id}`, { name: profile!.full_name, amount: amt, recipient: extName });
    setPendingNotice({ amount: amt, recipient: extName, reference: tr?.id?.slice(0, 8).toUpperCase() ?? "" });
    setAmount(""); setMemo(""); setExtAcct(""); setExtRouting(""); setExtName(""); setAtcCode("");
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Send money</h1>

      {hasCard === false && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="font-medium">Debit card required</div>
          <p className="text-sm text-muted-foreground mt-1">
            You need an active debit card to send transfers. Contact our live support agent for the issuance fee and payment details.
          </p>
          <a href="/app/cards" className="inline-block mt-3 text-sm font-medium underline">Go to cards →</a>
        </Card>
      )}

      <fieldset disabled={hasCard === false} className="space-y-6 disabled:opacity-50">
        <div>
          <Label>From account</Label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.account_type} {fmtAccount(a.account_number)} — {fmtMoney(a.balance)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="internal">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="internal">To Lyncrest Digital Bank user</TabsTrigger>
            <TabsTrigger value="external">External bank</TabsTrigger>
          </TabsList>
          <TabsContent value="internal">
            <Card className="p-4 mt-3">
              <form onSubmit={submitInternal} className="space-y-3">
                <div><Label>Recipient email</Label><Input type="email" required value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} /></div>
                <div><Label>Amount</Label><Input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <div>
                  <Label>Authorization Transfer Code (ATC)</Label>
                  <Input placeholder="Paste the code from your email" required value={atcCode} onChange={(e) => setAtcCode(e.target.value.toUpperCase())} className="font-mono tracking-widest" />
                  <p className="text-xs text-muted-foreground mt-1">Don't have a code yet? <a href="/app/atc" className="underline">Request one</a>.</p>
                </div>
                <div><Label>Memo</Label><Textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} /></div>
                <Button disabled={busy} className="w-full">Submit transfer</Button>
                <p className="text-xs text-muted-foreground">All transfers are reviewed by our compliance team before settlement. Need help? Email <a className="underline" href="mailto:support@Lyncrestdigital.online">support@Lyncrestdigital.online</a>.</p>
              </form>
            </Card>
          </TabsContent>
          <TabsContent value="external">
            <Card className="p-4 mt-3">
              <form onSubmit={submitExternal} className="space-y-3">
                <div><Label>Recipient name</Label><Input required value={extName} onChange={(e) => setExtName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Account #</Label><Input required value={extAcct} onChange={(e) => setExtAcct(e.target.value)} /></div>
                  <div><Label>Routing #</Label><Input required value={extRouting} onChange={(e) => setExtRouting(e.target.value)} /></div>
                </div>
                <div><Label>Amount</Label><Input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                <div>
                  <Label>Authorization Transfer Code (ATC)</Label>
                  <Input placeholder="Paste the code from your email" required value={atcCode} onChange={(e) => setAtcCode(e.target.value.toUpperCase())} className="font-mono tracking-widest" />
                </div>
                <div><Label>Memo</Label><Textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={200} /></div>
                <Button disabled={busy} className="w-full">Submit for review</Button>
                <p className="text-xs text-muted-foreground">External transfers are reviewed by an admin before sending. Need help? Email <a className="underline" href="mailto:support@Lyncrestdigital.online">support@Lyncrestdigital.online</a>.</p>
              </form>
            </Card>
          </TabsContent>
        </Tabs>
      </fieldset>

      <Dialog open={!!pendingNotice} onOpenChange={(o) => !o && setPendingNotice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/15 text-warning flex items-center justify-center mb-2">
              <Clock className="w-7 h-7" />
            </div>
            <DialogTitle className="text-center">Transfer pending review</DialogTitle>
            <DialogDescription className="text-center">
              For your security, every transfer is verified by our compliance team before settlement. You and the recipient will be notified once it has been processed.
            </DialogDescription>
          </DialogHeader>
          {pendingNotice && (
            <div className="rounded-lg border bg-secondary/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold tabular">{fmtMoney(pendingNotice.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recipient</span><span className="font-medium truncate ml-3">{pendingNotice.recipient}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono">{pendingNotice.reference}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="inline-flex items-center gap-1.5 font-medium text-warning"><span className="w-1.5 h-1.5 rounded-full bg-warning" />Pending approval</span></div>
            </div>
          )}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>Funds remain in your available balance until the transfer is approved. You can track its status in Transactions.</span>
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => setPendingNotice(null)}>OK, got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
