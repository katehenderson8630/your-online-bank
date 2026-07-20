
-- Create enum for conversation status
CREATE TYPE public.support_status AS ENUM ('ai', 'live', 'closed');

-- Create enum for message role
CREATE TYPE public.support_role AS ENUM ('user', 'ai', 'agent');

-- Create support_conversations table
CREATE TABLE public.support_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status support_status NOT NULL DEFAULT 'ai',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own conversations"
  ON public.support_conversations FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "users create own conversations"
  ON public.support_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own conversations"
  ON public.support_conversations FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  role support_role NOT NULL,
  content TEXT NOT NULL,
  sender_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

CREATE POLICY "users insert own messages"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_conversations c
      WHERE c.id = conversation_id AND (c.user_id = auth.uid() OR public.is_admin(auth.uid()))
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;

-- Trigger for updated_at on conversations
CREATE TRIGGER update_support_conversations_updated_at
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
