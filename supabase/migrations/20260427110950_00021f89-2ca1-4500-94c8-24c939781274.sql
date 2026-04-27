-- Enable required extensions for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function: delete topics older than 7 days (based on the topic's date field)
CREATE OR REPLACE FUNCTION public.delete_old_topics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.topics
  WHERE date < (CURRENT_DATE - INTERVAL '7 days');
END;
$$;