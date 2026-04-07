ALTER TABLE public.holidays ADD COLUMN end_date date;

-- Set end_date to date for existing rows
UPDATE public.holidays SET end_date = date WHERE end_date IS NULL;