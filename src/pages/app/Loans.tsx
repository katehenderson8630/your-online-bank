import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtMoney, fmtDate } from "@/lib/format";
import { Landmark } from "lucide-react";

type Loan = { id: string; amount: number; purpose: string | null; duration_months: number; status: string; admin_note: string | null; created_at: string };

export default function Loans() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [duration, setDuration] = useState("12");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("loan_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setLoans((data as Loan[]) ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from("loan_requests").insert({
      user_id: user.id,
      amount: amt,
      purpose: purpose || null,
      duration_months: parseInt(duration) || 12,
    });
    if (error) { toast.error(error.message); setSubmitting(false); return; }
    toast.success("Loan application submitted!");
    setAmount(""); setPurpose(""); setDuration("12");
    setSubmitting(false);
    load();
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Loans</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Landmark className="w-5 h-5" /> Apply for a Loan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Loan Amount ($)</Label>
            <Input type="number" step="0.01" placeholder="e.g. 5000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Duration (months)</Label>
            <Input type="number" placeholder="12" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <Label>Purpose</Label>
            <Textarea placeholder="What is this loan for?" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full">Submit Application</Button>
        </CardContent>
      </Card>

      {loans.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">My Loan Applications</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {loans.map((l) => (
              <div key={l.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{fmtMoney(l.amount)}</div>
                  <div className="text-xs text-muted-foreground">{l.purpose ?? "Personal"} · {l.duration_months} months · {fmtDate(l.created_at)}</div>
                  {l.admin_note && <div className="text-xs text-muted-foreground mt-1">Note: {l.admin_note}</div>}
                </div>
                <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{l.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}