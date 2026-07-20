import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeftRight, ListChecks, BarChart3, FileClock, LogOut, Shield, MessageCircle, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import logoImg from "@/assets/logo.png";

const items = [
  { to: "/admin", end: true, icon: BarChart3, label: "Overview" },
  { to: "/admin/users", icon: Users, label: "Users & KYC" },
  { to: "/admin/approvals", icon: ListChecks, label: "Approvals" },
  { to: "/admin/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/admin/audit", icon: FileClock, label: "Audit log" },
  { to: "/admin/support", icon: MessageCircle, label: "Support" },
];

export default function AdminLayout() {
  const { signOut, profile } = useAuth();
  const nav = useNavigate();
  const [unreadSupport, setUnreadSupport] = useState(0);

  useEffect(() => {
    const loadUnread = async () => {
      const { data } = await supabase
        .from("support_conversations")
        .select("id")
        .in("status", ["ai", "live"] as any);
      setUnreadSupport(data?.length ?? 0);
    };
    loadUnread();
    const ch = supabase
      .channel("admin-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => loadUnread())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="px-6 py-5 border-b flex items-center gap-2">
          <img src={logoImg} alt="Green Wells Fargo logo" className="w-9 h-9 object-contain" />
          <div>
            <div className="font-semibold">Green Wells Fargo</div>
            <div className="text-xs text-muted-foreground">Admin console</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {items.map((i) => {
            const showBadge = i.to === "/admin/support" && unreadSupport > 0;
            return (
              <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) =>
                cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
                <i.icon className="w-4 h-4" />
                {i.label}
                {showBadge && <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">{unreadSupport}</Badge>}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={async () => { await signOut(); nav("/auth"); }}>
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden bg-background">
        <div className="md:hidden flex items-center justify-between px-4 h-14 border-b bg-card gap-2">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Logo" className="w-7 h-7 object-contain" />
            <span className="font-semibold text-sm">Admin</span>
          </div>
          <div className="flex items-center gap-2">
             {unreadSupport > 0 && (
              <Button variant="ghost" size="icon" className="relative" onClick={() => nav("/admin/support")}>
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{unreadSupport}</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav("/auth"); }}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
