import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtMoney, fmtDate, fmtAccount } from "@/lib/format";
import { ArrowDownLeft, ArrowUpRight, Wallet, ArrowLeftRight, Receipt, CreditCard, Eye, EyeOff, Copy, ShieldCheck, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Badge as UBadge } from "@/components/ui/badge";

type Account = { id: string; account_number: string; account_type: string; balance: number; currency: string; is_frozen: boolean };
type Tx = { id: string; type: string; status: string; amount: number; description: string | null; created_at: string };

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recent, setRecent] = useState<Tx[]>([]);
  const [hasCard, setHasCard] = useState(false);
  const [pendingCardReq, setPendingCardReq] = useState(false);
  const [hasAtc, setHasAtc] = useState(false);
  const [pendingAtcReq, setPendingAtcReq] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const reload = async () => {
    const [{ data: accs }, { data: txs }, { data: cards }, { data: creqs }, { data: atcs }, { data: pendingAtcs }] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("cards").select("id").limit(1),
      supabase.from("card_requests").select("id").eq("status", "pending").limit(1),
      supabase.from("atc_requests").select("id").eq("status", "approved").eq("used", false).limit(1),
      supabase.from("atc_requests").select("id").eq("status", "pending").limit(1),
    ]);
    setAccounts((accs as Account[]) ?? []);
    setRecent((txs as Tx[]) ?? []);
    setHasCard((cards?.length ?? 0) > 0);
    setPendingCardReq((creqs?.length ?? 0) > 0);
    setHasAtc((atcs?.length ?? 0) > 0);
    setPendingAtcReq((pendingAtcs?.length ?? 0) > 0);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    reload();
    const ch = supabase
      .channel(`dash-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "cards", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_requests", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_requests", filter: `user_id=eq.${user.id}` }, reload)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const total = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const isPending = profile?.kyc_status === "pending";
  const isRejected = profile?.kyc_status === "rejected";
  const isFrozen = profile?.kyc_status === "frozen";
  const isApproved = profile?.kyc_status === "approved";

  const showKycBanner = isPending || isRejected || isFrozen;
  const showCardBanner = !showKycBanner && isApproved && !hasCard;
  const showAtcBanner = !showKycBanner && isApproved && hasCard && !hasAtc;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const primaryAccount = accounts[0];
  const anyFrozen = accounts.some((a) => a.is_frozen);
  const accountStatus = isFrozen || anyFrozen ? "Frozen" : isApproved ? "Active" : "Pending";

  const copyAccount = () => {
    if (!primaryAccount) return;
    navigator.clipboard.writeText(primaryAccount.account_number);
    toast.success("Account number copied");
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-6">
      {showKycBanner && (
        <Card className="p-3 border-warning bg-warning/5">
          <div className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {isPending && "Verify your identity to activate your account"}
                {isRejected && "Account verification was rejected"}
                {isFrozen && "Your account is frozen"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {isPending && "A one-time KYC activation fee is required. Please contact our live support to receive the exact amount and payment details."}
                {isRejected && (profile?.kyc_reason ?? "Please contact support.")}
                {isFrozen && (profile?.kyc_reason ?? "Some actions are restricted. Contact support.")}
              </p>
              <Button size="sm" className="mt-2 h-7 text-xs" onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}>
                Contact live support
              </Button>
            </div>
          </div>
        </Card>
      )}

      {showCardBanner && (
        <Card className="p-3 border-primary bg-primary/5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Request your debit card</div>
              <p className="text-xs text-muted-foreground mt-1">
                Your KYC is approved. To send money, pay bills or make withdrawals you need an active debit card. Contact our live support agent for the issuance fee and payment details.
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}>
                  Contact live support
                </Button>
                <Link to="/app/cards"><Button size="sm" variant="outline" className="h-7 text-xs">{pendingCardReq ? "View request" : "Apply for card"}</Button></Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      {showAtcBanner && (
        <Card className="p-3 border-primary bg-primary/5">
          <div className="flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-primary mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium">Request your ATC code</div>
              <p className="text-xs text-muted-foreground mt-1">
                Your debit card is active. Request an Authorization Transfer Code before sending transfers, paying bills or submitting withdrawals.
              </p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => window.dispatchEvent(new CustomEvent("open-support-chat"))}>
                  Contact live support
                </Button>
                <Link to="/app/atc"><Button size="sm" variant="outline" className="h-7 text-xs">{pendingAtcReq ? "View request" : "Request ATC"}</Button></Link>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 text-primary-foreground relative overflow-hidden" style={{ background: "var(--gradient-card)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="w-10 h-10 border-2 border-white/30 shrink-0">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-white/20 text-primary-foreground text-sm font-bold">{firstName[0] ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider opacity-80">{greeting}</p>
              <p className="font-semibold text-sm truncate">{firstName}</p>
            </div>
          </div>
          <UBadge variant="secondary" className="bg-warning/20 text-warning border-warning/30 hover:bg-warning/20 text-[10px] px-2 py-0.5">
            <ShieldCheck className="w-3 h-3 mr-1" />
            {isApproved ? "KYC ✓" : "KYC"}
          </UBadge>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs opacity-80">Available Balance</p>
            <button onClick={() => setShowBalance((v) => !v)} className="opacity-80 hover:opacity-100" aria-label="Toggle balance">
              {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-2xl md:text-3xl font-bold tabular mt-0.5">{showBalance ? fmtMoney(total) : "••••••"}</p>
        </div>

        <div className="border-t border-white/20 my-3" />

        <div className="flex items-end justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider opacity-80">Account No.</p>
            <button onClick={copyAccount} className="flex items-center gap-2 mt-0.5 group">
              <span className="tabular text-sm">{primaryAccount?.account_number ?? "—"}</span>
              <Copy className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
            </button>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-80">Status</p>
            <span className="inline-flex items-center gap-1.5 mt-0.5 px-2 py-0.5 rounded-md bg-white/15 text-xs">
              <span className={`w-1.5 h-1.5 rounded-full ${accountStatus === "Active" ? "bg-success" : accountStatus === "Frozen" ? "bg-destructive" : "bg-warning"}`} />
              {accountStatus}
            </span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-5 gap-2 md:gap-3">
        {[
          { to: "/app/transfers", icon: ArrowLeftRight, label: "Transfer" },
          { to: "/app/deposit", icon: Wallet, label: "Deposit" },
          { to: "/app/cards", icon: CreditCard, label: "Cards" },
          { to: "/app/atc", icon: KeyRound, label: "ATC" },
          { to: "/app/bills", icon: Receipt, label: "Bills" },
        ].map((a) => (
          <Link key={a.to} to={a.to}>
            <Card className="p-3 md:p-4 hover:bg-secondary transition-colors text-center">
              <a.icon className="w-5 h-5 md:w-6 md:h-6 text-primary mb-2 mx-auto" />
              <div className="text-xs md:text-sm font-medium">{a.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Accounts</h2>
        </div>
        {loading ? (
          <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
        ) : accounts.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground text-center">
            No accounts yet. Once your identity is verified, accounts will appear here.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {accounts.map((a) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{a.account_type}</div>
                    <div className="text-sm tabular text-muted-foreground">{fmtAccount(a.account_number)}</div>
                  </div>
                  {a.is_frozen && <Badge variant="destructive">Frozen</Badge>}
                </div>
                <div className="text-2xl font-semibold tabular mt-2">{fmtMoney(a.balance, a.currency)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent activity</h2>
          <Link to="/app/transactions"><Button variant="ghost" size="sm">View all</Button></Link>
        </div>
        <Card className="divide-y">
          {recent.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">No transactions yet.</div>
          ) : recent.map((t) => {
            const isIn = ["deposit", "transfer_in", "interest", "reversal"].includes(t.type) || (t.type === "adjustment" && Number(t.amount) > 0);
            return (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isIn ? "bg-success/10 text-success" : "bg-secondary text-foreground"}`}>
                    {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{t.description || t.type.replace("_", " ")}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</div>
                  </div>
                </div>
                <div className={`tabular font-semibold text-sm ${isIn ? "text-success" : ""}`}>
                  {isIn ? "+" : "-"}{fmtMoney(Math.abs(Number(t.amount)))}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
