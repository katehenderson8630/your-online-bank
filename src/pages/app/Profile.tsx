import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [address, setAddress] = useState((profile as { address?: string } | null)?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone, address }).eq("id", profile.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refreshProfile();
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!profile) return toast.error("Profile not loaded yet — please wait a moment.");
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
      if (upErr) {
        console.error("avatar upload error", upErr);
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`;
      const { error: profErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      if (profErr) {
        console.error("avatar profile update error", profErr);
        toast.error(`Save failed: ${profErr.message}`);
        return;
      }
      toast.success("Profile picture updated");
      refreshProfile();
    } catch (err) {
      console.error("avatar unexpected error", err);
      toast.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setUploading(false);
    }
  };

  const status = profile?.kyc_status;
  const statusVariant = status === "approved" ? "default" : status === "rejected" || status === "frozen" ? "destructive" : "secondary";

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <Card className="p-6 flex items-center gap-4">
        <div className="relative">
          <Avatar className="w-20 h-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{profile?.full_name?.[0]}</AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 disabled:opacity-50"
            aria-label="Change profile picture"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-lg truncate">{profile?.full_name}</div>
          <div className="text-sm text-muted-foreground truncate">{profile?.email}</div>
          <Badge variant={statusVariant} className="mt-2 capitalize">KYC: {status}</Badge>
        </div>
      </Card>

      <Card className="p-6">
        <form onSubmit={save} className="space-y-3">
          <div><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <Button disabled={busy}>Save</Button>
        </form>
      </Card>

      <Button variant="outline" onClick={signOut}>Sign out</Button>
    </div>
  );
}
