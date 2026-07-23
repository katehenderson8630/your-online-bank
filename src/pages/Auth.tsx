import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, Loader2, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { sendEmail } from "@/lib/email";
import logoImg from "@/assets/logo.png";

const ADMIN_EMAIL = "musasule863@gmail.com";

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(5).max(30),
  password: z.string().min(8).max(72),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  address: z.string().trim().min(5).max(300),
  gender: z.string().min(1, "Gender is required"),
  ssn: z.string().regex(/^\d{9}$/, "Enter your 9-digit SSN"),
});

type Mode = "signin" | "signup" | "forgot";

type PwProps = { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">;
function PasswordInput({ value, onChange, ...rest }: PwProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} className="pr-10" {...rest} />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function Auth() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const initial = params.get("mode");
  const [mode, setMode] = useState<Mode>(initial === "signup" ? "signup" : initial === "forgot" ? "forgot" : "signin");
  const [loading, setLoading] = useState(false);


  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("");
  const [ssn, setSsn] = useState("");
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data: roles }) => {
        const admin = user.email?.toLowerCase() === ADMIN_EMAIL && roles?.some((r) => r.role === "admin");
        nav(admin ? "/admin" : "/app", { replace: true });
      });
    }
  }, [user, nav]);

  const onUpload = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setSelfie(f);
    setSelfieUrl(URL.createObjectURL(f));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Enter your email and password");
    setLoading(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signErr) { setLoading(false); return toast.error(signErr.message); }
    const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    setLoading(false);
    const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL && roles?.some((r) => r.role === "admin");
    nav(isAdmin ? "/admin" : "/app", { replace: true });
  };




  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ full_name: fullName, email, phone, password, date_of_birth: dateOfBirth, address, gender, ssn });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!selfie) return toast.error("Please add a photo for your profile");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: fullName, phone, date_of_birth: dateOfBirth, address, gender },
      },
    });
    if (error || !data.user) { setLoading(false); return toast.error(error?.message ?? "Signup failed"); }
    // Ensure we have an active session before uploading (storage RLS requires auth.uid()).
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) { setLoading(false); return toast.error("Account created. Please check your email to confirm, then sign in."); }
    }
    const ext = selfie.type.includes("png") ? "png" : "jpg";
    const path = `${data.user.id}/avatar.${ext}`;
    const up = await supabase.storage.from("kyc-selfies").upload(path, selfie, { upsert: true, contentType: selfie.type });
    if (up.error) { setLoading(false); return toast.error("Could not upload photo: " + up.error.message); }
    const { data: pub } = supabase.storage.from("kyc-selfies").getPublicUrl(path);
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      avatar_url: pub?.publicUrl ?? null,
      address, date_of_birth: dateOfBirth, ssn, phone, full_name: fullName,
      kyc_status: "pending",
    }, { onConflict: "id" });
    sendEmail("welcome", email, `welcome-${data.user.id}`, { name: fullName });
    sendEmail("kyc-submitted", email, `kyc-sub-${data.user.id}`, { name: fullName });
    toast.success("Account created! KYC under review.");
    setLoading(false);
    nav("/app", { replace: true });
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email");
    setLoading(true);
    // Send via our Resend-backed edge function (branded email)
    const { error } = await supabase.functions.invoke("request-password-reset", {
      body: { email, redirectTo: `${window.location.origin}/reset-password` },
    });
    setLoading(false);
    if (error) return toast.error("Could not send reset email. Please try again.");
    toast.success("If an account exists for that email, a reset link has been sent.");
    setMode("signin");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-6">
      <Card className="w-full max-w-lg p-6 md:p-8">
        <Link to="/" className="flex items-center gap-2.5 mb-6 justify-center">
          <img src={logoImg} alt="Lyncrest Digital Bank logo" width={44} height={44} className="w-11 h-11 object-contain" />
          <div className="leading-tight">
            <div className="font-extrabold text-lg tracking-tight text-primary">Lyncrest</div>
            <div className="text-xs font-bold text-[hsl(var(--gold))] -mt-0.5">Bank</div>
          </div>
        </Link>

        {mode !== "forgot" && (
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-secondary rounded-lg">
            <button type="button" onClick={() => setMode("signin")} className={`py-2 rounded-md text-sm font-medium ${mode === "signin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Sign in</button>
            <button type="button" onClick={() => setMode("signup")} className={`py-2 rounded-md text-sm font-medium ${mode === "signup" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>Open account</button>
          </div>
        )}

        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <div className="flex items-center justify-between"><Label>Password</Label>
                <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>
              <PasswordInput required value={password} onChange={setPassword} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sign in</Button>
          </form>
        )}


        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-4">
            <h2 className="font-semibold">Reset your password</h2>
            <p className="text-sm text-muted-foreground">Enter the email associated with your Lyncrest Digital Bank account. We'll send a secure reset link.</p>
            <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send reset email</Button>
            <button type="button" onClick={() => setMode("signin")} className="text-xs text-primary hover:underline w-full text-center">Back to sign in</button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <Label className="text-center font-semibold">Profile Photo</Label>
              {selfieUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={selfieUrl} alt="profile preview" className="w-28 h-28 rounded-full object-cover border-4 border-primary/20 shadow-lg" />
                  <Button type="button" variant="outline" size="sm" onClick={() => { setSelfie(null); setSelfieUrl(null); }}>Change photo</Button>
                </div>
              ) : (
                <label className="cursor-pointer w-full max-w-xs">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
                  <span className="flex items-center justify-center gap-2 w-full h-11 rounded-lg border-2 border-dashed border-primary/30 bg-secondary/50 text-sm font-medium hover:bg-secondary transition-colors"><Upload className="w-4 h-4" />Choose from gallery</span>
                </label>
              )}
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Personal Information</h3>
              <div><Label>Full Legal Name</Label><Input placeholder="John Doe" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date of Birth</Label><Input type="date" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></div>
                <div>
                  <Label>Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Phone Number</Label><Input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div><Label>Residential Address</Label><Input required value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div>
                <Label>Social Security Number (SSN)</Label>
                <Input inputMode="numeric" maxLength={9} placeholder="123456789" required value={ssn} onChange={(e) => setSsn(e.target.value.replace(/\D/g, "").slice(0, 9))} />
                <p className="text-xs text-muted-foreground mt-1">Required for identity verification. Stored encrypted and only visible to you and compliance.</p>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Account Credentials</h3>
              <div><Label>Email Address</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password (min 8 characters)</Label><PasswordInput required minLength={8} value={password} onChange={setPassword} /></div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create account
            </Button>
            <p className="text-xs text-muted-foreground text-center">By creating an account you agree to our Terms of Service and Privacy Policy.</p>
          </form>
        )}
      </Card>
    </div>
  );
}
