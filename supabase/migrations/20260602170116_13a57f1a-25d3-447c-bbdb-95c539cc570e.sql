CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.delete_old_topics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.topics
  WHERE date < CURRENT_DATE;
END;
$function$;

-- Run cleanup immediately
SELECT public.delete_old_topics();

-- Unschedule any prior job with the same name, then schedule daily at 00:05 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('delete-old-topics-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'delete-old-topics-daily',
  '5 0 * * *',
  $$ SELECT public.delete_old_topics(); $$
);