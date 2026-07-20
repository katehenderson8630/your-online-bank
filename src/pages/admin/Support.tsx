import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, UserRound, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type Conversation = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  unread?: boolean;
};

type Message = {
  id: string;
  role: string;
  content: string;
  sender_id: string | null;
  created_at: string;
};

export default function AdminSupport() {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load conversations
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("support_conversations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (data) {
        // Fetch profile names
        const userIds = [...new Set(data.map((c: any) => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const pMap = new Map(profiles?.map((p: any) => [p.id, p]) ?? []);
        setConvos(data.map((c: any) => ({
          ...c,
          user_name: (pMap.get(c.user_id) as any)?.full_name ?? "Unknown",
          user_email: (pMap.get(c.user_id) as any)?.email ?? "",
        })));
      }
      setLoadingConvos(false);
    };
    load();

    // Realtime for new conversations
    const ch = supabase
      .channel("admin-convos")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_conversations" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selected) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: true });
      if (data) setMessages(data as Message[]);
    };
    load();

    const ch = supabase
      .channel(`admin-msgs-${selected}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${selected}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = async () => {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    await supabase.from("support_messages").insert({
      conversation_id: selected,
      role: "agent",
      content: reply.trim(),
      sender_id: user!.id,
    });
    // Update conversation to live if it's ai
    await supabase.from("support_conversations").update({ status: "live" }).eq("id", selected);
    setReply("");
    setSending(false);
  };

  const closeConvo = async (cid: string) => {
    await supabase.from("support_conversations").update({ status: "closed" }).eq("id", cid);
  };

  const selectedConvo = convos.find((c) => c.id === selected);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen">
      {/* Conversations list */}
      <div className={cn("w-full md:w-80 border-r bg-card flex flex-col", selected ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Support Chats</h2>
          <p className="text-xs text-muted-foreground">{convos.filter(c => c.status !== "closed").length} active</p>
        </div>
        <ScrollArea className="flex-1">
          {loadingConvos ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : convos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No conversations yet</p>
          ) : (
            convos.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c.id)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b hover:bg-secondary/50 transition-colors",
                  selected === c.id && "bg-secondary"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">{c.user_name}</span>
                  <Badge variant={c.status === "live" ? "default" : c.status === "closed" ? "secondary" : "outline"} className="text-[10px] ml-2">
                    {c.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{c.user_email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(c.updated_at), "MMM d, h:mm a")}</p>
              </button>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat view */}
      <div className={cn("flex-1 flex flex-col", !selected ? "hidden md:flex" : "flex")}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageCircle className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b bg-card flex items-center justify-between">
              <div>
                <button onClick={() => setSelected(null)} className="md:hidden text-sm text-primary mr-2">← Back</button>
                <span className="font-semibold text-sm">{selectedConvo?.user_name}</span>
                <span className="text-xs text-muted-foreground ml-2">{selectedConvo?.user_email}</span>
              </div>
              {selectedConvo?.status !== "closed" && (
                <Button variant="outline" size="sm" onClick={() => closeConvo(selected)}>
                  Close
                </Button>
              )}
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex gap-2 mb-3", m.role === "user" ? "justify-end" : "justify-start")}>
                  {m.role !== "user" && (
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      m.role === "agent" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary")}>
                      {m.role === "agent" ? <UserRound className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                  )}
                  <div>
                    <div className={cn("rounded-2xl px-3 py-2 text-sm max-w-md",
                      m.role === "user"
                        ? "bg-blue-100 text-blue-900 rounded-br-md"
                        : m.role === "agent"
                        ? "bg-green-50 text-green-900 rounded-bl-md"
                        : "bg-secondary text-secondary-foreground rounded-bl-md")}>
                      {m.content}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {format(new Date(m.created_at), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </ScrollArea>

            {/* Reply input */}
            {selectedConvo?.status !== "closed" && (
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Type your reply..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  className="text-sm"
                />
                <Button size="icon" onClick={sendReply} disabled={sending || !reply.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}