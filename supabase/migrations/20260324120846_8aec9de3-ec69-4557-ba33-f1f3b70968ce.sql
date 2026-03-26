CREATE TABLE public.holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view holidays" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Instructors can manage holidays" ON public.holidays FOR ALL USING (public.has_role(auth.uid(), 'instructor'::app_role));