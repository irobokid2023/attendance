-- Schedule a nightly VACUUM (FULL) on activity_logs so storage actually shrinks
-- after the 3-day cleanup job runs.
SELECT cron.unschedule('vacuum-activity-logs-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='vacuum-activity-logs-daily'
);

SELECT cron.schedule(
  'vacuum-activity-logs-daily',
  '15 0 * * *',  -- 00:15 UTC daily, just after the delete job at 00:05
  $$ VACUUM (FULL, ANALYZE) public.activity_logs; $$
);