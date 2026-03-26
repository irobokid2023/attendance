
-- Add coordinator and scheduling fields to schools
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS days text[] DEFAULT '{}';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS ir_coordinator_name text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS ir_coordinator_mobile text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS primary_coordinator_name text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS primary_coordinator_mobile text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS secondary_coordinator_name text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS secondary_coordinator_mobile text;

-- Add scheduling fields to classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS day text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS timing text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS num_sessions integer DEFAULT 0;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS instructor_names text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS venue text;
