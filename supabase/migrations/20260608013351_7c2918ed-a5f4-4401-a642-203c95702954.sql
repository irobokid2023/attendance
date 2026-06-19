CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.delete_old_activity_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.activity_logs
  WHERE created_at < (now() - interval '3 days');
END;
$$;

-- Remove any previously scheduled version of this job
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'delete-old-activity-logs';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- Schedule daily cleanup at 00:05 UTC
SELECT cron.schedule(
  'delete-old-activity-logs',
  '5 0 * * *',
  $$ SELECT public.delete_old_activity_logs(); $$
);

-- Run an immediate cleanup so existing old data is purged now
SELECT public.delete_old_activity_logs();