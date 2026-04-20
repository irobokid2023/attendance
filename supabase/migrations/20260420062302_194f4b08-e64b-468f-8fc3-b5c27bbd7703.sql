CREATE TYPE public.misc_task_status AS ENUM ('done', 'pending', 'not_applicable');

CREATE TABLE public.misc_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  task_key TEXT NOT NULL,
  status public.misc_task_status NOT NULL DEFAULT 'pending',
  marked_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (school_id, task_key)
);

ALTER TABLE public.misc_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view misc_tasks"
ON public.misc_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Instructors can manage misc_tasks"
ON public.misc_tasks FOR ALL
USING (has_role(auth.uid(), 'instructor'::app_role));

CREATE POLICY "Users can insert misc_tasks they mark"
ON public.misc_tasks FOR INSERT TO authenticated
WITH CHECK (auth.uid() = marked_by);

CREATE TRIGGER update_misc_tasks_updated_at
BEFORE UPDATE ON public.misc_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();