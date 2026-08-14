import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Snowflake, Sun } from "lucide-react";
import { sendEmail } from "@/lib/email";

type Account = { id: string; account_number: string; account_type: string };
type CardRow = { id: string; card_number: string; cardholder_name: string; expiry_month: number; expiry_year: number; cvv: string; is_frozen: boolean; account_id: string };
type Req = { id: string; status: string; amount: number; created_at: string; admin_note: string | null };

const FEE = 465;

export default function Cards() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: c }, { data: r }] = await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase.from("card_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setAccounts((a as Account[]) ?? []);
    setCards((c as CardRow[]) ?? []);
    setRequests((r as Req[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const requestCard = async () => {
    if (!user || busy) return;
    // Auto-link to the user's checking account (fallback to first available).
    const linked = accounts.find((a) => a.account_type === "checking") ?? accounts[0];
    if (!linked) return toast.error("Your accounts aren't ready yet. Please complete KYC first.");
    if (requests.some((r) => r.status === "pending")) return toast.error("You already have a pending card request.");
    setBusy(true);
    const { error } = await supabase.from("card_requests").insert({
      user_id: user.id, account_id: linked.id, amount: FEE, status: "pending",
    });
    if (error) { setBusy(false); return toast.error(error.message); }
    // Email is best-effort: never block or fail the request because of it.
    if (profile?.email) {
      try {
        await sendEmail("card-requested", profile.email, `cardreq-${user.id}-${Date.now()}`, { name: profile.full_name, amount: FEE });
      } catch (e) {
        console.error("card request email failed", e);
      }
    }
    await load();
    setBusy(false);
    toast.success("Card request submitted. Awaiting admin approval.");
  };

  const toggleFreeze = async (c: CardRow) => {
    const { error } = await supabase.from("cards").update({ is_frozen: !c.is_frozen }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(c.is_frozen ? "Card unfrozen" : "Card frozen");
    load();
  };

  const pending = requests.find((r) => r.status === "pending");
  const kycApproved = profile?.kyc_status === "approved";

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Cards</h1>

      {!kycApproved && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="font-medium">Step 1 — KYC must be approved first</div>
          <p className="text-sm text-muted-foreground mt-1">
            Your first notification is KYC. After admin approves KYC, this card request step will unlock immediately.
          </p>
          <Button size="sm" className="mt-3" onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}>
            Contact live support
          </Button>
        </Card>
      )}

      {kycApproved && cards.length === 0 && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="font-medium">Debit card required to unlock transactions</div>
          <p className="text-sm text-muted-foreground mt-1">
            To send transfers, pay bills or make withdrawals, you need an active Lyncrest Digital Bank debit card. Please <b>contact our live support agent</b> for the issuance fee amount and payment details. Once you’ve paid, submit a card request below and an admin will issue your card.
          </p>
          <Button size="sm" className="mt-3" onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}>
            Contact live support
          </Button>
        </Card>
      )}

      {kycApproved && pending ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Card request pending</div>
              <p className="text-sm text-muted-foreground">Submitted on {new Date(pending.created_at).toLocaleDateString()} · awaiting admin approval</p>
            </div>
            <Badge>Pending</Badge>
          </div>
        </Card>
      ) : kycApproved && cards.length === 0 ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-3">
            Your card will be issued in your name and automatically linked to your account. Only submit after you've paid the issuance fee with our live support agent.
          </p>
          <Button onClick={requestCard} disabled={busy || accounts.length === 0} className="w-full sm:w-auto">
            <CreditCard className="w-4 h-4 mr-2" />Submit card request
          </Button>
        </Card>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <div className="p-5 text-primary-foreground" style={{ background: "var(--gradient-card)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs opacity-80">DEBIT</span>
                {c.is_frozen && <Badge variant="secondary">Frozen</Badge>}
              </div>
              <div className="text-lg tabular tracking-widest mt-6">
                •••• •••• •••• {c.card_number.slice(-4)}
              </div>
              <div className="flex justify-between mt-4 text-xs">
                <div><div className="opacity-60">CARDHOLDER</div><div>{c.cardholder_name}</div></div>
                <div><div className="opacity-60">EXP</div><div className="tabular">{String(c.expiry_month).padStart(2, "0")}/{String(c.expiry_year).slice(-2)}</div></div>
                <div><div className="opacity-60">CVV</div><div className="tabular">•••</div></div>
              </div>
            </div>
            <div className="p-3">
              <Button variant="outline" size="sm" className="w-full" onClick={() => toggleFreeze(c)}>
                {c.is_frozen ? <><Sun className="w-4 h-4 mr-1" />Unfreeze</> : <><Snowflake className="w-4 h-4 mr-1" />Freeze</>}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
