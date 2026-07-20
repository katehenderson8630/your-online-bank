-- Enable realtime on profiles + key request tables so admin changes reflect instantly on user dashboards
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.card_requests REPLICA IDENTITY FULL;
ALTER TABLE public.atc_requests REPLICA IDENTITY FULL;
ALTER TABLE public.transfer_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.card_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.atc_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;