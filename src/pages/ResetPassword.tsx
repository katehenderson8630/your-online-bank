import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logoImg from "@/assets/logo.png";

export default function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Supabase recovery links arrive with tokens in the URL hash (#access_token=...&type=recovery)
    // detectSessionInUrl picks them up automatically and fires PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please sign in.");
    await supabase.auth.signOut();
    nav("/auth?mode=signin", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-6">
      <Card className="w-full max-w-md p-6 md:p-8">
        <Link to="/" className="flex items-center gap-2.5 mb-6 justify-center">
          <img src={logoImg} alt="Green Wells Fargo logo" width={44} height={44} className="w-11 h-11 object-contain" />
          <div className="leading-tight">
            <div className="font-extrabold text-lg tracking-tight text-primary">Green Wells</div>
            <div className="text-xs font-bold text-[hsl(var(--gold))] -mt-0.5">Fargo</div>
          </div>
        </Link>
        <h1 className="text-xl font-semibold mb-1">Set a new password</h1>
        <p className="text-sm text-muted-foreground mb-4">Choose a strong password you haven't used before.</p>

        {!ready ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Verifying reset link…</div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>New password</Label>
              <div className="relative">
                <Input type={show ? "text" : "password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input type={show ? "text" : "password"} required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Update password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
