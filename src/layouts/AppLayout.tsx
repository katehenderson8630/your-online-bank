import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, CreditCard, Receipt, User as UserIcon,
  Shield, LogOut, Landmark, Menu, KeyRound, MoreHorizontal, ListOrdered,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import SupportChat from "@/components/SupportChat";

const primaryNav = [
  { to: "/app", icon: LayoutDashboard, label: "Home", end: true },
  { to: "/app/transfers", icon: ArrowLeftRight, label: "Transfer" },
  { to: "/app/deposit", icon: Wallet, label: "Deposit" },
  { to: "/app/cards", icon: CreditCard, label: "Cards" },
];

const moreNav = [
  { to: "/app/atc", icon: KeyRound, label: "ATC" },
  { to: "/app/bills", icon: Receipt, label: "Bills" },
  { to: "/app/loans", icon: Landmark, label: "Loans" },
];

export default function AppLayout() {
  const { profile, isAdmin, signOut, user } = useAuth();
  const nav = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    nav("/auth");
  };

  if (!user) return null;

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header (all viewports) */}
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="container mx-auto flex items-center justify-between gap-2 px-3 md:px-6 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoImg} alt="Green Wells Fargo logo" className="w-8 h-8 object-contain shrink-0" />
            <div className="leading-tight hidden sm:block">
              <div className="font-extrabold text-sm tracking-tight text-primary">Green Wells</div>
              <div className="text-[10px] font-bold text-[hsl(var(--gold))] -mt-0.5">Fargo</div>
            </div>
          </div>

          {/* Desktop horizontal nav */}
          <nav className="hidden md:flex items-center gap-1">
            {primaryNav.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <i.icon className="w-4 h-4" />
                {i.label}
              </NavLink>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                  <MoreHorizontal className="w-4 h-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {moreNav.map((i) => (
                  <DropdownMenuItem key={i.to} onClick={() => nav(i.to)}>
                    <i.icon className="w-4 h-4 mr-2" /> {i.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Right cluster: profile menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full md:rounded-md md:pl-2 md:pr-3 md:py-1 hover:bg-secondary transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback>{firstName[0] ?? "U"}</AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left leading-tight max-w-[160px]">
                  <div className="text-sm font-medium truncate">{firstName || "User"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{profile?.email}</div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="leading-tight">
                <div className="text-sm font-medium truncate">{profile?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{profile?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/app/profile")}>
                <UserIcon className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => nav("/app/transactions")}>
                <ListOrdered className="w-4 h-4 mr-2" /> Transactions
              </DropdownMenuItem>
              {/* Mobile-only quick links to More items */}
              <div className="md:hidden">
                <DropdownMenuSeparator />
                {moreNav.map((i) => (
                  <DropdownMenuItem key={i.to} onClick={() => nav(i.to)}>
                    <i.icon className="w-4 h-4 mr-2" /> {i.label}
                  </DropdownMenuItem>
                ))}
              </div>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => nav("/admin")}>
                    <Shield className="w-4 h-4 mr-2" /> Admin
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0 overflow-x-hidden">
        <Outlet />
      </main>

      <SupportChat />

      {/* Mobile bottom nav: Home / Transfer / Deposit / Cards / More */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-40">
        <div className="grid grid-cols-5">
          {primaryNav.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <i.icon className="w-5 h-5" />
              {i.label}
            </NavLink>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] text-muted-foreground">
                <Menu className="w-5 h-5" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-44 mb-2">
              {moreNav.map((i) => (
                <DropdownMenuItem key={i.to} onClick={() => nav(i.to)}>
                  <i.icon className="w-4 h-4 mr-2" /> {i.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
    </div>
  );
}
