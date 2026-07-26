import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, Clock, AlertCircle, Banknote, ShieldCheck, ArrowLeftRight, MessageCircle, FileClock, Wallet, ListChecks } from "lucide-react";
import { fmtMoney } from "@/lib/format";

export default function AdminOverview() {
  const [stats, setStats] = useState({ users: 0, pendingKyc: 0, pendingApprovals: 0, totalDeposits: 0 });

  const loadStats = useCallback(async () => {
    const [u, k, tr, dr, wr, lr, cr, ar, d] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_status", "pending"),
      supabase.from("transfer_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("deposit_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("loan_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("card_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("atc_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("transactions").select("amount").eq("type", "deposit"),
    ]);

    setStats({
      users: u.count ?? 0,
      pendingKyc: k.count ?? 0,
      pendingApprovals: [tr, dr, wr, lr, cr, ar].reduce((sum, res) => sum + (res.count ?? 0), 0),
      totalDeposits: (d.data ?? []).reduce((s, r) => s + Number(r.amount), 0),
    });
  }, []);

  useEffect(() => {
    loadStats();

    const channel = supabase
      .channel("admin-overview-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "transfer_requests" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_requests" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "card_requests" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "atc_requests" }, loadStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, loadStats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadStats]);

  const cards = [
    { icon: Users, label: "Total users", value: stats.users },
    { icon: Clock, label: "Pending KYC", value: stats.pendingKyc },
    { icon: AlertCircle, label: "Pending approvals", value: stats.pendingApprovals },
    { icon: Banknote, label: "Total deposits", value: fmtMoney(stats.totalDeposits) },
  ];

  const tools = [
    { to: "/admin/users", icon: Wallet, title: "Credit / Debit user", desc: "Open any user → set a positive amount to credit or negative to debit their account." },
    { to: "/admin/users", icon: ShieldCheck, title: "Approve / Reject KYC", desc: "Verify identity, activate accounts, freeze or unfreeze users." },
    { to: "/admin/approvals", icon: ListChecks, title: "Approve transfers, deposits & loans", desc: "Review and process all pending money movement." },
    { to: "/admin/transactions", icon: ArrowLeftRight, title: "All transactions", desc: "Search and inspect every transaction on the platform." },
    { to: "/admin/support", icon: MessageCircle, title: "Live chat support", desc: "Reply to users as a live agent — share KYC activation fee details here." },
    { to: "/admin/audit", icon: FileClock, title: "Audit log", desc: "Track every admin action." },
  ];

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Admin Overview</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <c.icon className="w-5 h-5 text-primary mb-2" />
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold tabular mt-1">{c.value}</div>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Admin tools</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {tools.map((t) => (
            <Link key={t.title} to={t.to}>
              <Card className="p-4 hover:bg-secondary transition-colors h-full">
                <t.icon className="w-5 h-5 text-primary mb-2" />
                <div className="font-medium text-sm">{t.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
