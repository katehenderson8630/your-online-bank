import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtAccount, fmtDate, fmtMoney } from "@/lib/format";
import { Plus } from "lucide-react";
import { sendEmail } from "@/lib/email";

type Account = { id: string; account_number: string; account_type: string };
type Payee = { id: string; name: string; account_number: string; category: string | null };
type Bill = { id: string; amount: number; scheduled_for: string; status: string; payee_id: string };

export default function Bills() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [open, setOpen] = useState(false);
  const [pName, setPName] = useState(""); const [pAcct, setPAcct] = useState(""); const [pCat, setPCat] = useState("");
  const [bAccount, setBAccount] = useState(""); const [bPayee, setBPayee] = useState("");
  const [bAmount, setBAmount] = useState(""); const [bDate, setBDate] = useState(new Date().toISOString().slice(0, 10));

  const load = async () => {
    const [{ data: a }, { data: p }, { data: b }] = await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("payees").select("*").order("created_at", { ascending: false }),
      supabase.from("bill_payments").select("*").order("scheduled_for", { ascending: false }),
    ]);
    setAccounts((a as Account[]) ?? []);
    setPayees((p as Payee[]) ?? []);
    setBills((b as Bill[]) ?? []);
    if (a && a[0]) setBAccount(a[0].id);
  };
  useEffect(() => { load(); }, []);

  const addPayee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("payees").insert({ user_id: user.id, name: pName, account_number: pAcct, category: pCat || null });
    if (error) return toast.error(error.message);
    setPName(""); setPAcct(""); setPCat("");
    toast.success("Payee added"); load();
  };

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(bAmount);
    if (!(amt > 0) || !bPayee || !bAccount) return toast.error("Fill all fields");
    const { error } = await supabase.from("bill_payments").insert({
      user_id: user.id, account_id: bAccount, payee_id: bPayee, amount: amt, scheduled_for: bDate,
    });
    if (error) return toast.error(error.message);
    const payee = payees.find((p) => p.id === bPayee);
    sendEmail("bill-scheduled", profile!.email, `bill-${Date.now()}`, { name: profile!.full_name, amount: fmtMoney(amt), payee: payee?.name, date: bDate });
    setBAmount(""); setOpen(false);
    toast.success("Payment scheduled"); load();
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Bill pay</h1>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Add payee</h2>
        <form onSubmit={addPayee} className="grid sm:grid-cols-4 gap-2">
          <Input placeholder="Name" required value={pName} onChange={(e) => setPName(e.target.value)} />
          <Input placeholder="Account #" required value={pAcct} onChange={(e) => setPAcct(e.target.value)} />
          <Input placeholder="Category" value={pCat} onChange={(e) => setPCat(e.target.value)} />
          <Button type="submit"><Plus className="w-4 h-4 mr-1" />Add</Button>
        </form>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Payees</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" disabled={payees.length === 0}>Schedule payment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule payment</DialogTitle></DialogHeader>
              <form onSubmit={schedule} className="space-y-3">
                <div><Label>From account</Label>
                  <Select value={bAccount} onValueChange={setBAccount}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.account_type} {fmtAccount(a.account_number)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Payee</Label>
                  <Select value={bPayee} onValueChange={setBPayee}>
                    <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{payees.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Amount</Label><Input type="number" step="0.01" min="0.01" required value={bAmount} onChange={(e) => setBAmount(e.target.value)} /></div>
                <div><Label>Date</Label><Input type="date" required value={bDate} onChange={(e) => setBDate(e.target.value)} /></div>
                <Button type="submit" className="w-full">Schedule</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <Card className="divide-y">
          {payees.length === 0 ? <div className="p-4 text-sm text-muted-foreground text-center">No payees yet.</div> :
            payees.map((p) => (
              <div key={p.id} className="p-4 flex justify-between text-sm">
                <div><div className="font-medium">{p.name}</div><div className="text-muted-foreground tabular">{p.account_number}</div></div>
                <Badge variant="outline">{p.category ?? "Other"}</Badge>
              </div>
            ))}
        </Card>
      </div>

      <div>
        <h2 className="font-semibold mb-3">Scheduled & past payments</h2>
        <Card className="divide-y">
          {bills.length === 0 ? <div className="p-4 text-sm text-muted-foreground text-center">No payments scheduled.</div> :
            bills.map((b) => {
              const payee = payees.find((p) => p.id === b.payee_id);
              return (
                <div key={b.id} className="p-4 flex justify-between items-center">
                  <div><div className="font-medium">{payee?.name ?? "—"}</div><div className="text-xs text-muted-foreground">{fmtDate(b.scheduled_for)}</div></div>
                  <div className="text-right"><div className="tabular font-semibold">{fmtMoney(b.amount)}</div><Badge variant="outline" className="text-xs">{b.status}</Badge></div>
                </div>
              );
            })}
        </Card>
      </div>
    </div>
  );
}
