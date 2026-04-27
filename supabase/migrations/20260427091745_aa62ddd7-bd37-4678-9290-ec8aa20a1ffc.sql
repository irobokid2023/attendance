-- Remove duplicate topics keeping the most recent per (class_id, date)
DELETE FROM public.topics t
USING public.topics t2
WHERE t.class_id = t2.class_id
  AND t.date = t2.date
  AND t.created_at < t2.created_at;

-- Add unique constraint to support overwrite via upsert
ALTER TABLE public.topics
ADD CONSTRAINT topics_class_date_unique UNIQUE (class_id, date);