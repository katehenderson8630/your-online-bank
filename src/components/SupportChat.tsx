import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, UserRound, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "ai" | "agent"; content: string; created_at?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support`;

export default function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [status, setStatus] = useState<"ai" | "live" | "closed">("ai");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // External trigger to open the chat (e.g. from KYC banner)
  useEffect(() => {
    const handler = () => { setOpen(true); setUnreadCount(0); };
    window.addEventListener("open-support-chat", handler);
    return () => window.removeEventListener("open-support-chat", handler);
  }, []);

  // Subscribe to realtime messages when in live mode
  useEffect(() => {
    if (!convoId) return;
    const channel = supabase
      .channel(`support-${convoId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `conversation_id=eq.${convoId}`,
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.role === "agent") {
          setMessages((prev) => [...prev, { role: "agent", content: msg.content, created_at: msg.created_at }]);
          if (!open) setUnreadCount((c) => c + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [convoId, open]);

  const getOrCreateConvo = async () => {
    if (convoId) return convoId;
    const { data, error } = await supabase
      .from("support_conversations")
      .insert({ user_id: user!.id, status: "ai" })
      .select("id")
      .single();
    if (error) { toast.error("Could not start conversation"); return null; }
    setConvoId(data.id);
    return data.id;
  };

  const saveMessage = async (cid: string, role: "user" | "ai" | "agent", content: string) => {
    await supabase.from("support_messages").insert({
      conversation_id: cid,
      role,
      content,
      sender_id: role === "user" ? user!.id : null,
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    const cid = await getOrCreateConvo();
    if (!cid) return;
    await saveMessage(cid, "user", text);

    if (status === "live") return; // In live mode, wait for agent reply

    setLoading(true);
    try {
      const aiMessages = messages
        .filter((m) => m.role !== "agent")
        .map((m) => ({ role: m.role === "ai" ? "assistant" as const : "user" as const, content: m.content }));
      aiMessages.push({ role: "user", content: text });

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: aiMessages }),
      });

      if (!resp.ok || !resp.body) throw new Error("AI failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let aiText = "";

      const upsertAi = (txt: string) => {
        aiText = txt;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "ai") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: txt } : m));
          }
          return [...prev, { role: "ai", content: txt }];
        });
      };

      let done = false;
      while (!done) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) upsertAi(aiText + c);
          } catch { break; }
        }
      }

      if (aiText) await saveMessage(cid, "ai", aiText);
    } catch {
      toast.error("AI assistant is unavailable right now");
    } finally {
      setLoading(false);
    }
  };

  const requestLiveAgent = async () => {
    const cid = await getOrCreateConvo();
    if (!cid) return;
    await supabase.from("support_conversations").update({ status: "live" }).eq("id", cid);
    setStatus("live");
    const agentMsg: Msg = { role: "ai", content: "You've been connected to a live agent. Someone will be with you shortly. Please describe your issue and an agent will respond." };
    setMessages((prev) => [...prev, agentMsg]);
    await saveMessage(cid, "ai", agentMsg.content);
  };

  const startNewChat = () => {
    setConvoId(null);
    setMessages([]);
    setStatus("ai");
  };

  if (!user) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setUnreadCount(0); }}
          className="hidden"
        >
          <MessageCircle className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-2 md:bottom-6 md:right-6 z-50 w-[340px] md:w-[380px] h-[500px] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="font-semibold text-sm">
                {status === "live" ? "Live Agent Support" : "AI Assistant"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {convoId && (
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/20 text-xs h-7" onClick={startNewChat}>
                  New Chat
                </Button>
              )}
              <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-8 space-y-2">
                <Bot className="w-10 h-10 mx-auto text-primary/50" />
                <p>Hello! I'm your Lyncrest Digital Bank assistant.</p>
                <p>How can I help you today?</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-2 mb-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role !== "user" && (
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    m.role === "agent" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary")}>
                    {m.role === "agent" ? <UserRound className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                )}
                <div className={cn("rounded-2xl px-3 py-2 text-sm max-w-[75%]",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md")}>
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-secondary rounded-2xl rounded-bl-md px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </ScrollArea>

          {/* Live agent button */}
          {status === "ai" && messages.length >= 2 && (
            <div className="px-3 pb-1">
              <button
                onClick={requestLiveAgent}
                className="w-full text-xs text-primary hover:underline py-1"
              >
                💬 Talk to a live agent instead
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t flex gap-2">
            <Input
              placeholder={status === "live" ? "Message the agent..." : "Ask me anything..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              className="text-sm h-9"
            />
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={sendMessage} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
